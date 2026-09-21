/**
 * 人工复核动作的业务逻辑（confirm/correct/disposition/defer/undefer/note/rerun + undo + bulk）。
 * REST（各模块 api/review/*）与 MCP（各模块 mcp/index.ts）都只调用这里，不重复实现语义
 * （见 docs/REVIEW_SPEC.md §4）。
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
    throw new ReviewConflictError("这条记录已被别人修改过（updated_at 不匹配），请刷新后再试");
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
    throw new ReviewNotFoundError(`样例数据里没有邮件 ${request.email_id}`);
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
  if (!item) throw new ReviewNotFoundError(`样例数据里没有邮件 ${request.email_id}`);
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
    after_state: existing, // rerun 不改 override，只重算系统结果
    undo_of: null,
    reason: request.reason ?? null,
    note: outcome.summary,
    actor: "admin",
    batch_id: batchId,
  });
  const item = await getQueueItem(targetKind, request.email_id);
  if (!item) throw new ReviewNotFoundError(`样例数据里没有邮件 ${request.email_id}`);
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
      `disposition 动作需要合法的 payload.disposition（accepted/corrected/routed/returned/awaiting_input/unprocessable）`
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

/** 还原成对应 defer 动作之前的快照；没有快照就删掉这一行（见 §4.2） */
async function doUndefer(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest
): Promise<ReviewOverride | null> {
  const lastDefer = await getLatestActionOfType(targetKind, request.email_id, "defer");
  if (!lastDefer) {
    throw new ReviewRequestError(`邮件 ${request.email_id} 没有可恢复的搁置记录`);
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
    throw new ReviewNotFoundError(`邮件 ${request.email_id} 没有可撤销的动作`);
  }
  if (target.action_type === "undo") {
    throw new ReviewRequestError("不能撤销一次“撤销”操作");
  }

  const latest = await getLatestEffectiveAction(targetKind, request.email_id);
  if (!latest || latest.id !== target.id) {
    throw new ReviewConflictError("这不是最新的动作——之后可能已经有别的操作发生，无法撤销");
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
  if (!item) throw new ReviewNotFoundError(`样例数据里没有邮件 ${request.email_id}`);
  return { item, action };
}

/** 批量：逐条独立、失败隔离，共享一个 batch_id（见 §4.7） */
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

// provider 校验复用 lib/llm 的唯一清单，避免这里另起一份判断
export function assertValidProviderOrUndefined(provider: unknown): void {
  if (provider !== undefined && !isLLMProvider(provider)) {
    throw new ReviewRequestError(`不支持的 provider：${String(provider)}`);
  }
}
