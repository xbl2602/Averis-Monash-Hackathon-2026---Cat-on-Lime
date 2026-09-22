/**
 * ⚠️ Developer mode: POST /features/devmode/api/restore
 * Wipes every verification data table, then reimports the official sample emails + attachments
 * (raw_emails/parsed_attachments) from data/sample/. This implements the "little button that restores
 * the official test-set look": after restoring, the database state is equivalent to having just run
 * `npm run import:data` — verification_results is empty (classification/extraction/comparison haven't
 * run), and results only appear after manually running the batch pipeline afterward. This endpoint
 * deliberately does not run that pipeline itself (to avoid silently consuming LLM call quota).
 *
 * Two gates: x-admin-token + the request body's { "confirm": "RESTORE SAMPLE DATA" } must match exactly.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import { toClientError } from "@/lib/shared/request-errors";
import {
  assertConfirmPhrase,
  DEVMODE_WARNING,
  RESTORE_CONFIRM_PHRASE,
  restoreToOfficialSample,
} from "../../logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fully re-parses attachments for 520 emails (concurrency 5), slower than a typical request, so allow enough time
export const maxDuration = 60;

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
    assertConfirmPhrase(body, RESTORE_CONFIRM_PHRASE);
    const result = await restoreToOfficialSample();
    return NextResponse.json({ warning: DEVMODE_WARNING, ...result });
  } catch (err) {
    const { status, message } = toClientError(err);
    return NextResponse.json({ error: message }, { status });
  }
}

/** Gives usage instructions when opened directly in a browser; performs no action */
export async function GET() {
  return NextResponse.json({
    warning: DEVMODE_WARNING,
    endpoint: "/features/devmode/api/restore",
    method: "POST",
    description:
      "Wipes every verification data table, then reimports the official sample emails+attachments from data/sample/, restoring to the just-imported state before the pipeline has run. Irreversible and takes a while (all attachments must be re-parsed).",
    headers: { "x-admin-token": "Required, same as other write operations" },
    body: { confirm: `Required, must equal "${RESTORE_CONFIRM_PHRASE}" exactly` },
  });
}
