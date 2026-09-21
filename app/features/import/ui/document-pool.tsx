"use client";

import { useState } from "react";
import { Icon } from "../../../_components/icon";
import { SkeletonRows } from "../../../_components/motion/skeleton";
import { Pagination } from "../../../_components/pagination";
import { Badge } from "../../../_components/results/badges";
import { EmptyState, LoadError } from "../../../_components/results/states";
import type { ApiErrorInfo } from "../../../_components/api-error";
import type { DetectedType, DocumentList, DocumentReviewStatus } from "../../../_lib/contracts";
import { formatBytes, relativeTime } from "../../../_lib/format";
import { DocumentDetailPanel } from "./document-detail";

export interface PoolFilters {
  reviewStatus: "" | DocumentReviewStatus;
  detectedType: "" | DetectedType;
  offset: number;
}

const TYPE_TONE = { SI: "info", BL: "info", OTHER: "muted", UNKNOWN: "warn" } as const;

export function DocumentPool({ data, loading, error, onRetry, filters, onFilters, onChanged }: { data: DocumentList | null; loading: boolean; error: ApiErrorInfo | null; onRetry: () => void; filters: PoolFilters; onFilters: (next: Partial<PoolFilters>) => void; onChanged: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 sm:px-6">
        <div>
          <h2 className="text-lg font-bold">Document pool</h2>
          <p className="text-xs text-fg-muted">{data ? `${data.total.toLocaleString("en-US")} documents` : "Loading…"} · shared by everyone using this server</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filters.detectedType} onChange={(e) => onFilters({ detectedType: e.target.value as PoolFilters["detectedType"], offset: 0 })} aria-label="Type" className="field !w-auto !py-2 !text-xs">
            <option value="">Any type</option>
            <option value="SI">SI</option>
            <option value="BL">BL</option>
            <option value="OTHER">Other</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
          <select value={filters.reviewStatus} onChange={(e) => onFilters({ reviewStatus: e.target.value as PoolFilters["reviewStatus"], offset: 0 })} aria-label="Filing status" className="field !w-auto !py-2 !text-xs">
            <option value="">Any status</option>
            <option value="pending">Waiting to be filed</option>
            <option value="filed">Filed</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>
      </div>

      {loading && !data ? (
        <SkeletonRows rows={5} />
      ) : error ? (
        <div className="p-5">
          <LoadError error={error} onRetry={onRetry} />
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState icon="folder" title="No documents yet">Upload an SI or BL above and it will appear here, identified by what is inside it.</EmptyState>
      ) : (
        <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
          {data?.items.map((doc, i) => {
            const open = openId === doc.id;
            return (
              <div key={doc.id} className="border-t border-line first:border-t-0">
                <button type="button" onClick={() => setOpenId(open ? null : doc.id)} aria-expanded={open} data-open={open} style={{ "--i": Math.min(i, 10) } as React.CSSProperties} className="row-hover animate-rise stagger flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left sm:px-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-strong">
                    <Icon name="file" size={20} />
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <div className="truncate text-sm font-semibold">{doc.file_name}</div>
                    <div className="text-[11px] text-fg-faint">
                      {formatBytes(doc.file_size)} · {relativeTime(doc.updated_at)}
                    </div>
                  </div>
                  <Badge tone={TYPE_TONE[doc.detected_type]} icon="file">{doc.detected_type}</Badge>
                  {doc.parse_status === "unreadable" && <Badge tone="warn" icon="alert">Unreadable</Badge>}
                  <Badge tone={doc.review_status === "filed" ? "ok" : doc.review_status === "skipped" ? "muted" : "warn"} icon={doc.review_status === "filed" ? "checkCircle" : "clock"}>
                    {doc.review_status === "pending" ? "To file" : doc.review_status === "filed" ? "Filed" : "Skipped"}
                  </Badge>
                  <Icon name="chevronDown" size={18} className={`text-fg-faint transition duration-300 ${open ? "rotate-180 text-accent-strong" : ""}`} />
                </button>
                <div className="expand" data-open={open}>
                  <div>{open && <DocumentDetailPanel id={doc.id} onChanged={onChanged} />}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data && <Pagination total={data.total} limit={data.limit} offset={data.offset} onChange={(offset) => onFilters({ offset })} />}
    </section>
  );
}
