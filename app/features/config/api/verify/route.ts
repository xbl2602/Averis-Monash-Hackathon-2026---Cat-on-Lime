/**
 * POST /features/config/api/verify  Validates only the x-admin-token; reads and writes no data (no side effects).
 *
 * Background: while wiring up the GUI, teammate A found there was no dedicated endpoint for
 * "should write access show as unlocked" — the only option was to reuse "PUT /features/config/api
 * with an empty update list" (correct token → 400, because no fields to update were sent), which
 * leaves a network request in the browser console that looks like a 400 error. This endpoint exists
 * specifically for "validate the token": a correct token just returns 200, with no misleading log entry.
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

/** Gives usage instructions when opened directly in a browser */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/config/api/verify",
    method: "POST",
    description: "Validates only whether x-admin-token is correct; reads and writes no data. 200 = correct token, 401 = wrong token, 403 = ADMIN_TOKEN not configured on the server.",
  });
}
