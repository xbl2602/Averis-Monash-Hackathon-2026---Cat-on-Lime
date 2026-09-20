/**
 * 写操作的统一口令校验（REST 路由用）。
 *
 * 策略本身已下沉到 [`lib/shared/write-policy.ts`](write-policy.ts)（与传输方式无关，
 * REST 和 MCP 汇总层共用同一份判定）；这里只保留"拒绝时包成 NextResponse"这一层薄封装，
 * 现有调用点（config / mail / import / pipeline）不需要改动。
 */
import { NextResponse } from "next/server";
import { getWriteAccess } from "./write-policy";

export function requireAdmin(request: Request): NextResponse | null {
  const access = getWriteAccess(request.headers);
  if (access.authorized) return null;
  return NextResponse.json({ error: access.message }, { status: access.status });
}
