"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorNotice } from "../../../_components/error-notice";
import { Icon } from "../../../_components/icon";
import { PairResults } from "../../../_components/results/pair-results";
import { DatabaseDown } from "../../../_components/results/states";
import { queryString } from "../../../_lib/api-client";
import type { DocumentList, DocumentListItem } from "../../../_lib/contracts";
import { useApi } from "../../../_lib/use-api";
import { DocumentPool, type PoolFilters } from "./document-pool";
import type { Slot } from "./document-row";
import { PairTray } from "./pair-tray";
import { UploadPanel } from "./upload-panel";
import { usePairCheck, type Pair } from "./use-pair-check";

const PAGE_SIZE = 15;

export function DocumentsWorkspace() {
  const [filters, setFilters] = useState<PoolFilters>({ reviewStatus: "", detectedType: "", offset: 0 });
  const [pair, setPair] = useState<Pair>({ si: null, bl: null });
  const check = usePairCheck();
  const verdictRef = useRef<HTMLDivElement>(null);

  const pool = useApi<DocumentList>(
    `/features/import/api/documents${queryString({ review_status: filters.reviewStatus, detected_type: filters.detectedType, limit: PAGE_SIZE, offset: filters.offset })}`
  );

  // Bring the verdict into view when it arrives (it renders above the pool, which may be scrolled far down)
  useEffect(() => {
    if (check.result || check.error) verdictRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [check.result, check.error]);

  // Uploads and the pool both live in the database, so without one there is nothing to show
  if (pool.databaseDown) return <DatabaseDown what="The document pool" />;

  /** Choosing a document for a slot: a second click removes it, and one document never fills both slots. */
  function pick(slot: Slot, docId: string) {
    const doc = pool.data?.items.find((d) => d.id === docId);
    if (!doc) return;
    check.reset();
    setPair((current) => {
      const other: Slot = slot === "si" ? "bl" : "si";
      if (current[slot]?.id === docId) return { ...current, [slot]: null };
      return { ...current, [slot]: doc, ...(current[other]?.id === docId ? { [other]: null } : {}) } as Pair;
    });
  }

  const swap = () => setPair((p) => ({ si: p.bl, bl: p.si }));
  const clear = () => {
    setPair({ si: null, bl: null });
    check.reset();
  };
  const run = () => pair.si && pair.bl && void check.run(pair.si as DocumentListItem, pair.bl as DocumentListItem);

  return (
    <div className="space-y-8">
      <UploadPanel onUploaded={pool.reload} />

      <div ref={verdictRef} className="scroll-mt-24 space-y-5" aria-live="polite">
        {check.error && <ErrorNotice error={check.error} />}
        {check.result && (
          <section className="animate-rise space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="eyebrow">Pair check</div>
                <h2 className="mt-1 truncate text-lg font-bold">
                  {check.result.si.file_name} <span className="text-fg-faint">against</span> {check.result.bl.file_name}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                  <Icon name="info" size={13} className="text-fg-faint" />
                  Checked on the text that was read from each file. Nothing is saved.
                </p>
              </div>
              <button type="button" onClick={check.reset} className="btn btn-glass !py-2">
                <Icon name="x" size={15} />
                Close
              </button>
            </div>
            <PairResults result={check.result.data} />
          </section>
        )}
      </div>

      <DocumentPool data={pool.data} loading={pool.loading} error={pool.error} onRetry={pool.reload} filters={filters} onFilters={(next) => setFilters((f) => ({ ...f, ...next }))} onChanged={pool.reload} pair={pair} onPick={pick} />

      <PairTray pair={pair} busy={check.busy} onCheck={run} onSwap={swap} onClear={clear} />
    </div>
  );
}
