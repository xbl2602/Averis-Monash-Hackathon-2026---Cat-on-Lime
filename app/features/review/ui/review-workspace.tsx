"use client";

import { useCallback, useEffect, useState } from "react";
import { CountUp } from "../../../_components/motion/count-up";
import { Icon } from "../../../_components/icon";
import { DatabaseDown } from "../../../_components/results/states";
import { apiRequest } from "../../../_lib/api-client";
import type { ProviderOption } from "../../../_lib/provider-options";
import { useApi } from "../../../_lib/use-api";
import { useDebounced } from "../../../_lib/use-debounced";
import { BulkBar } from "./bulk-bar";
import { QueueList } from "./queue-list";
import { ReviewDetail } from "./review-detail";
import { DEFAULT_QUEUE_FILTERS, REVIEW_MODULES, queueUrl, type QueueFilters, type QueueResponse, type ReviewDisposition, type ReviewModule, type ReviewQueueItem } from "./review-api";
import { useReviewActions } from "./use-review-actions";

/** How many items wait in each module's queue, for the tab badges. Refreshes whenever `refreshKey` changes. */
function useQueueCounts(refreshKey: number): Partial<Record<ReviewModule, number>> {
  const [counts, setCounts] = useState<Partial<Record<ReviewModule, number>>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(REVIEW_MODULES.map(async ({ key }) => [key, await apiRequest<QueueResponse>(queueUrl(key, { ...DEFAULT_QUEUE_FILTERS, limit: 1 }))] as const)).then((entries) => {
      if (cancelled) return;
      setCounts(Object.fromEntries(entries.filter(([, r]) => r.ok).map(([key, r]) => [key, (r as { data: QueueResponse }).data.total])));
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  return counts;
}

export function ReviewWorkspace({ providers, initialEmail, initialModule }: { providers: ProviderOption[]; initialEmail: string; initialModule: ReviewModule }) {
  const [module, setModule] = useState<ReviewModule>(initialModule);
  const [filters, setFilters] = useState<QueueFilters>({ ...DEFAULT_QUEUE_FILTERS, includeOk: initialEmail !== "" });
  const [selected, setSelected] = useState<ReviewQueueItem | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailKey, setDetailKey] = useState(0);

  const debouncedQ = useDebounced(filters.q);
  const queue = useApi<QueueResponse>(queueUrl(module, { ...filters, q: debouncedQ }));
  const counts = useQueueCounts(refreshKey);
  const bulkActions = useReviewActions(module);

  // Deep link (?email=…): fetch that one item even if it is not in the default queue
  useEffect(() => {
    if (!initialEmail) return;
    apiRequest<QueueResponse>(queueUrl(initialModule, { ...DEFAULT_QUEUE_FILTERS, q: initialEmail, includeOk: true, limit: 5 })).then((r) => {
      const found = r.ok ? r.data.items.find((i) => i.email_id === initialEmail) : undefined;
      if (found) setSelected(found);
    });
  }, [initialEmail, initialModule]);

  // Keep the open item in step with the latest queue data (after a bulk action, a reload...)
  const items = queue.data?.items;
  useEffect(() => {
    if (!selected || !items) return;
    const fresh = items.find((i) => i.email_id === selected.email_id);
    if (fresh && fresh.updated_at !== selected.updated_at) setSelected(fresh);
  }, [items, selected]);

  const changed = useCallback(() => {
    setRefreshKey((n) => n + 1);
    queue.reload();
  }, [queue]);

  function switchModule(next: ReviewModule) {
    setModule(next);
    setFilters((f) => ({ ...f, offset: 0 }));
    setSelected(null);
    setChecked(new Set());
  }

  async function runBulk(action: "confirm" | "defer" | "disposition", disposition?: ReviewDisposition) {
    const result = await bulkActions.bulk([...checked], action, disposition ? { disposition } : undefined);
    if (!result) return;
    setChecked(new Set(result.failed.map((f) => f.email_id)));
    setDetailKey((n) => n + 1);
    changed();
  }

  if (queue.databaseDown) return <DatabaseDown what="The review queue" />;

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleAll = () =>
    setChecked((prev) => {
      const ids = items?.map((i) => i.email_id) ?? [];
      return ids.every((id) => prev.has(id)) ? new Set([...prev].filter((id) => !ids.includes(id))) : new Set([...prev, ...ids]);
    });

  const current = REVIEW_MODULES.find((m) => m.key === module)!;

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Review queues" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {REVIEW_MODULES.map((m, i) => {
          const active = m.key === module;
          const count = counts[m.key];
          return (
            <button
              key={m.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => switchModule(m.key)}
              style={{ "--i": i } as React.CSSProperties}
              className={`animate-pop stagger card card-hover flex flex-col items-start gap-2 p-4 text-left sm:flex-row sm:items-center sm:gap-3 ${active ? "!border-accent shadow-lg" : ""}`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${active ? "bg-accent text-white" : "bg-accent/12 text-accent-strong"}`}>
                <Icon name={m.icon} size={22} />
              </span>
              <span className="min-w-0 max-w-full">
                <span className="block truncate text-sm font-bold">{m.label}</span>
                <span className="block text-xl font-extrabold leading-tight">{count === undefined ? "–" : <CountUp value={count} duration={700} />}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-fg-muted">{current.blurb}</p>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className={`min-w-0 ${selected ? "hidden lg:block" : ""}`}>
          <QueueList
            filters={filters}
            onFilters={(next) => setFilters((f) => ({ ...f, ...next }))}
            data={queue.data}
            loading={queue.loading}
            error={queue.error}
            onRetry={queue.reload}
            selectedId={selected?.email_id ?? null}
            checked={checked}
            onOpen={setSelected}
            onCheck={toggleCheck}
            onCheckAll={toggleAll}
          />
        </div>

        <div className={`min-w-0 ${selected ? "" : "hidden lg:block"}`}>
          {selected ? (
            <div key={`${module}-${selected.email_id}-${detailKey}`} className="card animate-rise p-5 sm:p-7">
              <ReviewDetail module={module} item={selected} providers={providers} onItem={setSelected} onChanged={changed} onBack={() => setSelected(null)} />
            </div>
          ) : (
            <div className="card flex flex-col items-center px-6 py-20 text-center">
              <span className="animate-float flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/12 text-accent-strong">
                <Icon name="flag" size={38} />
              </span>
              <h2 className="mt-6 text-lg font-bold">Pick an item to review</h2>
              <p className="mt-2 max-w-sm text-sm text-fg-muted">Choose one from the queue to see what the system decided, the evidence behind it, and what you can do about it.</p>
            </div>
          )}
        </div>
      </div>

      <BulkBar count={checked.size} module={module} busy={bulkActions.busy} onRun={(action, disposition) => void runBulk(action, disposition)} onClear={() => setChecked(new Set())} />
    </div>
  );
}
