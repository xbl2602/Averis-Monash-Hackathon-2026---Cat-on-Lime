/**
 * POST /features/mail/api/supabase-projects/activate  切换启用项目（写保护）
 * body: { id }
 *
 * 并发约定（SPEC 第 6 节）：不在代码里"先读当前启用项再改"，而是直接
 * ① 把其他项目 is_active 置 false ② 把目标置 true；数据库唯一索引
 * supabase_projects_single_active 保证同一时刻最多一条 true。
 * 响应：{ project: SupabaseProjectView }（service_key 是掩码）。
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { activateSupabaseProject, normalizeActivateInput } from "../../../logic";
import { parseJsonBody, toErrorResponse } from "../../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const body = await parseJsonBody(request);
    const project = await activateSupabaseProject(normalizeActivateInput(body).id);
    return NextResponse.json({ project });
  } catch (err) {
    return toErrorResponse(err);
  }
}
