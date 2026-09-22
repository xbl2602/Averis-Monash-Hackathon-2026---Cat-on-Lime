/**
 * Business logic for human-review actions
 * (confirm/correct/disposition/defer/undefer/note/rerun + undo + bulk).
 * Both REST (each module's api/review/*) and MCP (each module's mcp/index.ts) only call into
 * here, without re-implementing the semantics (see docs/REVIEW_SPEC.md §4).
 */
import { isLLMProvider } from "@/lib/llm";
import type { ComparedField, EmailCategory } from "@/lib/shared/types";
import { assertConsistentOverride } from "./normalize";
import { ReviewConflictError, ReviewNotFoundError, ReviewRequestError } from "./errors";
import { rerunSingleEmail } from "./rerun";
import {
  getActionById,
  getLatestActionOfType,
  getLatestEffectiveAction,
  getOverride,
  getQueueItem,
  deleteOverride,
  insertAction,
  newBatchId,
  upsertOverride,
} from "./store";
import {
  isReviewDisposition,
  type ApplyReviewActionRequest,
  type ApplyReviewActionResult,
  type BulkReviewActionRequest,
  type BulkReviewActionResult,
  type ReviewOverride,
  type ReviewTargetKind,
  type UndoReviewActionRequest,
} from "./types";

export { ReviewConsistencyError } from "./normalize";
export {
  ReviewConflictError,
  ReviewNotFoundError,
  ReviewRequestError,
  ReviewStoreUnavailableError,
} from "./errors";

function checkOptimisticLock(existing: ReviewOverride | null, expected?: string): void {
  if (expected === undefined) return;
  const current = existing?.updated_at ?? null;
  if (current !== expected) {
    throw new ReviewConflictError("This record has already been modified by someone else (updated_at doesn't match) — please refresh and try again");
  }
}

function emptyOverrideBase(targetKind: ReviewTargetKind, emailId: string): Omit<
  ReviewOverride,
  "created_at" | "updated_at"
> {
  return {
    target_kind: targetKind,
    email_id: emailId,
    review_state: "confirmed",
    disposition: null,
    category: null,
    comparison_status: null,
    review_reason: null,
    defect_fields: null,
    extracted_si: null,
    extracted_bl: null,
    note: null,
    decided_by: "admin",
  };
}

export async function applyReviewAction(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest,
  batchId: string | null = null
): Promise<ApplyReviewActionResult> {
  const queueItem = await getQueueItem(targetKind, request.email_id);
  if (!queueItem) {
    throw new ReviewNotFoundError(`Email ${request.email_id} isn't in the sample data`);
  }
  const existing = queueItem.override;
  checkOptimisticLock(existing, request.expected_updated_at);

  switch (request.action) {
    case "confirm":
      return finish(targetKind, request, existing, batchId, await doConfirm(targetKind, request, existing));
    case "correct":
      return finish(targetKind, request, existing, batchId, await doCorrect(targetKind, request, existing));
    case "disposition":
      return finish(
        targetKind,
        request,
        existing,
        batchId,
        await doDisposition(targetKind, request, existing)
      );
    case "defer":
      return finish(targetKind, request, existing, batchId, await doDefer(targetKind, request, existing));
    case "undefer":
      return finish(targetKind, request, existing, batchId, await doUndefer(targetKind, request));
    case "note":
      return finish(targetKind, request, existing, batchId, existing);
    case "rerun":
      return finishRerun(targetKind, request, existing, batchId);
  }
}

async function finish(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest,
  before: ReviewOverride | null,
  batchId: string | null,
  after: ReviewOverride | null
): Promise<ApplyReviewActionResult> {
  const action = await insertAction({
    target_kind: targetKind,
    email_id: request.email_id,
    action_type: request.action,
    before_state: before,
    after_state: after,
    undo_of: null,
    reason: request.reason ?? null,
    note: request.note ?? null,
    actor: "admin",
    batch_id: batchId,
  });
  const item = await getQueueItem(targetKind, request.email_id);
  if (!item) throw new ReviewNotFoundError(`Email ${request.email_id} isn't in the sample data`);
  return { item, action };
}

async function finishRerun(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest,
  existing: ReviewOverride | null,
  batchId: string | null
): Promise<ApplyReviewActionResult> {
  const outcome = await rerunSingleEmail(request.email_id, request.payload?.provider);
  const action = await insertAction({
    target_kind: targetKind,
    email_id: request.email_id,
    action_type: "rerun",
    before_state: existing,
    after_state: existing, // rerun doesn't change the override, it only recomputes the system result
    undo_of: null,
    reason: request.reason ?? null,
    note: outcome.summary,
    actor: "admin",
    batch_id: batchId,
  });
  const item = await getQueueItem(targetKind, request.email_id);
  if (!item) throw new ReviewNotFoundError(`Email ${request.email_id} isn't in the sample data`);
  return { item, action };
}

async function doConfirm(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest,
  existing: ReviewOverride | null
): Promise<ReviewOverride> {
  return upsertOverride({
    ...emptyOverrideBase(targetKind, request.email_id),
    review_state: "confirmed",
    note: request.note ?? existing?.note ?? null,
    updated_at: new Date().toISOString(),
  });
}

async function doCorrect(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest,
  existing: ReviewOverride | null
): Promise<ReviewOverride> {
  const payload = request.payload ?? {};
  const category: EmailCategory | null = payload.category ?? existing?.category ?? null;
  const comparisonStatus = payload.comparison_status ?? existing?.comparison_status ?? null;
  const reviewReason =
    payload.review_reason !== undefined ? payload.review_reason : (existing?.review_reason ?? null);
  const defectFields: ComparedField[] | null = payload.defect_fields ?? existing?.defect_fields ?? null;

  if (targetKind === "comparison") {
    assertConsistentOverride({
      comparison_status: comparisonStatus,
      review_reason: reviewReason,
      defect_fields: defectFields,
    });
  }

  return upsertOverride({
    ...emptyOverrideBase(targetKind, request.email_id),
    review_state: "corrected",
    disposition: existing?.disposition ?? null,
    category,
    comparison_status: comparisonStatus,
    review_reason: reviewReason,
    defect_fields: defectFields,
    extracted_si: payload.extracted_si ?? existing?.extracted_si ?? null,
    extracted_bl: payload.extracted_bl ?? existing?.extracted_bl ?? null,
    note: request.note ?? existing?.note ?? null,
    updated_at: new Date().toISOString(),
  });
}

async function doDisposition(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest,
  existing: ReviewOverride | null
): Promise<ReviewOverride> {
  const disposition = request.payload?.disposition;
  if (!disposition || !isReviewDisposition(disposition)) {
    throw new ReviewRequestError(
      `The disposition action requires a valid payload.disposition (accepted/corrected/routed/returned/awaiting_input/unprocessable)`
    );
  }
  const category = request.payload?.category ?? existing?.category ?? null;

  return upsertOverride({
    ...emptyOverrideBase(targetKind, request.email_id),
    review_state: "corrected",
    disposition,
    category,
    comparison_status: existing?.comparison_status ?? null,
    review_reason: existing?.review_reason ?? null,
    defect_fields: existing?.defect_fields ?? null,
    extracted_si: existing?.extracted_si ?? null,
    extracted_bl: existing?.extracted_bl ?? null,
    note: request.note ?? existing?.note ?? null,
    updated_at: new Date().toISOString(),
  });
}

async function doDefer(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest,
  existing: ReviewOverride | null
): Promise<ReviewOverride> {
  return upsertOverride({
    ...emptyOverrideBase(targetKind, request.email_id),
    review_state: "deferred",
    disposition: existing?.disposition ?? null,
    category: existing?.category ?? null,
    comparison_status: existing?.comparison_status ?? null,
    review_reason: existing?.review_reason ?? null,
    defect_fields: existing?.defect_fields ?? null,
    extracted_si: existing?.extracted_si ?? null,
    extracted_bl: existing?.extracted_bl ?? null,
    note: request.note ?? existing?.note ?? null,
    updated_at: new Date().toISOString(),
  });
}

/** Restores the snapshot from before the corresponding defer action; if there's no snapshot, just deletes this row (see §4.2) */
async function doUndefer(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest
): Promise<ReviewOverride | null> {
  const lastDefer = await getLatestActionOfType(targetKind, request.email_id, "defer");
  if (!lastDefer) {
    throw new ReviewRequestError(`Email ${request.email_id} has no deferral record to restore`);
  }
  const restored = lastDefer.before_state;
  if (!restored) {
    await deleteOverride(targetKind, request.email_id);
    return null;
  }
  return upsertOverride({ ...restored, updated_at: new Date().toISOString() });
}

export async function undoReviewAction(
  targetKind: ReviewTargetKind,
  request: UndoReviewActionRequest
): Promise<ApplyReviewActionResult> {
  const target = request.action_id
    ? await getActionById(targetKind, request.email_id, request.action_id)
    : await getLatestEffectiveAction(targetKind, request.email_id);
  if (!target) {
    throw new ReviewNotFoundError(`Email ${request.email_id} has no action to undo`);
  }
  if (target.action_type === "undo") {
    throw new ReviewRequestError("Cannot undo an “undo” action");
  }

  const latest = await getLatestEffectiveAction(targetKind, request.email_id);
  if (!latest || latest.id !== target.id) {
    throw new ReviewConflictError("This isn't the latest action — another operation may have happened since, so it can't be undone");
  }

  const current = await getOverride(targetKind, request.email_id);
  checkOptimisticLock(current, request.expected_updated_at);

  const restored = target.before_state;
  const saved = restored
    ? await upsertOverride({ ...restored, updated_at: new Date().toISOString() })
    : await (async () => {
        await deleteOverride(targetKind, request.email_id);
        return null;
      })();

  const action = await insertAction({
    target_kind: targetKind,
    email_id: request.email_id,
    action_type: "undo",
    before_state: current,
    after_state: saved,
    undo_of: target.id,
    reason: null,
    note: null,
    actor: "admin",
    batch_id: null,
  });

  const item = await getQueueItem(targetKind, request.email_id);
  if (!item) throw new ReviewNotFoundError(`Email ${request.email_id} isn't in the sample data`);
  return { item, action };
}

/** Bulk: each item is independent, failures are isolated, sharing one batch_id (see §4.7) */
export async function bulkReviewAction(
  targetKind: ReviewTargetKind,
  request: BulkReviewActionRequest
): Promise<BulkReviewActionResult> {
  const batchId = newBatchId();
  const succeeded: string[] = [];
  const failed: { email_id: string; error: string }[] = [];

  for (const emailId of request.email_ids) {
    try {
      await applyReviewAction(
        targetKind,
        { email_id: emailId, action: request.action, payload: request.payload },
        batchId
      );
      succeeded.push(emailId);
    } catch (err) {
      failed.push({ email_id: emailId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { batch_id: batchId, succeeded, failed };
}

// provider validation reuses lib/llm's single source of truth, so as not to have another copy of this check here
export function assertValidProviderOrUndefined(provider: unknown): void {
  if (provider !== undefined && !isLLMProvider(provider)) {
    throw new ReviewRequestError(`Unsupported provider: ${String(provider)}`);
  }
}
