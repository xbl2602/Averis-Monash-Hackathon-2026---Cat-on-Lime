/**
 * Data access layer for the human-review loop: reads/writes of review_overrides /
 * review_actions, plus querying the review queue (reads verification_overview and layers the
 * override on top, per target_kind).
 *
 * Writes always use upsert (conflict key target_kind+email_id, see the "High Concurrency"
 * section of CLAUDE.md), never "query then insert". Reads use the anon key (all three tables
 * are readable by anon), writes use the service role key.
 */
import { randomUUID } from "node:crypto";
import { getSupabaseClient, getSupabaseServiceClient } from "@/lib/shared/supabase";
import type { ComparedField, ComparisonStatus, EmailCategory, ReviewReason } from "@/lib/shared/types";
import { ReviewStoreUnavailableError } from "./errors";
import {
  type ReviewActionRow,
  type ReviewAuditActionType,
  type ReviewOverride,
  type ReviewQueueItem,
  type ReviewTargetKind,
} from "./types";

/**
 * Wraps getSupabaseClient/getSupabaseServiceClient: when Supabase isn't configured, this
 * uniformly throws ReviewStoreUnavailableError (mapped to 503), instead of letting a plain
 * generic Error fall into request-errors.ts's "unknown error" fallback and turn into a 500
 * with an unreadable message — this mirrors the pattern already used by the results module's
 * `getReadClient()` (app/features/results/logic/db.ts); we align with it here, fixing the
 * inconsistency teammate A found while wiring up the GUI ("without a configured database,
 * review returns 500 while other modules return 503").
 */
function getReadClient() {
  try {
    return getSupabaseClient();
  } catch (err) {
    throw new ReviewStoreUnavailableError(
      err instanceof Error ? err.message : "Failed to initialize the Supabase read-only client"
    );
  }
}

function getWriteClient() {
  try {
    return getSupabaseServiceClient();
  } catch (err) {
    throw new ReviewStoreUnavailableError(
      err instanceof Error ? err.message : "Failed to initialize the Supabase service-side client"
    );
  }
}

// The queue fetches at most this many rows at once, then filters/paginates in memory (the same
// order of magnitude used by loadStoredVerificationRows in verification-store.ts: the sample
// data has 3288 rows, reading it all at once is simpler than fighting with SQL filters, and
// the scale is manageable)
const OVERVIEW_FETCH_LIMIT = 5000;

interface OverviewQueueRow {
  email_id: string;
  subject: string | null;
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[] | null;
  processing_status: "ok" | "failed" | "pending";
  model_provider: string | null;
  updated_at: string | null;
}

const OVERVIEW_COLUMNS =
  "email_id,subject,category,comparison_status,review_reason,defect_fields,processing_status,model_provider,updated_at";

/** Whether this row belongs in the default queue for this target_kind, i.e. an "exception item" it should show (D3: default anomaly-driven) */
function isInDefaultQueue(targetKind: ReviewTargetKind, row: OverviewQueueRow): boolean {
  const provider = row.model_provider ?? "";
  switch (targetKind) {
    case "comparison":
      return row.comparison_status === "MISMATCH" || row.comparison_status === "NEEDS_REVIEW";
    case "extraction":
      return (
        row.comparison_status === "NEEDS_REVIEW" &&
        (row.review_reason === "missing_value" ||
          row.review_reason === "wrong_doc_type" ||
          row.review_reason === "unreadable")
      );
    case "classification":
      // Classification's "confidence < 0.85" isn't currently persisted into
      // verification_results (only the single-document endpoint returns it immediately, see
      // DECISION_LOG decision 30's side note / TODO.md P1-1) — this can only cover the "every
      // model failed and degraded" case for now.
      return provider.startsWith("degraded/");
    case "pipeline":
      return row.processing_status === "failed" || provider.includes("degraded");
  }
}

export interface ListQueueOptions {
  includeOk?: boolean;
  q?: string;
  /** Filter by the system's comparison status (OK/MISMATCH/NEEDS_REVIEW) */
  status?: ComparisonStatus;
  /** Filter by the system's review reason */
  reason?: ReviewReason;
  /** Filter by the human override's review_state; pass "none" = only items with no human override yet */
  reviewState?: "confirmed" | "corrected" | "deferred" | "none";
  limit?: number;
  offset?: number;
}

export async function listReviewQueue(
  targetKind: ReviewTargetKind,
  options: ListQueueOptions = {}
): Promise<{ total: number; items: ReviewQueueItem[] }> {
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("verification_overview")
    .select(OVERVIEW_COLUMNS)
    .limit(OVERVIEW_FETCH_LIMIT);
  if (error) throw new Error(`Failed to read verification_overview: ${error.message}`);

  const rows = (data ?? []) as OverviewQueueRow[];
  let filtered = rows.filter((row) => options.includeOk || isInDefaultQueue(targetKind, row));
  if (options.status) filtered = filtered.filter((row) => row.comparison_status === options.status);
  if (options.reason) filtered = filtered.filter((row) => row.review_reason === options.reason);
  const searched = options.q ? filtered.filter((row) => matchesSearch(row, options.q!)) : filtered;

  const overrides = await listOverrides(
    targetKind,
    searched.map((row) => row.email_id)
  );

  const byReviewState = options.reviewState
    ? searched.filter((row) => {
        const override = overrides.get(row.email_id) ?? null;
        return options.reviewState === "none"
          ? override === null
          : override?.review_state === options.reviewState;
      })
    : searched;

  const items = byReviewState.map((row) => toQueueItem(row, overrides.get(row.email_id) ?? null));
  const limit = options.limit ?? items.length;
  const offset = options.offset ?? 0;

  return { total: items.length, items: items.slice(offset, offset + limit) };
}

function matchesSearch(row: OverviewQueueRow, q: string): boolean {
  const term = q.toLowerCase();
  return row.email_id.toLowerCase().includes(term) || (row.subject ?? "").toLowerCase().includes(term);
}

function toQueueItem(row: OverviewQueueRow, override: ReviewOverride | null): ReviewQueueItem {
  return {
    email_id: row.email_id,
    subject: row.subject ?? "",
    category: row.category,
    comparison_status: row.comparison_status,
    review_reason: row.review_reason,
    defect_fields: row.defect_fields ?? [],
    processing_status: row.processing_status,
    model_provider: row.model_provider,
    override,
    last_action_at: override?.updated_at ?? null,
    updated_at: row.updated_at,
  };
}

/** The raw row for a single email in verification_overview (reused by rerun/merge whenever they need basic info like the category) */
export async function getQueueItem(
  targetKind: ReviewTargetKind,
  emailId: string
): Promise<ReviewQueueItem | null> {
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("verification_overview")
    .select(OVERVIEW_COLUMNS)
    .eq("email_id", emailId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read verification_overview: ${error.message}`);
  if (!data) return null;
  const override = await getOverride(targetKind, emailId);
  return toQueueItem(data as OverviewQueueRow, override);
}

export async function getOverride(
  targetKind: ReviewTargetKind,
  emailId: string
): Promise<ReviewOverride | null> {
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("review_overrides")
    .select("*")
    .eq("target_kind", targetKind)
    .eq("email_id", emailId)
    .maybeSingle();
  if (error) throw new Error(`Failed to read review_overrides: ${error.message}`);
  return (data as ReviewOverride | null) ?? null;
}

/**
 * Fetches every override for a target_kind, then filters by emailIds in memory (if provided).
 *
 * We don't use `.in("email_id", emailIds)`: the results export can pass in 520+ email_ids at
 * once, and PostgREST choking on such a large array packed into the URL query string returns
 * a flat 400 (observed in practice as "Bad Request"). review_overrides only ever holds "the
 * small subset that's actually been touched by a human", so reading it all once and filtering
 * is safer than fighting with an oversized IN list, and it scales fine (it grows with "how
 * much has been reviewed", not with the total email count).
 */
export async function listOverrides(
  targetKind: ReviewTargetKind,
  emailIds?: string[]
): Promise<Map<string, ReviewOverride>> {
  const map = new Map<string, ReviewOverride>();
  if (emailIds && emailIds.length === 0) return map;
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("review_overrides")
    .select("*")
    .eq("target_kind", targetKind);
  if (error) throw new Error(`Failed to read review_overrides: ${error.message}`);
  const wanted = emailIds ? new Set(emailIds) : null;
  for (const row of (data ?? []) as ReviewOverride[]) {
    if (wanted && !wanted.has(row.email_id)) continue;
    map.set(row.email_id, row);
  }
  return map;
}

/** upsert (conflict key target_kind+email_id), never "query then insert" */
export async function upsertOverride(
  row: Omit<ReviewOverride, "created_at" | "updated_at"> & { updated_at: string }
): Promise<ReviewOverride> {
  const supabase = getWriteClient();
  const { data, error } = await supabase
    .from("review_overrides")
    .upsert(row, { onConflict: "target_kind,email_id" })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to write review_overrides: ${error.message}`);
  return data as ReviewOverride;
}

export async function deleteOverride(targetKind: ReviewTargetKind, emailId: string): Promise<void> {
  const supabase = getWriteClient();
  const { error } = await supabase
    .from("review_overrides")
    .delete()
    .eq("target_kind", targetKind)
    .eq("email_id", emailId);
  if (error) throw new Error(`Failed to delete review_overrides: ${error.message}`);
}

export async function insertAction(
  row: Omit<ReviewActionRow, "id" | "created_at">
): Promise<ReviewActionRow> {
  const supabase = getWriteClient();
  const { data, error } = await supabase
    .from("review_actions")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to write review_actions: ${error.message}`);
  return data as ReviewActionRow;
}

export async function listActions(
  targetKind: ReviewTargetKind,
  emailId: string
): Promise<ReviewActionRow[]> {
  const supabase = getReadClient();
  const { data, error } = await supabase
    .from("review_actions")
    .select("*")
    .eq("target_kind", targetKind)
    .eq("email_id", emailId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to read review_actions: ${error.message}`);
  return (data ?? []) as ReviewActionRow[];
}

/** The latest "effective" action (not an undo, and not itself undone): both the default undo target and the concurrency-conflict check rely on this */
export async function getLatestEffectiveAction(
  targetKind: ReviewTargetKind,
  emailId: string
): Promise<ReviewActionRow | null> {
  const actions = await listActions(targetKind, emailId);
  const undoneIds = new Set(actions.filter((a) => a.undo_of !== null).map((a) => a.undo_of));
  return actions.find((a) => a.action_type !== "undo" && !undoneIds.has(a.id)) ?? null;
}

/** The latest action of a given type (used by undefer to find the matching defer) */
export async function getLatestActionOfType(
  targetKind: ReviewTargetKind,
  emailId: string,
  actionType: ReviewAuditActionType
): Promise<ReviewActionRow | null> {
  const actions = await listActions(targetKind, emailId);
  return actions.find((a) => a.action_type === actionType) ?? null;
}

export async function getActionById(
  targetKind: ReviewTargetKind,
  emailId: string,
  actionId: number
): Promise<ReviewActionRow | null> {
  const actions = await listActions(targetKind, emailId);
  return actions.find((a) => a.id === actionId) ?? null;
}

export function newBatchId(): string {
  return randomUUID();
}
