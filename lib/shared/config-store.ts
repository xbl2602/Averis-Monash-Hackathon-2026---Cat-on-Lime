/**
 * app_config 表的读写（第二阶段 SPEC 第 3 节）。
 *
 * 分层：api/ 只解析请求，逻辑在这里；LLM 调用层未来通过这里的 resolveConfigValue 取值。
 * 并发约定：写入用 upsert（key 唯一），带 update 时间戳；不做"先查再写"。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClientAsync, isSupabaseServiceAvailable } from "./supabase";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";

export type ConfigCategory = "llm" | "pipeline" | "storage" | "mail" | "general";

export interface ConfigItemRow {
  key: string;
  category: ConfigCategory;
  value: unknown; // 库里存 jsonb（敏感项这里是密文字符串）
  is_secret: boolean;
  updated_at: string | null;
}

/** 给界面回显的形态：敏感值只给掩码 + has_value，永不回明文 */
export interface ConfigItemView {
  key: string;
  category: ConfigCategory;
  value: unknown;
  is_secret: boolean;
  has_value: boolean;
  source: "db" | "env" | "default" | "unset";
  updated_at: string | null;
}

/**
 * 环境变量兜底映射：key → 环境变量名。
 * 只列"允许被数据库覆盖"的项；数据库没值时界面显示 env 现值。
 * 敏感项和明文项分成两张表：is_secret 只对敏感映射成立（SPEC 3.2 明确 lmstudio_base_url 是明文）。
 */
const SENSITIVE_ENV_FALLBACK: Record<string, string> = {
  "llm.anthropic_api_key": "ANTHROPIC_API_KEY",
  "llm.openai_api_key": "OPENAI_API_KEY",
  "llm.deepseek_api_key": "DEEPSEEK_API_KEY",
  "llm.gemini_api_key": "GOOGLE_GENERATIVE_AI_API_KEY",
  "llm.typesafe_api_key": "TYPESAFE_API_KEY",
};

const PLAINTEXT_ENV_FALLBACK: Record<string, string> = {
  "llm.lmstudio_base_url": "LM_STUDIO_BASE_URL",
};

function envNameOf(key: string): string | undefined {
  return SENSITIVE_ENV_FALLBACK[key] ?? PLAINTEXT_ENV_FALLBACK[key];
}

/** 敏感项：值必须加密存储、回显只给掩码 */
function isSensitiveKey(key: string): boolean {
  return Boolean(SENSITIVE_ENV_FALLBACK[key]);
}

/** 明文项：即使数据库行曾被误标 is_secret，也按明文回显（SPEC 3.2） */
function isPlaintextKey(key: string): boolean {
  return Boolean(PLAINTEXT_ENV_FALLBACK[key]);
}

/** 代码默认值：数据库/env 都没有时界面显示"未配置"或默认 */
export const CONFIG_DEFAULTS: Record<string, unknown> = {
  "llm.provider_priority": ["rules", "jev", "gemini"],
  "llm.jev.confidence_threshold": 0.85,
  "llm.default_provider": "gemini",
  "pipeline.concurrency": 4,
  "pipeline.batch_limit": 50,
  "storage.upload_max_file_mb": 20,
  "storage.upload_max_batch_mb": 3,
  "mail.auto_sync_enabled": false,
  "mail.sync_interval_minutes": 15,
};

export function isConfigStoreAvailable(): boolean {
  return isSupabaseServiceAvailable();
}

export async function listConfigViews(category?: ConfigCategory): Promise<ConfigItemView[]> {
  const client = await getSupabaseServiceClientAsync();
  // 这里不按 category 过滤数据库查询：env/默认兜底项不在库里，
  // 必须先把两类数据合并、算出"有效 category"之后才能过滤（否则 ?category=llm 会静默丢掉兜底项）。
  const { data, error } = await client.from("app_config").select("key, category, value, is_secret, updated_at");
  if (error) {
    throw new Error(
      `读取配置失败：${error.message}。若刚切换过启用项目，请检查项目地址是否可达，或在 mail 的 supabase-projects 接口停用它后重试`
    );
  }
  const rows = (data ?? []) as ConfigItemRow[];
  const byKey = new Map(rows.map((row) => [row.key, row]));

  const keys = Array.from(
    new Set([
      ...byKey.keys(),
      ...Object.keys(SENSITIVE_ENV_FALLBACK),
      ...Object.keys(PLAINTEXT_ENV_FALLBACK),
      ...Object.keys(CONFIG_DEFAULTS),
    ])
  );
  return keys
    .map((key) => {
      const row = byKey.get(key);
      // 有效 category：数据库行以行上的为准，兜底项按 key 前缀推导
      const effectiveCategory = row?.category ?? categoryOf(key);
      const envName = envNameOf(key);
      const envValue = envName ? process.env[envName] : undefined;
      const fallback = envValue || CONFIG_DEFAULTS[key];
      // 敏感判定只认敏感映射；明文项即使库里标了 is_secret 也按明文处理
      const isSecret = isSensitiveKey(key) || (!isPlaintextKey(key) && Boolean(row?.is_secret));

      if (row) {
        return {
          key,
          category: effectiveCategory,
          value: isSecret && typeof row.value === "string" ? maskDecrypted(row.value) : row.value,
          is_secret: isSecret,
          has_value: row.value !== null && row.value !== "",
          source: "db" as const,
          updated_at: row.updated_at,
        };
      }
      if (fallback !== undefined && fallback !== "") {
        return {
          key,
          category: effectiveCategory,
          value: isSecret ? maskSecret(String(fallback)) : fallback,
          is_secret: isSecret,
          has_value: true,
          source: envName ? ("env" as const) : ("default" as const),
          updated_at: null,
        };
      }
      return {
        key,
        category: effectiveCategory,
        value: null,
        is_secret: isSecret,
        has_value: false,
        source: "unset" as const,
        updated_at: null,
      };
    })
    .filter((item) => !category || item.category === category);
}

// db 里敏感项回显：先解密再打码（解密失败不抛给界面，显示占位并在 has_value 隐含异常）
function maskDecrypted(cipher: string): string {
  try {
    return maskSecret(decryptSecret(cipher));
  } catch {
    return "•••";
  }
}

export interface ConfigUpdate {
  key: string;
  value: string | number | boolean | string[] | null;
  /** 可选乐观锁：调用方读取时的 updated_at（ISO 字符串），与当前行不一致则整批拒绝 */
  expected_updated_at?: string;
}

/** 乐观锁冲突：整批拒绝，调用方（HTTP 层）转成 409 */
export class ConfigConflictError extends Error {
  readonly keys: string[];

  constructor(keys: string[]) {
    super(`保存被拒绝：以下配置在你读取之后已被修改：${keys.join("、")}。请重新读取最新配置再保存`);
    this.name = "ConfigConflictError";
    this.keys = keys;
  }
}

/**
 * 校验 expected_updated_at：只对带该字段的 key 查当前行，逐个比对 updated_at。
 * 当前行不存在 → 视为无冲突；不一致 → 抛 ConfigConflictError（在调用方进行任何写入之前）。
 *
 * 取舍说明：查询和后续写入之间存在一个小窗口（两个请求可能同时通过检查、再先后写入），
 * CLAUDE.md 明确本阶段只需要"基本冲突提示"，不为此上数据库事务/RPC。
 */
async function assertNoConflicts(client: SupabaseClient, updates: ConfigUpdate[]): Promise<void> {
  const withExpected = updates.filter((update) => update.expected_updated_at !== undefined);
  if (withExpected.length === 0) return;

  const { data, error } = await client
    .from("app_config")
    .select("key, updated_at")
    .in(
      "key",
      withExpected.map((update) => update.key)
    );
  if (error) {
    throw new Error(
      `读取配置失败：${error.message}。若刚切换过启用项目，请检查项目地址是否可达，或在 mail 的 supabase-projects 接口停用它后重试`
    );
  }
  const currentByKey = new Map(
    ((data ?? []) as { key: string; updated_at: string | null }[]).map((row) => [row.key, row.updated_at])
  );

  const conflicts: string[] = [];
  for (const update of withExpected) {
    const current = currentByKey.get(update.key);
    if (current === undefined) continue; // 当前行不存在 → 无冲突，正常写入
    const expectedTime = new Date(update.expected_updated_at as string).getTime();
    if (Number.isNaN(expectedTime)) {
      throw new Error(`配置 ${update.key} 的 expected_updated_at 不是合法的时间字符串`);
    }
    const currentTime = current ? new Date(current).getTime() : 0;
    if (expectedTime !== currentTime) conflicts.push(update.key);
  }
  if (conflicts.length > 0) throw new ConfigConflictError(conflicts);
}

/**
 * 批量写入。约定：
 * - 带 expected_updated_at 的项先做乐观锁校验，有冲突整批拒绝（不产生任何部分写入）
 * - 敏感项（key 属于敏感映射）→ 加密后写；明文项（如 lmstudio_base_url）→ 原样写
 * - value 为 null → 删除该行（回到 env/默认值）
 * - upsert，并发安全
 */
export async function upsertConfig(updates: ConfigUpdate[]): Promise<{ written: number; skipped: string[] }> {
  const client = await getSupabaseServiceClientAsync();

  // 乐观锁检查必须发生在任何写入/删除之前，保证"整批拒绝"不留下部分写入
  await assertNoConflicts(client, updates);

  const rows: ConfigItemRow[] = [];
  const skipped: string[] = [];

  for (const update of updates) {
    const category = categoryOf(update.key);
    const isSecret = isSensitiveKey(update.key);
    if (update.value === null) {
      const { error } = await client.from("app_config").delete().eq("key", update.key);
      if (error) throw new Error(`删除配置 ${update.key} 失败：${error.message}`);
      continue;
    }
    if (isSecret) {
      if (typeof update.value !== "string") {
        skipped.push(update.key);
        continue;
      }
      // 掩码原样回传（用户没改这个字段）→ 跳过，避免把掩码存成新的"密钥"
      if (update.value.includes("…") || update.value === "•••") {
        skipped.push(update.key);
        continue;
      }
      rows.push({
        key: update.key,
        category,
        value: encryptSecret(update.value.trim()),
        is_secret: true,
        updated_at: new Date().toISOString(),
      });
    } else {
      rows.push({
        key: update.key,
        category,
        value: update.value,
        is_secret: false,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await client.from("app_config").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(`保存配置失败：${error.message}`);
  }
  return { written: rows.length, skipped };
}

/**
 * 给代码用的取值入口（数据库 > env > 默认）。
 * 将来 lib/llm 改造时调用它拿 key / 阈值等。
 */
export async function resolveConfigValue(key: string): Promise<unknown> {
  const envName = envNameOf(key);
  try {
    const client = await getSupabaseServiceClientAsync();
    const { data } = await client.from("app_config").select("value, is_secret").eq("key", key).maybeSingle();
    if (data) {
      const row = data as { value: unknown; is_secret: boolean };
      return row.is_secret && typeof row.value === "string" ? decryptSecret(row.value) : row.value;
    }
  } catch (err) {
    // 数据库不可用时静默落到 env/默认（读配置失败不应该让主流程崩）；
    // 但要留下日志，方便排查"为什么配置没生效"（见调试规范：不静默吞掉）
    console.warn(
      "[config-store] 读取数据库配置失败，回退 env/默认：",
      err instanceof Error ? err.message : err
    );
  }
  if (envName && process.env[envName]) return process.env[envName];
  return CONFIG_DEFAULTS[key] ?? null;
}

function categoryOf(key: string): ConfigCategory {
  const prefix = key.split(".")[0];
  if (prefix === "llm" || prefix === "pipeline" || prefix === "storage" || prefix === "mail") {
    return prefix;
  }
  return "general";
}
