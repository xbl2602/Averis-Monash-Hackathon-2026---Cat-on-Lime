/**
 * POST /features/mail/api/gmail/disconnect
 * 断开 Gmail（写保护）：清空 access/refresh token、status 置 disconnected。
 * 用 upsert（按固定账户 id），从未连接过也能安全调用。
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { disconnectGmail } from "../../../logic";
import { toErrorResponse } from "../../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    return NextResponse.json(await disconnectGmail());
  } catch (err) {
    return toErrorResponse(err);
  }
}
