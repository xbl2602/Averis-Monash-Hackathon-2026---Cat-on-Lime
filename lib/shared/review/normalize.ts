/**
 * Consistency validation for human overrides (the "consistency normalization" requirement in
 * REVIEW_SPEC.md §4.1):
 * MISMATCH must have a defect list, NEEDS_REVIEW must have a reason and no defects, OK must
 * have neither defects nor a reason.
 * This rule follows the same criteria as the results export's findInvalidSubmissionIds (see
 * P0-4), but it deliberately doesn't reuse that function — that function judges based on the
 * full EmailVerificationResult, whereas this one only checks when comparison_status has
 * actually been set; the other target_kinds don't involve this field at all.
 */
import type { ComparedField, ReviewReason } from "@/lib/shared/types";

export interface ConsistencyInput {
  comparison_status: string | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[] | null;
}

/** Only checked when comparison_status has a value; null (this action doesn't change this field) is considered valid */
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
      "Invalid human conclusion: MISMATCH must carry defect fields and no reason; NEEDS_REVIEW must carry a reason and no defect fields; OK must carry neither"
    );
  }
}
