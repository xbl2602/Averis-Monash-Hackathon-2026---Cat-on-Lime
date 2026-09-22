"use client";

import { useState } from "react";
import { COMPARISON_STATUSES } from "@/lib/shared/types";
import { Icon } from "../../../_components/icon";
import { CountUp } from "../../../_components/motion/count-up";
import { Skeleton } from "../../../_components/motion/skeleton";
import { Pagination } from "../../../_components/pagination";
import { DatabaseDown, EmptyState, LoadError } from "../../../_components/results/states";
import type { ComparisonStatus, ConflictList } from "../../../_lib/contracts";
import { STATUS_META } from "../../../_lib/labels";
import { useApi } from "../../../_lib/use-api";
import { useDebounced } from "../../../_lib/use-debounced";
import { useReviewOverlay } from "../../../_lib/use-review-overlay";
import { serverSendsReview } from "../../../_lib/backend-contract";
import { conflictParams, conflictsUrl, DEFAULT_CONFLICT_FILTERS, type ConflictFilters } from "./conflict-filters";
import { ConflictCard } from "./conflict-card";
import { ExportPanel } from "./export-panel";
import { NumericSearch } from "./numeric-search";

export function ConflictsExplorer() {
  const [filters, setFilters] = useState<ConflictFilters>(DEFAULT_CONFLICT_FILTERS);
  const [exportOpen, setExportOpen] = useState(false);

  const debounced = {
    ...filters,
    q: useDebounced(filters.q),
    tolerance: useDebounced(filters.tolerance),
    value: useDebounced(filters.value),
  };
  const { data, error, databaseDown, loading, reload } = useApi<ConflictList>(conflictsUrl(debounced));
  const reviewOf = useReviewOverlay({ enabled: data !== null && !serverSendsReview(data.items), modules: ["comparison"] });
  const update = (next: Partial<ConflictFilters>) => setFilters((prev) => ({ ...prev, ...next }));

  const toggleStatus = (status: ComparisonStatus) =>
    update({
      offset: 0,
      // Keep at least one outcome selected, otherwise the list is always empty
      statuses: filters.statuses.includes(status) ? (filters.statuses.length > 1 ? filters.statuses.filter((s) => s !== status) : filters.statuses) : [...filters.statuses, status],
    });

  if (databaseDown) return <DatabaseDown what="The conflicts list" />;

  return (
    <div className="space-y-5">
      <div className="card space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" />
            <input type="search" value={filters.q} onChange={(e) => update({ q: e.target.value, offset: 0 })} placeholder="Search by email ID, sender or subject" aria-label="Search conflicts" className="field !pl-11" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {COMPARISON_STATUSES.filter((s) => s !== "OK").map((status) => {
              const active = filters.statuses.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStatus(status)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${active ? "border-accent bg-accent/15" : "border-line bg-sunken text-fg-muted hover:border-line-strong"}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                  {STATUS_META[status].label}
                </button>
              );
            })}
            <select value={filters.sortBy} onChange={(e) => update({ sortBy: e.target.value as ConflictFilters["sortBy"], offset: 0 })} aria-label="Sort by" className="field !w-auto">
              <option value="defect_count">Most mismatches first</option>
              <option value="updated_at">Recently updated</option>
              <option value="email_id">Email ID</option>
            </select>
            <button type="button" onClick={() => update({ order: filters.order === "asc" ? "desc" : "asc", offset: 0 })} aria-label={`Order: ${filters.order === "asc" ? "ascending" : "descending"}`} className="btn btn-glass !px-3.5 !py-2.5">
              <Icon name={filters.order === "asc" ? "chevronUp" : "chevronDown"} size={18} />
            </button>
          </div>
        </div>
        <div className="border-t border-line pt-5">
          <NumericSearch filters={filters} onChange={update} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-fg-muted">
          {data ? (
            <>
              <span className="text-2xl font-extrabold text-fg">
                <CountUp value={data.total} duration={700} />
              </span>{" "}
              {data.total === 1 ? "email has" : "emails have"} conflicts
            </>
          ) : (
            "Loading…"
          )}
        </div>
        <button type="button" onClick={() => setExportOpen((v) => !v)} aria-expanded={exportOpen} className="btn btn-primary btn-shine !py-2.5">
          <Icon name="download" size={17} />
          Export amendment list
          <Icon name="chevronDown" size={16} className={`transition duration-300 ${exportOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="expand" data-open={exportOpen}>
        <div>
          <div className="pb-1">
            <ExportPanel scopes={["conflicts", "results", "submission"]} initialScope="conflicts" conflictParams={conflictParams(debounced)} />
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-5" role="status" aria-label="Loading conflicts">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 !rounded-3xl" />
          ))}
        </div>
      ) : error ? (
        <LoadError error={error} onRetry={reload} />
      ) : data && data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon="checkCircle" title="No conflicts match" action={<button type="button" onClick={() => setFilters(DEFAULT_CONFLICT_FILTERS)} className="btn btn-glass">Reset the filters</button>}>
            Either everything agrees, or your filters are narrower than the data. Loosen the search or switch number matching back to exact.
          </EmptyState>
        </div>
      ) : (
        <div className={`space-y-5 transition-opacity duration-200 ${loading ? "opacity-50" : ""}`}>
          {data?.items.map((pair, i) => <ConflictCard key={pair.email_id} pair={pair} review={reviewOf(pair)} index={i} />)}
          {data && (
            <div className="card overflow-hidden">
              <Pagination total={data.total} limit={data.limit} offset={data.offset} onChange={(offset) => update({ offset })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
