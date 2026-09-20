import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "./crypto";

/**
 * Supabase 客户端（浏览器/服务端通用的 anon key 版本，只读）。
 * 需要在 .env.local 里配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。
 */
export function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "缺少 Supabase 环境变量：请在 .env.local 里配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(url, anonKey);
}

/**
 * 服务端专用客户端（service role key）：写库、调用缓存、批量任务用。
 * 这个 key 权限很高：不能加 NEXT_PUBLIC_ 前缀、不能给浏览器用，只在服务端/本地脚本里用。
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY：写库/缓存/批量任务需要 service role key（见 .env.example）"
    );
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// 当前环境有没有配 service role key（没配时缓存等功能自动降级，不影响主流程）
export function isSupabaseServiceAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** 当前生效的 Supabase 配置：启用项目优先，其次环境变量。serviceKey 已解密或为 null */
export interface ActiveSupabaseConfig {
  url: string;
  /** 项目行没配 anon key 时为空字符串（不做跨项目回退，避免拿错项目的 key） */
  anonKey: string;
  /** 项目行没配或 env 没配时为 null；解密失败会直接抛错，不会回退到别的项目凭据 */
  serviceKey: string | null;
}

/**
 * 解析当前生效的 Supabase 配置（第二阶段 SPEC 4.2）：
 * supabase_projects.is_active=true 的那条 > 环境变量。
 *
 * 关键点：读 supabase_projects 本身必须用"只依赖环境变量"的 getSupabaseServiceClient()，
 * 否则会变成"要读数据库里的配置才能知道用哪个数据库"的自依赖（PHASE2_SPEC 4.2）。
 * 表还没建好/暂时读不到时回退环境变量，并在控制台留下日志（不静默吞掉失败）。
 */
export async function getActiveSupabaseConfig(): Promise<ActiveSupabaseConfig | null> {
  const active = await readActiveProjectConfig();
  if (active) return active;
  return readEnvSupabaseConfig();
}

async function readActiveProjectConfig(): Promise<ActiveSupabaseConfig | null> {
  let client: SupabaseClient;
  try {
    client = getSupabaseServiceClient();
  } catch {
    return null; // 引导项目（env）都没配，谈不上有启用项目
  }
  const { data, error } = await client
    .from("supabase_projects")
    .select("project_url, anon_key, service_key")
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.warn(`[supabase] 读取启用项目失败，改用环境变量：${error.message}`);
    return null;
  }
  if (!data) return null;

  const row = data as { project_url: string; anon_key: string | null; service_key: string | null };
  return {
    url: row.project_url,
    anonKey: row.anon_key ?? "",
    // 解密失败直接抛错：绝不能悄悄换个项目的凭据去写数据（会写到错误的库）
    serviceKey: row.service_key ? decryptSecret(row.service_key) : null,
  };
}

function readEnvSupabaseConfig(): ActiveSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return {
    url,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
  };
}

/**
 * 用当前生效项目的配置创建 service client（写库/批量任务用）。
 * 和同步版 getSupabaseServiceClient 的区别：优先走数据库里启用的项目。
 * 每次调用现解析现建，不做模块级缓存（无服务器多实例环境，见 CLAUDE.md 高并发一节）。
 */
export async function getSupabaseServiceClientAsync(): Promise<SupabaseClient> {
  const config = await getActiveSupabaseConfig();
  if (!config) {
    throw new Error(
      "没有可用的 Supabase 配置：请配置环境变量（见 .env.example），或在 /features/mail/api/supabase-projects 启用一个项目"
    );
  }
  if (!config.serviceKey) {
    throw new Error(
      `Supabase 项目 ${config.url} 没有可用的 service key（service_key 未配置或无法解密）：写库/批量任务需要它，请检查 supabase_projects 表或环境变量 SUPABASE_SERVICE_ROLE_KEY`
    );
  }
  return createClient(config.url, config.serviceKey, { auth: { persistSession: false } });
}
