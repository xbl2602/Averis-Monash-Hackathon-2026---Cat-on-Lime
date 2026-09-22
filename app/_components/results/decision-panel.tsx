import type { ReviewOverride } from "@/lib/shared/review/types";
import { CategoryBadge, Badge, ReasonNote, StatusBadge } from "./badges";
import type { ComparisonStatus, EmailCategory, ProcessingStatus } from "../../_lib/contracts";
import { DISPOSITION_LABELS, REVIEW_STATE_META, fieldLabel } from "../../_lib/labels";
import { relativeTime } from "../../_lib/format";

/** What the system concluded, in the few fields a person can overrule. */
export interface SystemAnswer {
  category?: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  processing_status?: ProcessingStatus;
  defect_fields: string[];
}

/** The person's decision on its own: who, when, what they set, and their note. */
export function DecisionCard({ override }: { override: ReviewOverride | null }) {
  if (!override) {
    return (
      <div className="rounded-2xl border border-dashed border-line-strong p-4 text-sm text-fg-muted">
        <div className="font-semibold text-fg">No decision yet</div>
        <p className="mt-1 text-xs">Nobody has confirmed, corrected or set this aside.</p>
      </div>
    );
  }
  const meta = REVIEW_STATE_META[override.review_state];
  return (
    <div className="animate-pop space-y-2 rounded-2xl border border-accent/40 bg-accent/[0.06] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone} icon={override.review_state === "confirmed" ? "checkCircle" : override.review_state === "deferred" ? "pause" : "edit"}>{meta.label}</Badge>
        <span className="text-xs text-fg-faint">
          {override.decided_by} · {relativeTime(override.updated_at)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {override.category && <CategoryBadge category={override.category} />}
        {override.comparison_status && <StatusBadge status={override.comparison_status} />}
        {override.review_reason && <ReasonNote reason={override.review_reason} />}
        {override.disposition && <span className="rounded-full bg-sunken px-2.5 py-0.5 font-semibold">{DISPOSITION_LABELS[override.disposition] ?? override.disposition}</span>}
      </div>
      {override.defect_fields && override.defect_fields.length > 0 && <div className="text-xs text-fg-muted">Differing fields: {override.defect_fields.map(fieldLabel).join(", ")}</div>}
      {override.note && <p className="rounded-xl bg-sunken px-3 py-2 text-xs text-fg-muted">{override.note}</p>}
    </div>
  );
}

/** "The system said" next to "A person decided", so an overruled answer is never mistaken for the final one. */
export function SystemVsPerson({ system, override }: { system: SystemAnswer; override: ReviewOverride | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="min-w-0 rounded-2xl border border-line bg-sunken p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-fg-faint">The system said</div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={system.comparison_status} processing={system.processing_status} />
          {system.category !== undefined && <CategoryBadge category={system.category} />}
        </div>
        {system.defect_fields.length > 0 && <div className="mt-2 text-xs text-fg-muted">Differing fields: {system.defect_fields.map(fieldLabel).join(", ")}</div>}
      </div>
      <div className="min-w-0">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-fg-faint">A person decided</div>
        <DecisionCard override={override} />
      </div>
    </div>
  );
}
