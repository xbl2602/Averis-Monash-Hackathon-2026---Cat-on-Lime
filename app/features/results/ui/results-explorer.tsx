"use client";

import { useState } from "react";
import { Icon } from "../../../_components/icon";
import { CountUp } from "../../../_components/motion/count-up";
import { SkeletonRows } from "../../../_components/motion/skeleton";
import { Pagination } from "../../../_components/pagination";
import { DatabaseDown, EmptyState, LoadError } from "../../../_components/results/states";
import type { ComparisonStatus, EmailCategory, ResultList } from "../../../_lib/contracts";
import { useApi } from "../../../_lib/use-api";
import { useDebounced } from "../../../_lib/use-debounced";
import { ExportPanel } from "./export-panel";
import { FilterBar } from "./filter-bar";
import { DEFAULT_FILTERS, filterParams, listUrl, type ResultFilters } from "./filters";
import { GroupChips } from "./group-chips";
import { ResultRowItem } from "./result-row";

/** Filters, list, pagination and export for saved results. All the fetching lives here; the pieces below are display only. */
export function ResultsExplorer({ initial }: { initial: ResultFilters }) {
  const [filters, setFilters] = useState<ResultFilters>({ ...DEFAULT_FILTERS, ...initial });
  const [openId, setOpenId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  // Typing in the search or engine boxes should not fire a request per keystroke
  const debouncedQ = useDebounced(filters.q);
  const debouncedProvider = useDebounced(filters.provider);
  const requestFilters = { ...filters, q: debouncedQ, provider: debouncedProvider };

  const { data, error, databaseDown, loading, reload } = useApi<ResultList>(listUrl(requestFilters));
  const update = (next: Partial<ResultFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setOpenId(null);
  };

  /** Clicking a group chip narrows the list to that group and turns grouping off. */
  function pickGroup(key: string) {
    if (key === "NOT_PROCESSED") update({ processing: "pending", groupBy: "", offset: 0 });
    else if (filters.groupBy === "category") update({ categories: [key as EmailCategory], groupBy: "", offset: 0 });
    else update({ statuses: [key as ComparisonStatus], groupBy: "", offset: 0 });
  }

  if (databaseDown) return <DatabaseDown what="The results list" />;

  return (
    <div className="space-y-5">
      <FilterBar filters={filters} onChange={update} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-fg-muted">
          {data ? (
            <>
              <span className="text-2xl font-extrabold text-fg">
                <CountUp value={data.total} duration={700} />
              </span>{" "}
              {data.total === 1 ? "email" : "emails"} match
            </>
          ) : (
            "Loading…"
          )}
        </div>
        <button type="button" onClick={() => setExportOpen((v) => !v)} aria-expanded={exportOpen} className="btn btn-primary btn-shine !py-2.5">
          <Icon name="download" size={17} />
          Export
          <Icon name="chevronDown" size={16} className={`transition duration-300 ${exportOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="expand" data-open={exportOpen}>
        <div>
          <div className="pb-1">
            <ExportPanel scopes={["results", "conflicts", "stats", "submission"]} initialScope="results" filterParams={filterParams(requestFilters)} />
          </div>
        </div>
      </div>

      {data?.groups && <GroupChips groupBy={filters.groupBy} groups={data.groups} onPick={pickGroup} />}

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_9rem_9.5rem_minmax(0,1.1fr)_7rem_1.5rem] gap-x-4 bg-sunken px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-fg-faint lg:grid">
          <span>Email</span>
          <span>Category</span>
          <span>Outcome</span>
          <span>Mismatching fields</span>
          <span>Updated</span>
          <span />
        </div>

        {loading && !data ? (
          <SkeletonRows rows={7} />
        ) : error ? (
          <div className="p-5">
            <LoadError error={error} onRetry={reload} />
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState icon="search" title="Nothing matches those filters" action={<button type="button" onClick={() => update({ ...DEFAULT_FILTERS, sortBy: filters.sortBy, order: filters.order })} className="btn btn-glass">Clear all filters</button>}>
            Try removing a filter, or search for a different email ID or sender.
          </EmptyState>
        ) : (
          <div className={`transition-opacity duration-200 ${loading ? "opacity-50" : ""}`}>
            {data?.items.map((row, i) => (
              <ResultRowItem key={row.email_id} row={row} index={i} open={openId === row.email_id} onToggle={() => setOpenId((id) => (id === row.email_id ? null : row.email_id))} />
            ))}
          </div>
        )}

        {data && <Pagination total={data.total} limit={data.limit} offset={data.offset} onChange={(offset) => update({ offset })} />}
      </div>
    </div>
  );
}
