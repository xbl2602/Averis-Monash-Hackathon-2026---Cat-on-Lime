/**
 * ⚠️ Developer mode (devmode): not an official feature of this product, for the team/judges to
 * view and reset data during verification only.
 * See the full warnings and boundaries in the "Developer mode (internal use only)" section of
 * docs/SHARED_INTERFACES.md.
 *
 * GET /features/devmode/api  View the current row count of each data table (requires x-admin-token; read-only, changes no data)
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
