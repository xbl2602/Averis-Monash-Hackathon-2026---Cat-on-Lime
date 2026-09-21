/**
 * ⚠️ 开发者模式（devmode）：不是本产品的正式功能，仅供团队/评委在验证阶段查看和重置数据。
 * 见 docs/SHARED_INTERFACES.md「开发者模式（仅内部使用）」一节的完整警示与边界。
 *
 * GET /features/devmode/api  查看各数据表当前行数（需要 x-admin-token；只读，不改数据）
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { toClientError } from "@/lib/shared/request-errors";
import { getDevModeStatus } from "../logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const status = await getDevModeStatus();
    return NextResponse.json(status);
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
