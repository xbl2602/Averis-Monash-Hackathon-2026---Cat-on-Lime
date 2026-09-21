/**
 * 人工覆盖的一致性校验（REVIEW_SPEC.md §4.1 的"一致性归一"要求）：
 * MISMATCH 必有缺陷清单、NEEDS_REVIEW 必有原因且无缺陷、OK 无缺陷无原因。
 * 这条规则和 results 导出的 findInvalidSubmissionIds 是同一个口径（见 P0-4），
 * 但故意不复用那个函数——那个函数按 EmailVerificationResult 全字段判断，
 * 这里只在"comparison_status 真的被设置了"时才检查，其余 target_kind 不涉及这个字段。
 */
import type { ComparedField, ReviewReason } from "@/lib/shared/types";

export interface ConsistencyInput {
  comparison_status: string | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[] | null;
}

/** 只有当 comparison_status 有值时才检查；null（本次动作不改这个字段）视为合法 */
export function isConsistentOverride(input: ConsistencyInput): boolean {
  if (input.comparison_status === null) return true;
  const hasDefects = (input.defect_fields?.length ?? 0) > 0;
  if (input.comparison_status === "MISMATCH") {
    return hasDefects && input.review_reason === null;
  }
  if (input.comparison_status === "NEEDS_REVIEW") {
    return !hasDefects && input.review_reason !== null;
  }
  // OK
  return !hasDefects && input.review_reason === null;
}

export class ReviewConsistencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewConsistencyError";
  }
}

export function assertConsistentOverride(input: ConsistencyInput): void {
  if (!isConsistentOverride(input)) {
    throw new ReviewConsistencyError(
      "人工结论不合法：MISMATCH 必须带缺陷字段且不带原因；NEEDS_REVIEW 必须带原因且不带缺陷字段；OK 两者都不能带"
    );
  }
}
