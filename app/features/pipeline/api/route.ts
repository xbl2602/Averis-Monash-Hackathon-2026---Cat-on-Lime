import { NextRequest, NextResponse } from "next/server";
import { getWriteAccess } from "@/lib/shared/write-policy";
import { normalizeBatchRequest, runPipelineBatch } from "../logic";
import { BatchRequestError } from "../logic/errors";
import { toErrorResponse } from "./params";

/**
 * POST /features/pipeline/api
 * Trigger a full-shipment batch verification run: sample emails -> classify/extract/compare -> upsert
 * into verification_results by email_id.
 * Request body (JSON, all optional; omit = full incremental run, max 50 emails per call):
 *   { email_ids: ["email_004"], limit: 20, force: false, dry_run: false,
 *     provider: "gemini", concurrency: 4 }
 * Write mode (dry_run=false) requires the x-admin-token header; anonymous visitors can use dry_run=true to preview (capped at 20 emails per call).
 * Response (RunBatchSummary): selected / skipped / ran / succeeded / failed / wrote / remaining /
 * stopped_by_deadline ... (contract in the "pipeline module (batch entry point)" section of SHARED_INTERFACES.md)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby functions cap out at 60s: the full shipment relies on chunking + a 30s deadline across multiple calls (remaining in the response shows how much is left)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody(req);
    const request = normalizeBatchRequest(body);

    // Write mode: validate the token first (403 not configured / 401 wrong token); anonymous callers may only use dry_run to preview
    const access = getWriteAccess(req.headers);
    if (!request.dryRun && !access.authorized) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    return NextResponse.json(
      await runPipelineBatch(request, { anonymous: !access.authorized })
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** When a browser/tool opens this address directly, return the endpoint usage description (no processing is performed) */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/pipeline/api",
    method: "POST",
    description:
      "Trigger a full-shipment batch verification run (classify -> extract -> compare -> write results table). Full set is 520 emails, unchanged ones are skipped incrementally, max limit emails per call; " +
      "checks a 30s deadline after each chunk, and stops picking up new chunks once reached (the response's stopped_by_deadline/remaining reflect this accurately). " +
      "Write mode requires x-admin-token; anonymous callers can use dry_run=true to preview (capped at 20 emails per call, no writes)",
    headers: {
      "x-admin-token": "Required for write mode (dry_run=false); write operations are always rejected if the server has no ADMIN_TOKEN configured",
    },
    body: {
      email_ids: "string[], only run these emails; omit = all sample emails (cannot be combined with retry_failed)",
      limit: "1~520, default 50 (max emails per call; anonymous dry_run is further capped at 20)",
      force: "boolean, default false; true = ignore the incremental fingerprint and force recomputation",
      dry_run:
        "boolean, default false; true = only compute, don't write to the database (no service key needed; anonymous = preview, max 20 emails per call)",
      provider: "claude | openai | deepseek | gemini | lmstudio (text fallback model), default gemini",
      concurrency: "1~8, default 4 (max emails processed at once, also the chunk size)",
      retry_failed:
        "boolean, default false; true = one-click retry of every email in the results table that failed processing or was degraded (the list is picked automatically by the server, cannot be combined with email_ids)",
    },
    example: {
      email_ids: ["email_004", "email_107"],
      limit: 10,
      dry_run: true,
    },
  });
}

async function parseJsonBody(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new BatchRequestError("The request body is not valid JSON");
  }
}
