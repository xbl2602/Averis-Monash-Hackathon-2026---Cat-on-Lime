/**
 * mail 模块的数据库入口：所有表读写都从这里拿客户端（无状态，每次现建）。
 *
 * 为什么固定用"只依赖环境变量"的同步客户端：
 * supabase_projects 是"哪个项目启用"的管理表，它自己必须待在引导项目（env 配的那个）里，
 * 否则会自依赖——要知道用哪个项目，得先读这张表。切换 is_active 影响的是业务数据层的解析
 * （lib/shared/supabase.ts 的 getActiveSupabaseConfig / getSupabaseServiceClientAsync），
 * 不是这张表的位置（见 PHASE2_SPEC 4.2）。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient, isSupabaseServiceAvailable } from "@/lib/shared/supabase";
import { MailStoreUnavailableError } from "./errors";

export function isMailStoreAvailable(): boolean {
  return isSupabaseServiceAvailable();
}

export function getMailDbClient(): SupabaseClient {
  try {
    return getSupabaseServiceClient();
  } catch (err) {
    throw new MailStoreUnavailableError(
      `邮件模块不可用：${err instanceof Error ? err.message : "Supabase 服务端客户端初始化失败"}`
    );
  }
}
