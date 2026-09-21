"use client";

import { Icon } from "../../../_components/icon";
import type { ConflictFilters, NumericField } from "./conflict-filters";

/**
 * Number-aware search for weights and container counts. "Exact" is how results are stored and submitted;
 * "Tolerance" hides tiny differences (a kilo or two) so real ones stand out. It only changes what you see here.
 */
export function NumericSearch({ filters, onChange }: { filters: ConflictFilters; onChange: (next: Partial<ConflictFilters>) => void }) {
  const fuzzy = filters.numericMode === "fuzzy";
  const halfFilled = (filters.valueField !== "") !== (filters.value.trim() !== "");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Icon name="sliders" size={18} className="text-accent-strong" />
          Number matching
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Number matching" className="flex rounded-full border border-line bg-sunken p-1">
            {(["exact", "fuzzy"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ numericMode: mode, offset: 0 })}
                aria-pressed={filters.numericMode === mode}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${filters.numericMode === mode ? "bg-surface-solid text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
              >
                {mode === "exact" ? "Exact" : "With tolerance"}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-2 transition ${fuzzy ? "" : "pointer-events-none opacity-40"}`}>
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={filters.tolerance}
              disabled={!fuzzy}
              onChange={(e) => onChange({ tolerance: e.target.value, offset: 0 })}
              placeholder="auto"
              aria-label="Tolerance in kilograms"
              className="field !w-24 text-center"
            />
            <span className="text-xs text-fg-faint">kg (blank = default)</span>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-fg-faint">
          {fuzzy ? "Differences inside the tolerance no longer count as conflicts here. The official submission is never affected." : "A number that is off by even 1 is a conflict, exactly as in the submission."}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Icon name="target" size={18} className="text-accent-strong" />
          Find by value
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={filters.valueField} onChange={(e) => onChange({ valueField: e.target.value as NumericField | "", offset: 0 })} aria-label="Field to search" className="field !w-auto">
            <option value="">Any field…</option>
            <option value="gross_weight_kg">Gross weight (kg)</option>
            <option value="container_count">Container count</option>
          </select>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            value={filters.value}
            onChange={(e) => onChange({ value: e.target.value, offset: 0 })}
            placeholder="e.g. 12000"
            aria-label="Value to find"
            className="field !w-36"
          />
        </div>
        <p className={`mt-2 text-xs leading-relaxed ${halfFilled ? "text-warn" : "text-fg-faint"}`}>
          {halfFilled ? "Pick both a field and a number to search by value." : "Finds emails where either the SI or the BL has that number."}
        </p>
      </div>
    </div>
  );
}
