import { COMPARISON_STATUSES, EMAIL_CATEGORIES } from "@/lib/shared/types";
import type { ComparisonStatus, EmailCategory } from "../../../_lib/contracts";
import { queryString } from "../../../_lib/api-client";

export type ProcessingFilter = "" | "processed" | "pending" | "failed";
export type SortField = "email_id" | "category" | "comparison_status" | "defect_count" | "updated_at";
export type GroupField = "" | "category" | "comparison_status";

export interface ResultFilters {
  q: string;
  categories: EmailCategory[];
  statuses: ComparisonStatus[];
  processing: ProcessingFilter;
  hasDefect: boolean;
  provider: string;
  sortBy: SortField;
  order: "asc" | "desc";
  groupBy: GroupField;
  limit: number;
  offset: number;
}

export const DEFAULT_FILTERS: ResultFilters = {
  q: "",
  categories: [],
  statuses: [],
  processing: "",
  hasDefect: false,
  provider: "",
  sortBy: "email_id",
  order: "asc",
  groupBy: "",
  limit: 25,
  offset: 0,
};

/** Pick out the values we understand from ?a=b&c=d links (e.g. the overview's "Mismatches" tile). Unknown values are ignored. */
export function filtersFromParams(params: Record<string, string | string[] | undefined>): ResultFilters {
  const one = (key: string) => (Array.isArray(params[key]) ? params[key]?.[0] : (params[key] as string | undefined)) ?? "";
  const list = (key: string) => one(key).split(",").map((v) => v.trim()).filter(Boolean);
  const processing = one("processing");

  return {
    ...DEFAULT_FILTERS,
    q: one("q"),
    provider: one("provider"),
    categories: list("category").filter((v): v is EmailCategory => (EMAIL_CATEGORIES as readonly string[]).includes(v)),
    statuses: list("status").filter((v): v is ComparisonStatus => (COMPARISON_STATUSES as readonly string[]).includes(v)),
    processing: processing === "processed" || processing === "pending" || processing === "failed" ? processing : "",
    hasDefect: one("has_defect") === "true",
  };
}

/** The filters that narrow the list, as the API's query parameters (used by the list and by export). */
export function filterParams(f: ResultFilters) {
  return {
    q: f.q.trim(),
    category: f.categories,
    status: f.statuses,
    processing: f.processing,
    has_defect: f.hasDefect,
    provider: f.provider.trim(),
  };
}

export function listUrl(f: ResultFilters): string {
  return `/features/results/api${queryString({
    ...filterParams(f),
    sort_by: f.sortBy,
    order: f.order,
    group_by: f.groupBy,
    limit: f.limit,
    offset: f.offset,
  })}`;
}

export function countActiveFilters(f: ResultFilters): number {
  return (
    (f.q.trim() ? 1 : 0) +
    f.categories.length +
    f.statuses.length +
    (f.processing ? 1 : 0) +
    (f.hasDefect ? 1 : 0) +
    (f.provider.trim() ? 1 : 0)
  );
}
