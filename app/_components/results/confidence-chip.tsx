import { LOW_CONFIDENCE } from "../../_lib/backend-contract";
import { Icon } from "../icon";
import { TONE_CLASSES } from "../../_lib/labels";

/**
 * How sure the classifier was about an email's category. Shows nothing until the server sends the number
 * (see _lib/backend-contract.ts), so it is safe to place on every screen that lists emails.
 * An unsure answer is a warning chip; a confident one is a quiet line so it does not compete with the outcome.
 */
export function ConfidenceChip({ confidence, needsReview }: { confidence?: number | null; needsReview?: boolean }) {
  const known = typeof confidence === "number" && Number.isFinite(confidence);
  if (!known && needsReview !== true) return null;

  const percent = known ? Math.round(Math.min(1, Math.max(0, confidence)) * 100) : null;
  const unsure = needsReview === true || (known && confidence < LOW_CONFIDENCE);

  if (unsure) {
    return (
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES.warn}`}
        title="The classifier was not sure which category this is. A person should confirm it."
      >
        <Icon name="alert" size={12} />
        Unsure{percent !== null ? ` · ${percent}%` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-fg-faint" title={`The classifier was ${percent}% sure of this category.`}>
      <span className="h-1 w-8 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <span className="block h-full rounded-full bg-ok transition-[width] duration-700" style={{ width: `${percent}%` }} />
      </span>
      {percent}% sure
    </span>
  );
}
