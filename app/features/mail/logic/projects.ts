/**
 * supabase_projects 表的读写（PHASE2_SPEC 第 4.2 节）：多 Supabase 项目的增改、列出、切换启用。
 *
 * 约定（见 SPEC 第 1 / 6 节）：
 * - service_key 用 encryptSecret 加密存储，回显一律 maskSecret 掩码，永不回明文
 * - 写入用 upsert（冲突键 id），不做"先查存不存在再写"（并发安全，见 CLAUDE.md）
 * - 切换启用用两次 update（先清其他、再置目标），并发交给数据库唯一索引兜底
 */
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/shared/crypto";
import { MailDataError, MailNotFoundError, MailRequestError } from "./errors";
import { getMailDbClient } from "./store";

/** 给界面回显的项目形态：service_key 是掩码，has_service_key 表示库里到底有没有值 */
export interface SupabaseProjectView {
  id: string;
  label: string;
  project_url: string;
  anon_key: string | null;
  service_key: string | null;
  has_service_key: boolean;
  is_active: boolean;
  updated_at: string | null;
}

interface SupabaseProjectRow {
  id: string;
  label: string;
  project_url: string;
  anon_key: string | null;
  service_key: string | null;
  is_active: boolean;
  updated_at: string | null;
}

const PROJECT_COLUMNS = "id, label, project_url, anon_key, service_key, is_active, updated_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listSupabaseProjects(): Promise<SupabaseProjectView[]> {
  const client = getMailDbClient();
  const { data, error } = await client
    .from("supabase_projects")
    .select(PROJECT_COLUMNS)
    .order("is_active", { ascending: false })
    .order("label", { ascending: true });
  if (error) {
    throw new MailDataError(`读取 Supabase 项目列表失败：${error.message}（确认 supabase_projects 表已创建，见 PHASE2_SPEC 4.1）`);
  }
  return ((data ?? []) as SupabaseProjectRow[]).map(toProjectView);
}

export interface SaveSupabaseProjectInput {
  /** 不传 = 新增；传了 = 更新（upsert，id 不存在时会插入该 id 的新行） */
  id?: string;
  label: string;
  project_url: string;
  /** 公开信息，明文存；传空字符串 = 清空 */
  anon_key?: string;
  /** 密文存；不传或传空 = 不改动，传回掩码 = 用户没改这个字段 */
  service_key?: string;
}

export async function saveSupabaseProject(input: SaveSupabaseProjectInput): Promise<SupabaseProjectView> {
  const client = getMailDbClient();
  const row: Record<string, unknown> = {
    label: input.label,
    project_url: input.project_url,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;
  if (input.anon_key !== undefined) row.anon_key = input.anon_key === "" ? null : input.anon_key;

  // 掩码原样回传 = 用户没改这个字段：跳过，避免把掩码存成新的"密钥"（同 config-store 约定）
  if (input.service_key && !isMaskedSecret(input.service_key)) {
    row.service_key = encryptSecret(input.service_key);
  }

  const { data, error } = await client
    .from("supabase_projects")
    .upsert(row, { onConflict: "id" })
    .select(PROJECT_COLUMNS)
    .single();
  if (error) throw new MailDataError(`保存 Supabase 项目失败：${error.message}`);
  return toProjectView(data as SupabaseProjectRow);
}

export async function activateSupabaseProject(id: string): Promise<SupabaseProjectView> {
  const client = getMailDbClient();

  // 先确认目标存在：本系统没有删除项目的接口，这行不会被并发删掉，
  // 这样能避免"目标 id 打错时把当前启用项目清空、却什么也没启用"的副作用
  const { data: existing, error: existsError } = await client
    .from("supabase_projects")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existsError) throw new MailDataError(`查询要启用的项目失败：${existsError.message}`);
  if (!existing) throw new MailRequestError(`要启用的项目不存在：${id}`);

  const now = new Date().toISOString();

  // 先把其他启用项全部置 false（不先读当前启用的是谁，直接按条件写）
  const { error: clearError } = await client
    .from("supabase_projects")
    .update({ is_active: false, updated_at: now })
    .eq("is_active", true)
    .neq("id", id);
  if (clearError) throw new MailDataError(`切换启用项目失败（清理旧启用项）：${clearError.message}`);

  // 再把目标置 true；唯一索引保证同一时刻最多一条 true
  const { data, error } = await client
    .from("supabase_projects")
    .update({ is_active: true, updated_at: now })
    .eq("id", id)
    .select(PROJECT_COLUMNS)
    .maybeSingle();
  if (error) {
    // 23505 = 唯一索引冲突：另一个激活操作刚好并发插入，如实提示重试，不静默重跑
    if (error.code === "23505") {
      throw new MailRequestError("另一个启用操作刚刚发生，请稍后重试");
    }
    throw new MailDataError(`切换启用项目失败：${error.message}`);
  }
  if (!data) throw new MailRequestError(`要启用的项目不存在：${id}`);
  return toProjectView(data as SupabaseProjectRow);
}

export interface DeactivateSupabaseProjectsResult {
  /** 本次实际从启用变为停用的项目数（本来就没启用时为 0） */
  deactivated: number;
  /** 本次被停用的项目列表（与 GET 列表相同的掩码回显） */
  items: SupabaseProjectView[];
}

/**
 * 停用启用中的 Supabase 项目（可运维性恢复通道）：
 * - 传 id：只停用该项目；该项目不存在 → MailNotFoundError（HTTP 404）
 * - 不传 id：停用当前所有 is_active=true 的项目（"清空启用，回到环境变量"）
 *
 * 并发约定：写操作是条件 update（is_active=true [且 id=...]），不在代码里先读后写；
 * 预先按 id 查询仅为给出可读 404，不作为是否写入的依据（唯一索引只约束"最多一个 true"，
 * 置 false 不会触发冲突）。
 */
export async function deactivateSupabaseProjects(id?: string): Promise<DeactivateSupabaseProjectsResult> {
  const client = getMailDbClient();

  if (id) {
    const { data: existing, error: existsError } = await client
      .from("supabase_projects")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (existsError) throw new MailDataError(`查询要停用的项目失败：${existsError.message}`);
    if (!existing) throw new MailNotFoundError(`要停用的项目不存在：${id}`);
  }

  let query = client
    .from("supabase_projects")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("is_active", true);
  if (id) query = query.eq("id", id);

  const { data, error } = await query.select(PROJECT_COLUMNS);
  if (error) throw new MailDataError(`停用项目失败：${error.message}`);
  const items = ((data ?? []) as SupabaseProjectRow[]).map(toProjectView);
  return { deactivated: items.length, items };
}

/** 校验并整理新增/更新项目的请求体（api 层只负责解析 JSON，格式规则在这里） */
export function normalizeSaveProjectInput(body: Record<string, unknown>): SaveSupabaseProjectInput {
  const id = optionalString(body.id, "id");
  if (id && !UUID_PATTERN.test(id)) {
    throw new MailRequestError("id 必须是合法的 UUID（不传表示新增项目）");
  }
  const label = requiredString(body.label, "label");
  const projectUrl = stripTrailingSlashes(requiredString(body.project_url, "project_url"));
  assertHttpUrl(projectUrl);
  return {
    id,
    label,
    project_url: projectUrl,
    anon_key: optionalString(body.anon_key, "anon_key"),
    service_key: optionalString(body.service_key, "service_key"),
  };
}

/** 校验切换启用项目的请求体 */
export function normalizeActivateInput(body: Record<string, unknown>): { id: string } {
  const id = requiredString(body.id, "id");
  if (!UUID_PATTERN.test(id)) {
    throw new MailRequestError("id 必须是合法的 UUID");
  }
  return { id };
}

/** 校验停用项目的请求体：id 可省略（不传 = 停用所有启用项目），传了必须是合法 UUID */
export function normalizeDeactivateInput(body: Record<string, unknown>): { id?: string } {
  const raw = optionalString(body.id, "id");
  // 空字符串是 GUI"字段存在但没选值"的常见序列化结果；如果静默当成"不传"，
  // 一个 UI 小失误就会把全部项目停掉——明确报错，让调用方自己决定是省略 id 还是传 UUID
  if (raw !== undefined && raw === "") {
    throw new MailRequestError(
      "id 不能是空字符串：要停用全部启用项目请省略 id 字段，要停用单个项目请传合法 UUID"
    );
  }
  const id = raw || undefined;
  if (id && !UUID_PATTERN.test(id)) {
    throw new MailRequestError("id 必须是合法的 UUID（不传表示停用所有启用项目）");
  }
  return { id };
}

function toProjectView(row: SupabaseProjectRow): SupabaseProjectView {
  return {
    id: row.id,
    label: row.label,
    project_url: row.project_url,
    anon_key: row.anon_key,
    service_key: row.service_key ? maskStoredSecret(row.service_key) : null,
    has_service_key: Boolean(row.service_key),
    is_active: row.is_active,
    updated_at: row.updated_at,
  };
}

// 库里的 service_key 是密文：解密后打码。解不开（换了主密钥/密文坏了）显示占位，不让整个列表接口失败
function maskStoredSecret(cipher: string): string {
  try {
    return maskSecret(decryptSecret(cipher));
  } catch {
    return "•••";
  }
}

function isMaskedSecret(value: string): boolean {
  return value.includes("…") || value === "•••";
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new MailRequestError(`${field} 必须是非空字符串`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new MailRequestError(`${field} 必须是字符串`);
  return value.trim();
}

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function assertHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MailRequestError("project_url 不是合法的网址（形如 https://xxxx.supabase.co）");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new MailRequestError("project_url 必须以 http:// 或 https:// 开头");
  }
}
