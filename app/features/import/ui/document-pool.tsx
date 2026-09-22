"use client";

import { useState } from "react";
import { SkeletonRows } from "../../../_components/motion/skeleton";
import { Pagination } from "../../../_components/pagination";
import { EmptyState, LoadError } from "../../../_components/results/states";
import type { ApiErrorInfo } from "../../../_components/api-error";
import type { DetectedType, DocumentList, DocumentReviewStatus } from "../../../_lib/contracts";
import { DocumentRow, type Slot } from "./document-row";
import type { Pair } from "./use-pair-check";

export interface PoolFilters {
  reviewStatus: "" | DocumentReviewStatus;
  detectedType: "" | DetectedType;
  offset: number;
}

interface Props {
  data: DocumentList | null;
  loading: boolean;
  error: ApiErrorInfo | null;
  onRetry: () => void;
  filters: PoolFilters;
  onFilters: (next: Partial<PoolFilters>) => void;
  onChanged: () => void;
  /** The pair being assembled, and how a row adds itself to it */
  pair: Pair;
  onPick: (slot: Slot, docId: string) => void;
}

export function DocumentPool({ data, loading, error, onRetry, filters, onFilters, onChanged, pair, onPick }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const slotOf = (id: string): Slot | null => (pair.si?.id === id ? "si" : pair.bl?.id === id ? "bl" : null);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4 sm:px-6">
        <div>
          <h2 className="text-lg font-bold">Document pool</h2>
          <p className="text-xs text-fg-muted">
            {data ? `${data.total.toLocaleString("en-US")} documents` : "Loading…"} · shared by everyone using this server. Pick an SI and a BL to check them against each other.
          </p>
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
          {data?.items.map((doc, i) => (
            <DocumentRow key={doc.id} doc={doc} index={i} open={openId === doc.id} slot={slotOf(doc.id)} onToggle={() => setOpenId((id) => (id === doc.id ? null : doc.id))} onPick={(slot) => onPick(slot, doc.id)} onChanged={onChanged} />
          ))}
        </div>
      )}
      {data && <Pagination total={data.total} limit={data.limit} offset={data.offset} onChange={(offset) => onFilters({ offset })} />}
    </section>
  );
}
