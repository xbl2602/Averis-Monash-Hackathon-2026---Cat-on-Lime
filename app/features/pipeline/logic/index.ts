/**
 * The single implementation of the batch entry point (full-shipment pipeline): both REST (api/) and MCP (mcp/) call only into here.
 *
 * All orchestration is delegated to the shared capabilities in lib/shared; this module is only
 * responsible for the flow of "request -> select emails -> skip incrementally -> run in
 * rate-limited concurrent chunks -> upsert results in batches -> summarize the response" — it
 * doesn't reimplement any engine logic:
 * - lib/shared/sample-inputs.ts       reads sample emails + parses attachments
 * - lib/shared/pipeline.ts            single-email/batch pipeline, input fingerprinting, engine version
 * - lib/shared/verification-store.ts  results table read/write (upsert)
 *
 * Chunking and the deadline (2026-09-20 performance/reliability review):
 * - Each chunk size = one concurrency wave (max(1, concurrency)); the deadline is only checked once
 *   a chunk finishes, so the worst-case duration of an "in-flight chunk" has an upper bound (no more
 *   of the runaway-chunk problem we used to see with 10 emails x 4 calls x 20s)
 * - Result rows are upserted once they reach FLUSH_EVERY; a final flush happens on deadline-stop or completion
 * - ran/remaining are both computed from the "actual completed count" (processed), so a deadline
 *   truncation never falsely reports everything as done (the B1 fix)
 */
import {
  PIPELINE_LOGIC_VERSION,
  computeInputHash,
  runBatchPipeline,
  type PipelineEmailInput,
} from "@/lib/shared/pipeline";
import { listSampleEmailIds, loadSamplePipelineInputs } from "@/lib/shared/sample-inputs";
import { isSupabaseServiceAvailable } from "@/lib/shared/supabase";
import {
  buildFailureRow,
  buildSuccessRow,
  describeError,
  loadStoredVerificationRows,
  upsertVerificationRows,
  type VerificationResultRow,
} from "@/lib/shared/verification-store";
import { BatchRequestError, StoreUnavailableError } from "./errors";
import {
  ANONYMOUS_DRY_RUN_MAX_LIMIT,
  BATCH_DEADLINE_MS,
  BATCH_MAX_FAILURES,
  FLUSH_EVERY,
  type BatchFailure,
  type RunBatchRequest,
  type RunBatchSummary,
} from "./types";

export { normalizeBatchRequest } from "./params";
export { BatchRequestError, StoreUnavailableError } from "./errors";
export type { BatchFailure, RunBatchRequest, RunBatchSummary } from "./types";

export interface RunPipelineBatchOptions {
  /** Whether this call is anonymous (no x-admin-token); only affects the dry_run preview cap and the remaining calculation */
  anonymous?: boolean;
}

export async function runPipelineBatch(
  request: RunBatchRequest,
  options: RunPipelineBatchOptions = {}
): Promise<RunBatchSummary> {
  const startedAt = Date.now();

  // Needs to write to the database but has no service key: reject before running any model calls, so we don't waste call quota for nothing
  if (!request.dryRun && !isSupabaseServiceAvailable()) {
    throw new StoreUnavailableError(
      "Batch processing writes to the results table, but the current environment is missing SUPABASE_SERVICE_ROLE_KEY; pass dry_run=true if you only want to compute without writing"
    );
  }

  const allIds = await listSampleEmailIds();
  // One-click retry (P0-2/P1-9): the target list is picked by the server from the results table (failed or degraded), and recomputation is forced
  const resolved = request.retryFailed
    ? { ...request, emailIds: await resolveRetryEmailIds(new Set(allIds)), force: true }
    : request;
  validateRequestedIds(resolved.emailIds, allIds);
  const scope = resolved.emailIds ?? allIds;

  // Anonymous dry_run only previews a fixed-size prefix of the head of the list: truncate the ids before parsing, so an anonymous request never reads/runs the whole shipment
  const anonymousPreview = options.anonymous === true && resolved.dryRun;
  const effectiveIds = anonymousPreview
    ? scope.slice(0, Math.min(resolved.limit, ANONYMOUS_DRY_RUN_MAX_LIMIT))
    : resolved.emailIds;

  const inputs = await loadSamplePipelineInputs(effectiveIds);
  const hashByEmail = new Map<string, string>();
  const { toRun, skipped } = await selectToRun(inputs, resolved, hashByEmail);

  // The "target" for remaining: for an anonymous preview = the size of this run's scope; otherwise = the total pending after incremental filtering
  const target = anonymousPreview ? scope.length : toRun.length;
  const batch = toRun.slice(0, resolved.limit);

  // Each chunk = one concurrency wave; the deadline (30s) is checked after each chunk, and no new chunk is picked up once reached
  const chunkSize = Math.max(1, resolved.concurrency);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let wrote = 0;
  let pendingRows: VerificationResultRow[] = [];
  let deadlineReached = false;
  const failures: BatchFailure[] = [];

  for (let offset = 0; offset < batch.length; offset += chunkSize) {
    const chunk = batch.slice(offset, offset + chunkSize);
    const outcome = await runBatchPipeline(chunk, {
      concurrency: resolved.concurrency,
      textProvider: resolved.provider,
    });

    processed += outcome.succeeded.length + outcome.failed.length;
    succeeded += outcome.succeeded.length;
    failed += outcome.failed.length;
    appendFailures(failures, outcome.failed);

    if (!resolved.dryRun) {
      pendingRows.push(
        ...outcome.succeeded.map(({ input, outcome: pipelineOutcome }) =>
          buildSuccessRow(input, pipelineOutcome, inputHashOf(hashByEmail, input))
        ),
        ...outcome.failed.map(({ input, error }) =>
          buildFailureRow(input, error, inputHashOf(hashByEmail, input))
        )
      );
      if (pendingRows.length >= FLUSH_EVERY) {
        wrote += await flushPendingRows(pendingRows);
        pendingRows = [];
      }
    }

    if (Date.now() - startedAt >= BATCH_DEADLINE_MS) {
      deadlineReached = true;
      break;
    }
  }

  // Stopped by the deadline or finished entirely: flush whatever's left unwritten (dry_run never writes)
  if (!resolved.dryRun && pendingRows.length > 0) {
    wrote += await flushPendingRows(pendingRows);
    pendingRows = [];
  }

  const stoppedByDeadline = deadlineReached && processed < target;

  return {
    total_emails: allIds.length,
    selected: inputs.length,
    skipped,
    ran: processed,
    succeeded,
    failed,
    wrote,
    remaining: Math.max(0, target - processed),
    stopped_by_deadline: stoppedByDeadline,
    dry_run: resolved.dryRun,
    logic_version: PIPELINE_LOGIC_VERSION,
    duration_ms: Date.now() - startedAt,
    failures,
  };
}

/**
 * Incremental selection: an email is skipped outright when its content fingerprint and engine
 * version are both unchanged and the previous result was a success.
 * No incremental filtering happens for dry_run / force (everything goes into this run's pending list).
 */
async function selectToRun(
  inputs: PipelineEmailInput[],
  request: RunBatchRequest,
  hashByEmail: Map<string, string>
): Promise<{ toRun: PipelineEmailInput[]; skipped: number }> {
  if (request.dryRun || request.force) {
    for (const input of inputs) {
      hashByEmail.set(input.email.email_id, computeInputHash(input));
    }
    return { toRun: inputs, skipped: 0 };
  }

  const stored = await loadStoredVerificationRows();
  const toRun: PipelineEmailInput[] = [];
  let skipped = 0;

  for (const input of inputs) {
    const hash = computeInputHash(input);
    const row = stored.get(input.email.email_id);
    const unchanged =
      row &&
      row.processing_status === "ok" &&
      row.input_hash === hash &&
      row.logic_version === PIPELINE_LOGIC_VERSION;

    if (unchanged) {
      skipped += 1;
      continue;
    }
    hashByEmail.set(input.email.email_id, hash);
    toRun.push(input);
  }
  return { toRun, skipped };
}

/** At most BATCH_MAX_FAILURES failure details are kept (the rest can be seen via the failed count and the results table) */
function appendFailures(
  failures: BatchFailure[],
  failedRows: { input: PipelineEmailInput; error: unknown }[]
): void {
  for (const entry of failedRows) {
    if (failures.length >= BATCH_MAX_FAILURES) return;
    failures.push({
      email_id: entry.input.email.email_id,
      error: describeError(entry.error),
    });
  }
}

/** One batch of result rows is upserted per chunk; returns the number of rows actually written (accumulated by the caller into wrote) */
async function flushPendingRows(rows: VerificationResultRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await upsertVerificationRows(rows);
  return rows.length;
}

/**
 * Targets for the one-click retry (2026-09-21 P0-2/P1-9): rows in the results table that "failed
 * processing" or were "degraded".
 * Degraded = model_provider contains degraded (classification fell back as best-effort after
 * total failure / comparison conservatively degraded after Jev failed).
 * Only picks ids that still exist in the sample list, returns them sorted; recomputation is
 * uniformly forced afterward with force=true.
 */
async function resolveRetryEmailIds(knownIds: Set<string>): Promise<string[]> {
  const stored = await loadStoredVerificationRows();
  const ids: string[] = [];
  for (const row of stored.values()) {
    const degraded = (row.model_provider ?? "").includes("degraded");
    if ((row.processing_status === "failed" || degraded) && knownIds.has(row.email_id)) {
      ids.push(row.email_id);
    }
  }
  return ids.sort();
}

function validateRequestedIds(requested: string[] | undefined, allIds: string[]): void {
  if (!requested) return;
  const known = new Set(allIds);
  const unknown = requested.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new BatchRequestError(`These emails aren't in the sample data: ${unknown.join(" / ")}`);
  }
}

function inputHashOf(hashByEmail: Map<string, string>, input: PipelineEmailInput): string {
  const hash = hashByEmail.get(input.email.email_id);
  if (!hash) {
    throw new Error(`Internal error: email ${input.email.email_id} is missing its input fingerprint`);
  }
  return hash;
}
