/**
 * Types and constants for the batch entry point (full-shipment pipeline).
 *
 * The external contract (POST /features/pipeline/api and the MCP tool run_batch) is written in the
 * "pipeline module (batch entry point)" section of SHARED_INTERFACES.md — keep both in sync when changing either.
 */
import type { LLMProvider } from "@/lib/llm";

/** Max emails per run (the sample data totals 520 emails) */
export const BATCH_MAX_LIMIT = 520;
/** Default value when limit isn't passed: controls how long a single call takes, with large jobs called in batches (remaining is in the response) */
export const BATCH_DEFAULT_LIMIT = 50;
/** Max number processed concurrently (see the "high concurrency" rate-limiting requirement in CLAUDE.md) */
export const BATCH_MAX_CONCURRENCY = 8;
export const BATCH_DEFAULT_CONCURRENCY = 4;
/** Max number of failure details listed in the response (the rest can be seen via the failed count and the results table) */
export const BATCH_MAX_FAILURES = 20;

/**
 * Max number of emails an anonymous dry_run preview may parse/process.
 * An anonymous request's (no x-admin-token) dry_run may only look at a fixed-size prefix of the head
 * of the list, to prevent an anonymous visitor from parsing+running the entire 520-email shipment in
 * one go (per the security/performance review).
 */
export const ANONYMOUS_DRY_RUN_MAX_LIMIT = 20;

/**
 * Soft deadline for a batch run (milliseconds): checked **after each chunk finishes**; once reached,
 * no new chunk is picked up.
 * The platform function cap is 60s; this leaves headroom for the response/database write. The chunk
 * already in flight isn't bound by it (see SHARED_INTERFACES).
 */
export const BATCH_DEADLINE_MS = 30_000;

/**
 * Max number of result rows to accumulate in memory before upserting (when !dryRun).
 * Batching writes reduces the number of database round-trips; the cap exists so that "if the process
 * gets killed by the platform, at most this many rows are lost."
 */
export const FLUSH_EVERY = 20;

export interface RunBatchRequest {
  /** Only run these emails; omit = all sample emails (cannot be combined with retryFailed) */
  emailIds?: string[];
  limit: number;
  /** true = ignore the incremental fingerprint and force recomputation */
  force: boolean;
  /** true = only compute, don't write to the database (no service key needed, suited to cloud previews) */
  dryRun: boolean;
  /** Text model used as the extraction/classification fallback, default gemini; cannot use jev */
  provider?: LLMProvider;
  concurrency: number;
  /**
   * One-click retry (2026-09-21 P0-2/P1-9): true = don't pass email_ids; the server automatically
   * picks out emails from the results table that are "failed to process (processing_status=failed)
   * or degraded (model_provider contains degraded)" and forces recomputation. If there's no target,
   * this run has ran=0 and returns normally.
   */
  retryFailed: boolean;
}

export interface BatchFailure {
  email_id: string;
  error: string;
}

export interface RunBatchSummary {
  /** Total number of sample emails */
  total_emails: number;
  /** Number of emails selected this run (after filtering by email_ids; for anonymous dry_run = the actual number parsed, <=20) */
  selected: number;
  /** Number skipped because "content unchanged + engine version unchanged" */
  skipped: number;
  /** Number actually completed this run (succeeded + failed) — smaller than the total pending when truncated by the deadline, never overstated */
  ran: number;
  succeeded: number;
  failed: number;
  /** Number of rows written to the results table (succeeded + failed; 0 for dry_run) */
  wrote: number;
  /**
   * How many are still left to run = target - number completed.
   * Target definition: for an anonymous dry_run preview = the size of this run's scope (scope = email_ids ?? everything);
   * otherwise = the total pending this run after incremental filtering (unaffected by limit truncation).
   * When greater than 0, call again (write mode automatically skips ones already computed), or increase limit.
   */
  remaining: number;
  /** true = the batch deadline was reached with targets still not finished (in which case remaining > 0) */
  stopped_by_deadline: boolean;
  dry_run: boolean;
  logic_version: string;
  duration_ms: number;
  failures: BatchFailure[];
}
