/**
 * Fields the screens are READY for but the server does not send yet. Everything here is optional on purpose:
 * each feature switches itself on the moment its field shows up in a response, and stays out of the way until then.
 * So when the backend adds one, nothing on the frontend needs to change. The names below are the contract that was
 * built against (also written up in docs/UI_GUIDE.md "前端已备好、等后端补字段"); if the backend picks a different
 * name, change it here and nowhere else.
 *
 * 1. Classifier uncertainty (was: confidence is computed but never saved)
 *      results item / conflict item / review-queue item:
 *        classification_confidence?: number | null      0..1, null when a model without confidence answered
 *        classification_needs_review?: boolean          true when the classifier was unsure
 *      stats:
 *        classification_needs_review?: number           how many emails the classifier was unsure about
 *      results list filter:
 *        ?classification_review=true                    only the unsure ones
 *
 * 2. A person's decision shown next to the system's answer (was: only visible inside the review queue)
 *      results item / conflict item:
 *        review?: ReviewOverride | null                 the current override (lib/shared/review/types), null = none
 *
 *    Until the server sends `review`, the screens fetch the review queue's already-decided items and use those, so
 *    this works today. If a response carries the `review` key at all, that wins and the extra requests stop.
 *
 * 3. The email's own text (was: only sender and subject)
 *      results item / conflict item / review-queue item:
 *        body?: string | null                           the message body
 */

/** Query parameter for "only emails whose category the classifier was unsure about" */
export const CLASSIFICATION_REVIEW_PARAM = "classification_review";

/** True once the server includes the `review` key on the rows it returns (even as null). */
export function serverSendsReview(rows: readonly object[]): boolean {
  return rows.some((row) => "review" in row);
}

/** True once the server includes classifier uncertainty on the rows it returns (either field is enough). */
export function classifierReportsUncertainty(rows: readonly object[]): boolean {
  return rows.some((row) => "classification_confidence" in row || "classification_needs_review" in row);
}

/** Below this the confidence is worth pointing out even if the server did not flag the row (matches the engine's 0.85 cut). */
export const LOW_CONFIDENCE = 0.85;
