/**
 * POST /features/mail/api/supabase-projects/deactivate  停用启用项目（写保护）
 * body: { id? }
 *
 * 用途（可运维性恢复通道）：激活了一个地址不可达/凭据错误的 Supabase 项目后，
 * 所有走 getSupabaseServiceClientAsync() 的接口都会失败；本接口负责"退回去"：
 * - 传 id：只停用该项目（项目不存在 → 404 可读错误）
 * - 不传 id：停用当前所有 is_active=true 的项目，回到环境变量方案
 *
 * 并发约定（SPEC 第 6 节）：条件 update（is_active=true [且 id=...]），不先读后写。
 * 响应：{ deactivated: number, items: [...] }（service_key 是掩码，与 GET 列表一致）。
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { deactivateSupabaseProjects, normalizeDeactivateInput } from "../../../logic";
import { parseJsonBody, toErrorResponse } from "../../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await parseJsonBody(request);
    const result = await deactivateSupabaseProjects(normalizeDeactivateInput(body).id);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
