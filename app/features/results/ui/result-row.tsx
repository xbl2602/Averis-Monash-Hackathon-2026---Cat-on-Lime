"use client";

import Link from "next/link";
import type { ReviewOverride } from "@/lib/shared/review/types";
import { Icon } from "../../../_components/icon";
import { CategoryBadge, ProviderChip, ReasonNote, StatusBadge } from "../../../_components/results/badges";
import { CompareView } from "../../../_components/results/compare-view";
import { ConfidenceChip } from "../../../_components/results/confidence-chip";
import { SystemVsPerson } from "../../../_components/results/decision-panel";
import { EmailMessage } from "../../../_components/results/email-message";
import { ReviewChip } from "../../../_components/results/review-chip";
import type { ResultRow } from "../../../_lib/contracts";
import { fieldLabel } from "../../../_lib/labels";
import { fullDate, relativeTime } from "../../../_lib/format";

function DefectChips({ fields }: { fields: string[] }) {
  if (fields.length === 0) return <span className="text-xs text-fg-faint">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((field) => (
        <span key={field} className="rounded-full bg-bad-soft px-2.5 py-0.5 text-[11px] font-semibold text-bad">
          {fieldLabel(field)}
        </span>
      ))}
    </div>
  );
}

/** Everything under an opened row: the SI/BL comparison, any error, and the way into the review queue. */
function RowDetail({ row, review }: { row: ResultRow; review: ReviewOverride | null }) {
  return (
    <div className="space-y-4 px-4 pb-5 pt-2 sm:px-6">
      {row.processing_status === "failed" && row.error_message && (
        <div className="rounded-2xl border border-line bg-bad-soft p-4 text-sm">
          <div className="font-semibold text-bad">This email failed to process</div>
          <p className="mt-1 break-words font-mono text-xs text-fg-muted">{row.error_message}</p>
        </div>
      )}
      {review && <SystemVsPerson system={{ category: row.category, comparison_status: row.comparison_status, processing_status: row.processing_status, defect_fields: row.defect_fields }} override={review} />}
      {row.processing_status === "pending" ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-5 text-center text-sm text-fg-muted">
          This email has not been through the pipeline yet. Run it from <Link href="/features/verification" className="font-semibold text-accent-strong underline-offset-2 hover:underline">Full pipeline</Link>.
        </p>
      ) : (
        <CompareView si={row.extracted_si} bl={row.extracted_bl} defectFields={row.defect_fields} siEvidence={row.evidence_si} blEvidence={row.evidence_bl} />
      )}
      <EmailMessage body={row.body} from={row.from} subject={row.subject} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fg-faint">
        <span>
          {row.attachment_paths.length} attachment{row.attachment_paths.length === 1 ? "" : "s"} · engine version {row.logic_version ?? "—"} · saved {fullDate(row.updated_at)}
        </span>
        {row.processing_status !== "pending" && (
          <Link href={`/features/review?email=${encodeURIComponent(row.email_id)}`} className="btn btn-glass !py-2">
            <Icon name="flag" size={15} />
            Open in review
          </Link>
        )}
      </div>
    </div>
  );
}

/** One result: a summary line that opens into the full comparison. Works as a table row on wide screens and a card on phones. */
export function ResultRowItem({ row, review, open, onToggle, index }: { row: ResultRow; review: ReviewOverride | null; open: boolean; onToggle: () => void; index: number }) {
  return (
    <div className="border-t border-line first:border-t-0" style={{ "--i": Math.min(index, 12) } as React.CSSProperties}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-open={open}
        className="row-hover animate-rise stagger grid w-full items-center gap-x-4 gap-y-2 px-4 py-4 text-left sm:px-6 lg:grid-cols-[minmax(0,1.6fr)_9rem_9.5rem_minmax(0,1.1fr)_7rem_1.5rem]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-accent-strong">{row.email_id}</span>
            <ProviderChip provider={row.model_provider} />
          </div>
          <div className="mt-1 truncate text-sm font-medium">{row.subject || "(no subject)"}</div>
          <div className="truncate text-xs text-fg-faint">{row.from}</div>
        </div>
        <div className="flex items-center justify-between gap-3 lg:contents">
          <div className="flex flex-col items-start gap-1">
            <CategoryBadge category={row.category} />
            <ConfidenceChip confidence={row.classification_confidence} needsReview={row.classification_needs_review} />
          </div>
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={row.comparison_status} processing={row.processing_status} />
            <ReasonNote reason={row.review_reason} />
            <ReviewChip review={review} />
          </div>
        </div>
        <DefectChips fields={row.defect_fields} />
        <div className="text-xs text-fg-faint" title={fullDate(row.updated_at)}>
          {relativeTime(row.updated_at)}
        </div>
        <Icon name="chevronDown" size={18} className={`hidden text-fg-faint transition duration-300 lg:block ${open ? "rotate-180 text-accent-strong" : ""}`} />
      </button>
      <div className="expand" data-open={open}>
        <div>{open && <RowDetail row={row} review={review} />}</div>
      </div>
    </div>
  );
}
