"use client";

import Link from "next/link";
import type { ReviewOverride } from "@/lib/shared/review/types";
import { Icon } from "../../../_components/icon";
import { ReasonNote, StatusBadge } from "../../../_components/results/badges";
import { CompareView } from "../../../_components/results/compare-view";
import { ConfidenceChip } from "../../../_components/results/confidence-chip";
import { SystemVsPerson } from "../../../_components/results/decision-panel";
import { EmailMessage } from "../../../_components/results/email-message";
import { ReviewChip } from "../../../_components/results/review-chip";
import { useToast } from "../../../_components/toast";
import type { ConflictPair } from "../../../_lib/contracts";
import { fieldLabel } from "../../../_lib/labels";
import { relativeTime } from "../../../_lib/format";

/** A plain-text amendment request: what the BL says, what the SI says, one line per differing field. */
function amendmentText(pair: ConflictPair): string {
  const lines = pair.defect_fields.map((field) => {
    const si = pair.si_values[field] ?? "(missing)";
    const bl = pair.bl_values[field] ?? "(missing)";
    return `- ${fieldLabel(field)}: the draft BL shows "${bl}" but the SI says "${si}". Please amend the BL.`;
  });
  return [`Draft BL check for ${pair.email_id}${pair.subject ? ` (${pair.subject})` : ""}`, "", ...lines].join("\n");
}

export function ConflictCard({ pair, review, index }: { pair: ConflictPair; review: ReviewOverride | null; index: number }) {
  const toast = useToast();

  async function copyAmendment() {
    try {
      await navigator.clipboard.writeText(amendmentText(pair));
      toast({ tone: "ok", title: "Amendment request copied", detail: "Paste it into your reply to the shipper." });
    } catch {
      toast({ tone: "warn", title: "Could not copy", detail: "Your browser blocked clipboard access." });
    }
  }

  return (
    <article style={{ "--i": Math.min(index, 8) } as React.CSSProperties} className="card animate-rise stagger space-y-4 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-accent-strong">{pair.email_id}</span>
            <StatusBadge status={pair.status} />
            <ReasonNote reason={pair.review_reason} />
            <ReviewChip review={review} />
            <ConfidenceChip confidence={pair.classification_confidence} needsReview={pair.classification_needs_review} />
          </div>
          <h3 className="mt-1.5 truncate text-base font-bold">{pair.subject || "(no subject)"}</h3>
          <p className="truncate text-xs text-fg-faint">
            {pair.from} · {relativeTime(pair.updated_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-3xl font-extrabold text-bad">{pair.defect_count}</span>
          <span className="text-[11px] text-fg-faint">{pair.defect_count === 1 ? "field differs" : "fields differ"}</span>
        </div>
      </header>

      {review && <SystemVsPerson system={{ comparison_status: pair.status, defect_fields: pair.defect_fields }} override={review} />}

      <CompareView
        si={pair.si_values}
        bl={pair.bl_values}
        defectFields={pair.defect_fields}
        siEvidence={pair.si_evidence}
        blEvidence={pair.bl_evidence}
        siTitle={pair.si_file ? `SI · ${pair.si_file.split("/").pop()}` : "SI (reference)"}
        blTitle={pair.bl_file ? `BL · ${pair.bl_file.split("/").pop()}` : "Draft BL"}
      />

      <EmailMessage body={pair.body} from={pair.from} subject={pair.subject} />

      <footer className="flex flex-wrap items-center justify-end gap-3">
        {pair.defect_fields.length > 0 && (
          <button type="button" onClick={copyAmendment} className="btn btn-glass !py-2">
            <Icon name="copy" size={15} />
            Copy amendment request
          </button>
        )}
        <Link href={`/features/review?email=${encodeURIComponent(pair.email_id)}`} className="btn btn-primary btn-shine !py-2">
          <Icon name="flag" size={15} />
          Review this one
        </Link>
      </footer>
    </article>
  );
}
