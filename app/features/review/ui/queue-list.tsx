"use client";

import { COMPARISON_STATUSES } from "@/lib/shared/types";
import { Icon } from "../../../_components/icon";
import { SkeletonRows } from "../../../_components/motion/skeleton";
import { Pagination } from "../../../_components/pagination";
import { Badge, CategoryBadge, StatusBadge } from "../../../_components/results/badges";
import { EmptyState, LoadError } from "../../../_components/results/states";
import type { ApiErrorInfo } from "../../../_components/api-error";
import { STATUS_META, fieldLabel } from "../../../_lib/labels";
import { relativeTime } from "../../../_lib/format";
import { REVIEW_STATE_META, type QueueFilters, type QueueResponse, type ReviewQueueItem } from "./review-api";

function QueueItemCard({ item, index, selected, checked, onOpen, onCheck }: { item: ReviewQueueItem; index: number; selected: boolean; checked: boolean; onOpen: () => void; onCheck: () => void }) {
  const state = item.override ? REVIEW_STATE_META[item.override.review_state] : null;
  return (
    <div style={{ "--i": Math.min(index, 10) } as React.CSSProperties} className={`animate-rise stagger flex items-stretch gap-1 border-t border-line first:border-t-0 ${selected ? "bg-accent/[0.08]" : ""}`}>
      <label className="flex cursor-pointer items-center pl-4 pr-1">
        <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Select ${item.email_id}`} className="h-4 w-4 accent-[var(--accent)]" />
      </label>
      <button type="button" onClick={onOpen} aria-current={selected ? "true" : undefined} data-open={selected} className="row-hover flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-3.5 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-accent-strong">{item.email_id}</span>
          <StatusBadge status={item.comparison_status} processing={item.processing_status} />
          {state && <Badge tone={state.tone} icon={item.override?.review_state === "confirmed" ? "checkCircle" : item.override?.review_state === "deferred" ? "pause" : "edit"}>{state.label}</Badge>}
        </div>
        <div className="truncate text-sm font-medium">{item.subject || "(no subject)"}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-faint">
          <CategoryBadge category={item.category} />
          {item.defect_fields.length > 0 && <span className="text-bad">{item.defect_fields.map(fieldLabel).join(", ")}</span>}
          <span className="ml-auto">{relativeTime(item.updated_at)}</span>
        </div>
      </button>
    </div>
  );
}

interface Props {
  filters: QueueFilters;
  onFilters: (next: Partial<QueueFilters>) => void;
  data: QueueResponse | null;
  loading: boolean;
  error: ApiErrorInfo | null;
  onRetry: () => void;
  selectedId: string | null;
  checked: Set<string>;
  onOpen: (item: ReviewQueueItem) => void;
  onCheck: (id: string) => void;
  onCheckAll: () => void;
}

/** The left pane: filters, the list of items waiting for a person, and paging. */
export function QueueList({ filters, onFilters, data, loading, error, onRetry, selectedId, checked, onOpen, onCheck, onCheckAll }: Props) {
  const items = data?.items ?? [];
  const allChecked = items.length > 0 && items.every((i) => checked.has(i.email_id));

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="space-y-3 border-b border-line p-4">
        <div className="relative">
          <Icon name="search" size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" />
          <input type="search" value={filters.q} onChange={(e) => onFilters({ q: e.target.value, offset: 0 })} placeholder="Search the queue" aria-label="Search the queue" className="field !pl-11" />
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filters.status} onChange={(e) => onFilters({ status: e.target.value as QueueFilters["status"], offset: 0 })} aria-label="Outcome" className="field !w-auto !py-2 !text-xs">
            <option value="">Any outcome</option>
            {COMPARISON_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
          <select value={filters.reviewState} onChange={(e) => onFilters({ reviewState: e.target.value as QueueFilters["reviewState"], offset: 0 })} aria-label="Review state" className="field !w-auto !py-2 !text-xs">
            <option value="">Any review state</option>
            <option value="none">Not reviewed yet</option>
            <option value="confirmed">Confirmed</option>
            <option value="corrected">Corrected</option>
            <option value="deferred">Set aside</option>
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-xs text-fg-muted">
          <input type="checkbox" checked={filters.includeOk} onChange={(e) => onFilters({ includeOk: e.target.checked, offset: 0 })} className="h-4 w-4 accent-[var(--accent)]" />
          Also show emails the system judged fine
        </label>
      </div>

      {items.length > 0 && (
        <label className="flex cursor-pointer items-center gap-3 border-b border-line bg-sunken px-4 py-2 text-xs font-semibold text-fg-muted">
          <input type="checkbox" checked={allChecked} onChange={onCheckAll} className="h-4 w-4 accent-[var(--accent)]" />
          Select this page ({items.length})
        </label>
      )}

      {loading && !data ? (
        <SkeletonRows rows={6} />
      ) : error ? (
        <div className="p-4">
          <LoadError error={error} onRetry={onRetry} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="checkCircle" title="The queue is empty">
          Nothing here needs a person right now. Tick &ldquo;also show emails the system judged fine&rdquo; to browse everything.
        </EmptyState>
      ) : (
        <div className={`max-h-[70vh] overflow-y-auto transition-opacity duration-200 ${loading ? "opacity-50" : ""}`}>
          {items.map((item, i) => (
            <QueueItemCard key={item.email_id} item={item} index={i} selected={item.email_id === selectedId} checked={checked.has(item.email_id)} onOpen={() => onOpen(item)} onCheck={() => onCheck(item.email_id)} />
          ))}
        </div>
      )}

      {data && <Pagination total={data.total} limit={filters.limit} offset={filters.offset} onChange={(offset) => onFilters({ offset })} />}
    </div>
  );
}
