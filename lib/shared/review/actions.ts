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
  deleteOverrideIfUnchanged,
  insertAction,
  newBatchId,
  upsertOverride,
} from "./store";
import {
  REVIEW_TARGET_KINDS,
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

/**
 * 重跑：后做的动作说了算（REVIEW_SPEC §4.5，2026-09-22 改）。
 *
 * 重跑成功 = 系统对这封邮件重新给出了结论，而之前的人工决定都是针对旧结论做的，所以一律让位：
 * 四个模块上这封邮件的人工结论都清掉（重跑会把分类、抽取、比对全部重算一遍，不只是发起重跑的这个模块），
 * 每清掉一条都在它自己模块的历史里记一笔 rerun（before=旧结论、after=null），在那个模块点"撤销"就能拿回来。
 * 重跑失败 = 没有新结论可以接替，人工决定原样保留。
 *
 * 为什么改：旧规则是"重跑不清除人工结论"，操作者实测先把 email_004 更正成 OK、再点重跑，
 * 系统重新算出了（正确的）MISMATCH，但那条更正仍然压在提交文件上，而页面上看不出来。
 */
async function finishRerun(
  targetKind: ReviewTargetKind,
  request: ApplyReviewActionRequest,
  existing: ReviewOverride | null,
  batchId: string | null
): Promise<ApplyReviewActionResult> {
  const emailId = request.email_id;
  const decisionsBefore = await loadDecisionsBefore(targetKind, emailId, existing);
  const outcome = await rerunSingleEmail(emailId, request.payload?.provider);

  const replaced: ReviewTargetKind[] = [];
  if (outcome.ok) {
    for (const [kind, decision] of decisionsBefore) {
      // 比较-删除：重跑期间有人刚存的新决定（updated_at 变了）不是这次要取代的，留着
      if (await deleteOverrideIfUnchanged(kind, emailId, decision.updated_at)) replaced.push(kind);
    }
  }
  // 一次重跑清掉了多个模块的结论时，这几条审计记录共用一个 batch_id，方便追溯是同一次重跑
  const sharedBatch = batchId ?? (replaced.some((kind) => kind !== targetKind) ? newBatchId() : null);

  for (const kind of replaced) {
    if (kind === targetKind) continue;
    await insertAction({
      target_kind: kind,
      email_id: emailId,
      action_type: "rerun",
      before_state: decisionsBefore.get(kind) ?? null,
      after_state: null,
      undo_of: null,
      reason: null,
      note: `从 ${targetKind} 复核页发起的重跑。${outcome.summary}`,
      actor: "admin",
      batch_id: sharedBatch,
    });
  }

  const ownReplaced = replaced.includes(targetKind);
  // 没清掉时按库里的现状记（可能是重跑期间别人刚存的新决定），这样撤销这条 rerun 不会把它踩掉
  const ownState = ownReplaced ? existing : await getOverride(targetKind, emailId);
  const keptBecauseChanged = outcome.ok && existing !== null && !ownReplaced;
  const action = await insertAction({
    target_kind: targetKind,
    email_id: emailId,
    action_type: "rerun",
    before_state: ownState,
    after_state: ownReplaced ? null : ownState,
    undo_of: null,
    reason: request.reason ?? null,
    note: keptBecauseChanged ? `${outcome.summary}（重跑期间这条人工结论被改过，保留了新的那条）` : outcome.summary,
    actor: "admin",
    batch_id: sharedBatch,
  });
  const item = await getQueueItem(targetKind, emailId);
  if (!item) throw new ReviewNotFoundError(`样例数据里没有邮件 ${emailId}`);
  return { item, action, replaced_decisions: replaced };
}

/** 重跑前这封邮件在各模块上当前生效的人工结论（发起重跑的模块已经读过了，直接复用） */
async function loadDecisionsBefore(
  targetKind: ReviewTargetKind,
  emailId: string,
  existing: ReviewOverride | null
): Promise<Map<ReviewTargetKind, ReviewOverride>> {
  const entries = await Promise.all(
    REVIEW_TARGET_KINDS.map(
      async (kind) => [kind, kind === targetKind ? existing : await getOverride(kind, emailId)] as const
    )
  );
  const decisions = new Map<ReviewTargetKind, ReviewOverride>();
  for (const [kind, decision] of entries) if (decision) decisions.set(kind, decision);
  return decisions;
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
