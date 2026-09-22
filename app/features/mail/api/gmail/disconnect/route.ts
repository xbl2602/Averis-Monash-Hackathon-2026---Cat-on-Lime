/**
 * POST /features/mail/api/gmail/disconnect
 * Disconnect Gmail (write-protected): clears the access/refresh tokens and sets status to disconnected.
 * Uses upsert (by the fixed account id), so it's safe to call even if never connected before.
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
