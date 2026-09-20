/**
 * app_config 表的读写（第二阶段 SPEC 第 3 节）。
 *
 * 分层：api/ 只解析请求，逻辑在这里；LLM 调用层未来通过这里的 resolveConfigValue 取值。
 * 并发约定：写入用 upsert（key 唯一），带 update 时间戳；不做"先查再写"。
 */
import { getSupabaseServiceClient, isSupabaseServiceAvailable } from "./supabase";
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
 * 只列"允许被数据库覆盖"的项；数据库没值时界面显示 env 现值（掩码）。
 */
const ENV_FALLBACK: Record<string, string> = {
  "llm.anthropic_api_key": "ANTHROPIC_API_KEY",
  "llm.openai_api_key": "OPENAI_API_KEY",
  "llm.deepseek_api_key": "DEEPSEEK_API_KEY",
  "llm.gemini_api_key": "GOOGLE_GENERATIVE_AI_API_KEY",
  "llm.typesafe_api_key": "TYPESAFE_API_KEY",
  "llm.lmstudio_base_url": "LM_STUDIO_BASE_URL",
};

/** 代码默认值：数据库/env 都没有时界面显示"未配置"或默认 */
export const CONFIG_DEFAULTS: Record<string, unknown> = {
  "llm.provider_priority": ["rules", "jev", "claude"],
  "llm.jev.confidence_threshold": 0.85,
  "llm.default_provider": "claude",
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
  const client = getSupabaseServiceClient();
  let query = client.from("app_config").select("key, category, value, is_secret, updated_at");
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) {
    throw new Error(`读取配置失败：${error.message}（确认 app_config 表已创建，见 PHASE2_SPEC.md 第 3.1 节）`);
  }
  const rows = (data ?? []) as ConfigItemRow[];
  const byKey = new Map(rows.map((row) => [row.key, row]));

  const keys = Array.from(new Set([...byKey.keys(), ...Object.keys(ENV_FALLBACK), ...Object.keys(CONFIG_DEFAULTS)]));
  return keys
    .filter((key) => !category || byKey.get(key)?.category === category)
    .map((key) => {
      const row = byKey.get(key);
      const envName = ENV_FALLBACK[key];
      const envValue = envName ? process.env[envName] : undefined;
      const fallback = envValue || CONFIG_DEFAULTS[key];

      if (row) {
        return {
          key,
          category: row.category,
          value: row.is_secret && typeof row.value === "string" ? maskDecrypted(row.value) : row.value,
          is_secret: row.is_secret,
          has_value: row.value !== null && row.value !== "",
          source: "db" as const,
          updated_at: row.updated_at,
        };
      }
      if (fallback !== undefined && fallback !== "") {
        const isSecret = Boolean(envName);
        return {
          key,
          category: category ?? "llm",
          value: isSecret ? maskSecret(String(fallback)) : fallback,
          is_secret: isSecret,
          has_value: true,
          source: envName ? ("env" as const) : ("default" as const),
          updated_at: null,
        };
      }
      return {
        key,
        category: category ?? "llm",
        value: null,
        is_secret: Boolean(envName),
        has_value: false,
        source: "unset" as const,
        updated_at: null,
      };
    });
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
}

/**
 * 批量写入。约定：
 * - 敏感项（is_secret 表里已有或 key 属于 ENV_FALLBACK）→ 加密后写
 * - value 为 null → 删除该行（回到 env/默认值）
 * - upsert，并发安全
 */
export async function upsertConfig(updates: ConfigUpdate[]): Promise<{ written: number; skipped: string[] }> {
  const client = getSupabaseServiceClient();
  const rows: ConfigItemRow[] = [];
  const skipped: string[] = [];

  for (const update of updates) {
    const category = categoryOf(update.key);
    const isSecret = Boolean(ENV_FALLBACK[update.key]);
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
  const envName = ENV_FALLBACK[key];
  try {
    const client = getSupabaseServiceClient();
    const { data } = await client.from("app_config").select("value, is_secret").eq("key", key).maybeSingle();
    if (data) {
      const row = data as { value: unknown; is_secret: boolean };
      return row.is_secret && typeof row.value === "string" ? decryptSecret(row.value) : row.value;
    }
  } catch {
    // 数据库不可用时静默落到 env/默认（读配置失败不应该让主流程崩）
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
