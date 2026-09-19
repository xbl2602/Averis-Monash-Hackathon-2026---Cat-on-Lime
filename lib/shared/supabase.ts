import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
