import type { ReviewOverride } from "@/lib/shared/review/types";
import { Icon, type IconName } from "../icon";
import { REVIEW_STATE_META, TONE_CLASSES, categoryLabel, statusLabel } from "../../_lib/labels";
import { fullDate } from "../../_lib/format";

const ICON: Record<ReviewOverride["review_state"], IconName> = { confirmed: "checkCircle", corrected: "edit", deferred: "pause" };
const WORDS: Record<ReviewOverride["review_state"], string> = { confirmed: "Person confirmed", corrected: "Person corrected", deferred: "Person set aside" };

/** What the person changed it to, when they changed something. */
function changedTo(review: ReviewOverride): string | null {
  if (review.review_state !== "corrected") return null;
  if (review.comparison_status) return statusLabel(review.comparison_status);
  if (review.category) return categoryLabel(review.category);
  return null;
}

/**
 * A small mark that a person has already looked at this email, so nobody re-checks it or trusts a system answer
 * that has since been overruled. Nothing is shown when there is no decision.
 */
export function ReviewChip({ review }: { review: ReviewOverride | null | undefined }) {
  if (!review) return null;
  const to = changedTo(review);
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[REVIEW_STATE_META[review.review_state].tone]}`}
      title={`${REVIEW_STATE_META[review.review_state].label} by ${review.decided_by} · ${fullDate(review.updated_at)}${to ? ` · now ${to}` : ""}`}
    >
      <Icon name={ICON[review.review_state]} size={12} />
      {WORDS[review.review_state]}
    </span>
  );
}
