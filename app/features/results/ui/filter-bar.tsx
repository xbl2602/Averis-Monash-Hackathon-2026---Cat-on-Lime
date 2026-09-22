"use client";

import { COMPARISON_STATUSES, EMAIL_CATEGORIES } from "@/lib/shared/types";
import { Icon } from "../../../_components/icon";
import { CATEGORY_META, STATUS_META } from "../../../_lib/labels";
import { countActiveFilters, DEFAULT_FILTERS, type GroupField, type ProcessingFilter, type ResultFilters, type SortField } from "./filters";

function Chip({ active, color, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition duration-200 active:scale-95 ${
        active ? "border-accent bg-accent/15 text-fg shadow-sm" : "border-line bg-sunken text-fg-muted hover:border-line-strong hover:text-fg"
      }`}
    >
      {color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

const PROCESSING: { value: ProcessingFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "processed", label: "Processed" },
  { value: "pending", label: "Not run yet" },
  { value: "failed", label: "Failed" },
];

const SORTS: { value: SortField; label: string }[] = [
  { value: "email_id", label: "Email ID" },
  { value: "updated_at", label: "Last updated" },
  { value: "defect_count", label: "Number of mismatches" },
  { value: "comparison_status", label: "Outcome" },
  { value: "category", label: "Category" },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** `classifierUncertainty`: the server reports how sure the classifier was, so filtering on it is possible. */
export function FilterBar({ filters, onChange, classifierUncertainty }: { filters: ResultFilters; onChange: (next: Partial<ResultFilters>) => void; classifierUncertainty: boolean }) {
  const active = countActiveFilters(filters);
  // Any filter change goes back to the first page
  const set = (next: Partial<ResultFilters>) => onChange({ ...next, offset: 0 });

  return (
    <div className="card space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint" />
          <input
            type="search"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search by email ID, sender or subject"
            aria-label="Search results"
            className="field !pl-11"
          />
        </div>
        <div className="flex items-center gap-2">
          <select value={filters.sortBy} onChange={(e) => onChange({ sortBy: e.target.value as SortField, offset: 0 })} aria-label="Sort by" className="field !w-auto">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange({ order: filters.order === "asc" ? "desc" : "asc", offset: 0 })}
            aria-label={`Order: ${filters.order === "asc" ? "ascending" : "descending"}`}
            className="btn btn-glass !px-3.5 !py-2.5"
          >
            <Icon name={filters.order === "asc" ? "chevronUp" : "chevronDown"} size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-fg-faint">Outcome</span>
        {COMPARISON_STATUSES.map((status) => (
          <Chip key={status} active={filters.statuses.includes(status)} color={STATUS_META[status].color} onClick={() => set({ statuses: toggle(filters.statuses, status) })}>
            {STATUS_META[status].label}
          </Chip>
        ))}
        <Chip active={filters.hasDefect} color="var(--bad)" onClick={() => set({ hasDefect: !filters.hasDefect })}>
          Real defects only
        </Chip>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-fg-faint">Category</span>
        {EMAIL_CATEGORIES.map((category) => (
          <Chip key={category} active={filters.categories.includes(category)} color={CATEGORY_META[category].color} onClick={() => set({ categories: toggle(filters.categories, category) })}>
            {CATEGORY_META[category].label}
          </Chip>
        ))}
        {(classifierUncertainty || filters.classificationReview) && (
          <Chip active={filters.classificationReview} color="var(--warn)" onClick={() => set({ classificationReview: !filters.classificationReview })}>
            Classifier unsure
          </Chip>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Processing state" className="flex rounded-full border border-line bg-sunken p-1">
            {PROCESSING.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => set({ processing: p.value })}
                aria-pressed={filters.processing === p.value}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${filters.processing === p.value ? "bg-surface-solid text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Chip active={filters.provider === "degraded"} color="var(--warn)" onClick={() => set({ provider: filters.provider === "degraded" ? "" : "degraded" })}>
            Fallback answers only
          </Chip>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select value={filters.groupBy} onChange={(e) => set({ groupBy: e.target.value as GroupField })} aria-label="Group by" className="field !w-auto">
            <option value="">No grouping</option>
            <option value="comparison_status">Group by outcome</option>
            <option value="category">Group by category</option>
          </select>
          <button type="button" disabled={active === 0} onClick={() => onChange({ ...DEFAULT_FILTERS, sortBy: filters.sortBy, order: filters.order, limit: filters.limit })} className="btn btn-glass !py-2">
            <Icon name="refresh" size={16} />
            Reset{active > 0 ? ` (${active})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
