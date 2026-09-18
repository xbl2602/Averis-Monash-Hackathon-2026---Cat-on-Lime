import { createClient } from "@supabase/supabase-js";

/**
 * Supabase 客户端（浏览器/服务端通用的 anon key 版本）。
 * 需要在 .env.local 里配置 NEXT_PUBLIC_SUPABASE_URL 和
 * NEXT_PUBLIC_SUPABASE_ANON_KEY（见 .env.example）。
 * 目前项目里还没有真实的 Supabase 项目/表结构，这里只是占位好连接方式，
 * 等题目相关的数据库设计定下来再建表。
 */
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "缺少 Supabase 环境变量：请在 .env.local 里配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createClient(url, anonKey);
}
