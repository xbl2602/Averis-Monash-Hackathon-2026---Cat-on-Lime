/**
 * ⚠️ Developer mode: POST /features/devmode/api/wipe
 * Wipes every verification data table (leaves connection configuration like
 * app_config/mail_accounts/supabase_projects untouched).
 * Irreversible — after wiping, the only way to get the sample data back is
 * /features/devmode/api/restore or rerunning npm run import:data; the manual review records in
 * verification_results are lost permanently, with no backup mechanism.
 *
 * Two gates: the x-admin-token header (same as other write operations) + the request body's
 * { "confirm": "WIPE ALL DATA" } must match exactly — both must be satisfied before it actually runs.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { toClientError } from "@/lib/shared/request-errors";
import { assertConfirmPhrase, DEVMODE_WARNING, WIPE_CONFIRM_PHRASE, wipeAllData } from "../../logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  try {
    assertConfirmPhrase(body, WIPE_CONFIRM_PHRASE);
    const wiped = await wipeAllData();
    return NextResponse.json({ warning: DEVMODE_WARNING, wiped });
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** Gives usage instructions when opened directly in a browser; performs no action */
export async function GET() {
  return NextResponse.json({
    warning: DEVMODE_WARNING,
    endpoint: "/features/devmode/api/wipe",
    method: "POST",
    description: "Wipes every verification data table. Irreversible. Callable only from the developer-mode page — not an official product feature.",
    headers: { "x-admin-token": "Required, same as other write operations" },
    body: { confirm: `Required, must equal "${WIPE_CONFIRM_PHRASE}" exactly` },
  });
}
