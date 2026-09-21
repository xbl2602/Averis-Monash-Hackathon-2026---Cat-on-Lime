/**
 * POST /features/config/api/verify  只校验 x-admin-token，不读不写任何数据（无副作用）。
 *
 * 背景：队友A接 GUI 时发现"要不要显示写权限已解锁"没有专用接口，只能借用
 * "带空更新列表的 PUT /features/config/api"（口令对 → 400，因为没传任何要更新的字段），
 * 这会在浏览器控制台留一行看着像出错的 400 网络请求。这个接口专门给"校验口令"用，
 * 口令对就是 200，不产生那条误导性的日志。
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true });
}

/** 浏览器直接打开时给出用法说明 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/config/api/verify",
    method: "POST",
    description: "只校验 x-admin-token 对不对，不读不写任何数据。200=口令对，401=口令错，403=服务端未配置 ADMIN_TOKEN。",
  });
}
