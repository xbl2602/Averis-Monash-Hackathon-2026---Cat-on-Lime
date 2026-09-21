/**
 * 把人工覆盖叠加到系统结果之上，供 results 导出的 scope=submission 使用（§5.1/§5.2）。
 * 只有 classification（改 category）和 comparison（改 status/review_reason/defect_fields）
 * 两个 target_kind 会影响最终提交格式——extraction/pipeline 的覆盖不直接进 EmailVerificationResult
 * （官方提交格式本来就不含抽取字段/处置状态，见 lib/shared/types.ts 的 EmailVerificationResult）。
 *
 * 只有 scope=submission 套用覆盖；scope=results/conflicts 仍展示系统原值（§5.3），
 * 所以这个函数只从 export/index.ts 的 buildSubmissionDocument 调用，不要在别处复用。
 */
import type { ComparedField, EmailVerificationResult } from "@/lib/shared/types";
import { isConsistentOverride } from "./normalize";
import { listOverrides } from "./store";
import type { ReviewOverride } from "./types";

export interface ApplyOverridesResult {
  payload: Record<string, EmailVerificationResult>;
  /** 应该复核但还没处置的项数：NEEDS_REVIEW/MISMATCH 且没有对应的非-deferred 覆盖 */
  reviewPending: number;
  /** 被搁置、未闭环的项数 */
  reviewDeferred: number;
  /**
   * 人工覆盖真的改掉了引擎结论的邮件（合并结果 ≠ 系统结果）。
   * 2026-09-22 加的：email_004 先被人工"更正"成 OK、之后又被重跑，旧规则下重跑不清除人工结论，
   * 于是那条更正一直把引擎本来判对的 MISMATCH 悄悄换掉，导出文件里完全看不出这是人改的还是引擎算的
   * （重跑规则已改成"后做的动作说了算"，见 actions.ts 的 finishRerun / 决策37）。覆盖本身是合法功能，
   * 但提交文件里"哪几条不是引擎自己的结论"必须是看得见的。
   */
  overriddenIds: string[];
}

export async function applyOverridesToSubmission(
  base: Record<string, EmailVerificationResult>
): Promise<ApplyOverridesResult> {
  const emailIds = Object.keys(base);
  const [classificationOverrides, comparisonOverrides] = await Promise.all([
    listOverrides("classification", emailIds),
    listOverrides("comparison", emailIds),
  ]);

  const payload: Record<string, EmailVerificationResult> = {};
  const overriddenIds: string[] = [];
  let reviewPending = 0;
  let reviewDeferred = 0;

  for (const [emailId, system] of Object.entries(base)) {
    const classificationOverride = classificationOverrides.get(emailId) ?? null;
    const comparisonOverride = comparisonOverrides.get(emailId) ?? null;

    const needsHumanSignoff = system.status === "NEEDS_REVIEW" || system.status === "MISMATCH";
    const classificationHandled =
      classificationOverride !== null && classificationOverride.review_state !== "deferred";
    const comparisonHandled =
      comparisonOverride !== null && comparisonOverride.review_state !== "deferred";
    const anyDeferred =
      classificationOverride?.review_state === "deferred" ||
      comparisonOverride?.review_state === "deferred";

    if (needsHumanSignoff && !classificationHandled && !comparisonHandled) {
      if (anyDeferred) reviewDeferred += 1;
      else reviewPending += 1;
    }

    const merged = mergeOne(emailId, system, classificationOverride, comparisonOverride);
    payload[emailId] = merged;
    if (differsFromSystem(system, merged)) overriddenIds.push(emailId);
  }

  return { payload, reviewPending, reviewDeferred, overriddenIds: overriddenIds.sort() };
}

/** 合并后的结论和引擎自己的结论是不是真的不一样（只比进提交格式的那几个字段） */
function differsFromSystem(system: EmailVerificationResult, merged: EmailVerificationResult): boolean {
  const key = (result: EmailVerificationResult) =>
    JSON.stringify({
      category: result.category,
      status: result.status,
      review_reason: result.review_reason,
      defect_fields: [...result.defect_fields].sort(),
      has_defect: result.has_defect,
    });
  return key(system) !== key(merged);
}

function mergeOne(
  emailId: string,
  system: EmailVerificationResult,
  classificationOverride: ReviewOverride | null,
  comparisonOverride: ReviewOverride | null
): EmailVerificationResult {
  const category =
    classificationOverride &&
    classificationOverride.review_state !== "deferred" &&
    classificationOverride.category
      ? classificationOverride.category
      : system.category;

  let status = system.status;
  let review_reason = system.review_reason;
  let defect_fields: ComparedField[] = system.defect_fields;
  let has_defect = system.has_defect;

  if (
    comparisonOverride &&
    comparisonOverride.review_state !== "deferred" &&
    comparisonOverride.comparison_status !== null
  ) {
    status = comparisonOverride.comparison_status;
    review_reason = comparisonOverride.review_reason;
    defect_fields = comparisonOverride.defect_fields ?? [];
    has_defect = defect_fields.length > 0;
  }

  const merged: EmailVerificationResult = { category, status, review_reason, defect_fields, has_defect };

  if (!isConsistentOverride({ comparison_status: status, review_reason, defect_fields })) {
    console.warn(
      `[review/merge] 邮件 ${emailId} 的人工结论合并后不合法（${status}/${review_reason}/${defect_fields.length}个缺陷），回退系统结果，不静默放过`
    );
    return system;
  }
  return merged;
}
