/**
 * Layers human overrides on top of the system results, for use by the results export's
 * scope=submission (§5.1/§5.2).
 * Only the classification (changes category) and comparison (changes
 * status/review_reason/defect_fields) target_kinds affect the final submission format —
 * extraction/pipeline overrides don't feed directly into EmailVerificationResult (the
 * official submission format doesn't include extracted fields/disposition status to begin
 * with, see EmailVerificationResult in lib/shared/types.ts).
 *
 * Only scope=submission applies overrides; scope=results/conflicts still show the system's
 * original values (§5.3), so this function should only be called from
 * buildSubmissionDocument in export/index.ts — don't reuse it elsewhere.
 */
import type { ComparedField, EmailVerificationResult } from "@/lib/shared/types";
import { isConsistentOverride } from "./normalize";
import { listOverrides } from "./store";
import type { ReviewOverride } from "./types";

export interface ApplyOverridesResult {
  payload: Record<string, EmailVerificationResult>;
  /** Number of items that should have been reviewed but haven't been dispositioned yet: NEEDS_REVIEW/MISMATCH with no corresponding non-deferred override */
  reviewPending: number;
  /** Number of items that were deferred and never closed out */
  reviewDeferred: number;
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

    payload[emailId] = mergeOne(emailId, system, classificationOverride, comparisonOverride);
  }

  return { payload, reviewPending, reviewDeferred };
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
      `[review/merge] The merged human conclusion for email ${emailId} is invalid (${status}/${review_reason}/${defect_fields.length} defect(s)); falling back to the system result instead of silently letting it through`
    );
    return system;
  }
  return merged;
}
