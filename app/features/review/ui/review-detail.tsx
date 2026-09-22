"use client";

import Link from "next/link";
import { useAdmin } from "../../../_components/admin/admin-provider";
import { LockedCard } from "../../../_components/admin/admin-gate";
import { Icon } from "../../../_components/icon";
import { Notice } from "../../../_components/notice";
import { CategoryBadge, ProviderChip, ReasonNote, StatusBadge } from "../../../_components/results/badges";
import { CompareView } from "../../../_components/results/compare-view";
import { ConfidenceChip } from "../../../_components/results/confidence-chip";
import { SystemVsPerson } from "../../../_components/results/decision-panel";
import { EmailMessage } from "../../../_components/results/email-message";
import { queryString } from "../../../_lib/api-client";
import type { ResultList, ResultRow } from "../../../_lib/contracts";
import type { ProviderOption } from "../../../_lib/provider-options";
import { fullDate, relativeTime } from "../../../_lib/format";
import { useApi } from "../../../_lib/use-api";
import { ActionBar } from "./action-bar";
import { HistoryTimeline } from "./history-timeline";
import { historyUrl, type ApplyReviewActionRequest, type HistoryResponse, type ReviewModule, type ReviewQueueItem } from "./review-api";
import { useReviewActions } from "./use-review-actions";

function Evidence({ module, item, row }: { module: ReviewModule; item: ReviewQueueItem; row: ResultRow | null }) {
  if (module === "pipeline") {
    return (
      <div className="space-y-3">
        {row?.error_message ? (
          <div className="rounded-2xl border border-line bg-bad-soft p-4">
            <div className="text-sm font-semibold text-bad">Processing error</div>
            <p className="mt-1 break-words font-mono text-xs text-fg-muted">{row.error_message}</p>
          </div>
        ) : (
          <Notice title="This run used a fallback">A model step failed and a fallback answer was used. Re-run it to try the models again.</Notice>
        )}
      </div>
    );
  }
  if (module === "classification") {
    return (
      <Notice title="Every model failed on this email">
        The category shown is a best-effort guess from simple rules. Read the message, then confirm it or pick the right category. <span className="font-mono">{row?.from}</span>
      </Notice>
    );
  }
  if (!row) return null;
  return <CompareView si={row.extracted_si} bl={row.extracted_bl} defectFields={item.defect_fields} siEvidence={row.evidence_si} blEvidence={row.evidence_bl} />;
}

/** Right-hand pane: what the system decided, what a person decided, the evidence, the actions and the history. */
export function ReviewDetail({
  module,
  item,
  providers,
  onItem,
  onChanged,
  onBack,
}: {
  module: ReviewModule;
  item: ReviewQueueItem;
  providers: ProviderOption[];
  onItem: (item: ReviewQueueItem) => void;
  onChanged: () => void;
  onBack: () => void;
}) {
  const { unlocked } = useAdmin();
  const rows = useApi<ResultList>(`/features/results/api${queryString({ q: item.email_id, limit: 5 })}`);
  const history = useApi<HistoryResponse>(historyUrl(module, item.email_id));
  const actions = useReviewActions(module);

  const row = rows.data?.items.find((r) => r.email_id === item.email_id) ?? null;
  const past = history.data?.actions ?? [];
  const undone = new Set(past.map((a) => a.undo_of).filter((id): id is number => id !== null));
  const canUndo = past.some((a) => a.action_type !== "undo" && !undone.has(a.id));

  async function apply(request: Omit<ApplyReviewActionRequest, "email_id" | "expected_updated_at">): Promise<boolean> {
    const result = await actions.apply({ ...request, email_id: item.email_id, ...(item.override ? { expected_updated_at: item.override.updated_at } : {}) });
    if (!result) return false;
    onItem(result.item);
    history.reload();
    onChanged();
    return true;
  }

  async function undo() {
    const result = await actions.undo(item.email_id, item.override?.updated_at);
    if (!result) return;
    onItem(result.item);
    history.reload();
    onChanged();
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="btn btn-glass !py-2 lg:hidden">
        <Icon name="arrowLeft" size={16} />
        Back to the queue
      </button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base font-bold text-accent-strong">{item.email_id}</span>
          <StatusBadge status={item.comparison_status} processing={item.processing_status} />
          <CategoryBadge category={item.category} />
          <ConfidenceChip confidence={item.classification_confidence} needsReview={item.classification_needs_review} />
          <ProviderChip provider={item.model_provider} />
        </div>
        <h2 className="text-xl font-extrabold leading-snug">{item.subject || "(no subject)"}</h2>
        <div className="flex flex-wrap items-center gap-x-3 text-xs text-fg-faint">
          {row?.from && <span>{row.from}</span>}
          <span>Last changed {fullDate(item.updated_at)}</span>
          <Link href={`/features/results?q=${encodeURIComponent(item.email_id)}`} className="inline-flex items-center gap-1 font-semibold text-accent-strong hover:underline">
            Open in results <Icon name="external" size={12} />
          </Link>
        </div>
        <ReasonNote reason={item.review_reason} />
      </header>

      <SystemVsPerson system={{ category: item.category, comparison_status: item.comparison_status, processing_status: item.processing_status, defect_fields: item.defect_fields }} override={item.override} />

      {rows.loading && !row ? <p className="text-sm text-fg-faint">Loading the extracted fields…</p> : <Evidence module={module} item={item} row={row} />}
      {/* A classification review is a judgement about the message itself, so it opens already unfolded */}
      <EmailMessage body={item.body ?? row?.body} from={item.from ?? row?.from} subject={item.subject} defaultOpen={module === "classification"} />

      <section className="space-y-4">
        <h3 className="text-sm font-bold">Actions</h3>
        {!unlocked && <LockedCard action="confirm, correct or re-run items" />}
        {actions.conflict && (
          <Notice tone="warn" title="Someone else changed this first">
            Reload the latest version before trying again.
            <div className="mt-3">
              <button type="button" className="btn btn-glass !py-2" onClick={() => { actions.clearError(); history.reload(); onChanged(); }}>
                <Icon name="refresh" size={15} />
                Reload
              </button>
            </div>
          </Notice>
        )}
        <ActionBar module={module} item={item} row={row} locked={!unlocked} busy={actions.busy} canUndo={canUndo} providers={providers} onApply={apply} onUndo={() => void undo()} />
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-bold">History</h3>
        <HistoryTimeline actions={past} loading={history.loading} />
      </section>
    </div>
  );
}
