import type { ComparisonStatus } from "../../../_lib/contracts";
import { queryString } from "../../../_lib/api-client";

export type NumericField = "container_count" | "gross_weight_kg";

export interface ConflictFilters {
  statuses: ComparisonStatus[];
  q: string;
  sortBy: "email_id" | "defect_count" | "updated_at";
  order: "asc" | "desc";
  numericMode: "exact" | "fuzzy";
  /** Blank = use the engine's default tolerance */
  tolerance: string;
  valueField: NumericField | "";
  value: string;
  limit: number;
  offset: number;
}

export const DEFAULT_CONFLICT_FILTERS: ConflictFilters = {
  statuses: ["MISMATCH", "NEEDS_REVIEW"],
  q: "",
  sortBy: "defect_count",
  order: "desc",
  numericMode: "exact",
  tolerance: "",
  valueField: "",
  value: "",
  limit: 15,
  offset: 0,
};

/** The API rejects a half-filled value search and a tolerance in exact mode, so only send what is complete. */
export function conflictParams(f: ConflictFilters) {
  const valueSearch = f.valueField !== "" && f.value.trim() !== "";
  return {
    status: f.statuses,
    q: f.q.trim(),
    sort_by: f.sortBy,
    order: f.order,
    numeric_mode: f.numericMode === "fuzzy" ? "fuzzy" : "",
    tolerance: f.numericMode === "fuzzy" ? f.tolerance.trim() : "",
    value_field: valueSearch ? f.valueField : "",
    value: valueSearch ? f.value.trim() : "",
  };
}

export function conflictsUrl(f: ConflictFilters): string {
  return `/features/results/api/conflicts${queryString({ ...conflictParams(f), limit: f.limit, offset: f.offset })}`;
}
