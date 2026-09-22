/**
 * The single validation/normalization entry point for query parameters.
 *
 * The HTTP layer converts the query string into raw values (strings/comma-separated), and the MCP
 * layer passes typed parameters straight in; both go through here so there's "one set of validation
 * rules" instead of each transport layer rewriting its own.
 */
import { COMPARISON_STATUSES, EMAIL_CATEGORIES } from "@/lib/shared/types";
import { ResultQueryError } from "./errors";
import {
  CONFLICT_SORT_FIELDS,
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  GROUP_FIELDS,
  NUMERIC_MODES,
  NUMERIC_SEARCH_FIELDS,
  PROCESSING_STATES,
  RESULT_SORT_FIELDS,
  SORT_ORDERS,
  type ConflictQuery,
  type ConflictSortField,
  type ExportFormat,
  type ExportRequest,
  type ExportScope,
  type GroupField,
  type NumericMode,
  type NumericSearchField,
  type ResultQuery,
  type ResultSortField,
  type SortOrder,
} from "./types";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

// Raw input shared by both transport layers: values may be a string, array, number, or boolean (none of it trusted)
export interface RawQueryInput {
  category?: unknown;
  status?: unknown;
  processing?: unknown;
  has_defect?: unknown;
  provider?: unknown;
  q?: unknown;
  sort_by?: unknown;
  order?: unknown;
  group_by?: unknown;
  limit?: unknown;
  offset?: unknown;
  numeric_mode?: unknown;
  tolerance?: unknown;
  value_field?: unknown;
  value?: unknown;
}

export interface RawConflictQueryInput {
  status?: unknown;
  q?: unknown;
  sort_by?: unknown;
  order?: unknown;
  limit?: unknown;
  offset?: unknown;
  numeric_mode?: unknown;
  tolerance?: unknown;
  value_field?: unknown;
  value?: unknown;
}

export interface RawExportInput extends RawQueryInput {
  scope?: unknown;
  format?: unknown;
}

export function normalizeResultQuery(raw: RawQueryInput): ResultQuery {
  const sortBy = (pickOne(toStringList(raw.sort_by), RESULT_SORT_FIELDS, "sort_by") ??
    "email_id") as ResultSortField;

  return {
    categories: pickAll(toStringList(raw.category), EMAIL_CATEGORIES, "category"),
    statuses: pickAll(toStringList(raw.status), COMPARISON_STATUSES, "status"),
    processing: pickOne(toStringList(raw.processing), PROCESSING_STATES, "processing"),
    hasDefect: toBoolean(raw.has_defect, "has_defect"),
    provider: toShortText(raw.provider, "provider", 64),
    q: toShortText(raw.q, "q", 100),
    sortBy,
    order: resolveOrder(raw.order, sortBy),
    groupBy: pickOne(toStringList(raw.group_by), GROUP_FIELDS, "group_by"),
    limit: resolveLimit(raw.limit),
    offset: resolveOffset(raw.offset),
  };
}

export function normalizeConflictQuery(raw: RawConflictQueryInput): ConflictQuery {
  const sortBy = (pickOne(toStringList(raw.sort_by), CONFLICT_SORT_FIELDS, "sort_by") ??
    "defect_count") as ConflictSortField;
  const statuses = pickAll(toStringList(raw.status), COMPARISON_STATUSES, "status");

  // Numeric mode / search by value (2026-09-21 P1-6): the two parameters are validated as a pair, to avoid an ambiguous request that "gives a field without a value"
  const numericMode = (pickOne(toStringList(raw.numeric_mode), NUMERIC_MODES, "numeric_mode") ??
    "exact") as NumericMode;
  const tolerance = toTolerance(raw.tolerance);
  if (tolerance !== null && numericMode !== "fuzzy") {
    throw new ResultQueryError("tolerance is only usable when numeric_mode=fuzzy (exact mode doesn't allow a tolerance)");
  }
  const valueField = (pickOne(
    toStringList(raw.value_field),
    NUMERIC_SEARCH_FIELDS,
    "value_field"
  ) ?? null) as NumericSearchField | null;
  const value = toNumericValue(raw.value);
  if ((valueField === null) !== (value === null)) {
    throw new ResultQueryError("value_field and value must be given as a pair (both are required for search-by-value)");
  }

  return {
    // Default to "everything that needs attention": MISMATCH + NEEDS_REVIEW
    statuses: statuses ?? ["MISMATCH", "NEEDS_REVIEW"],
    q: toShortText(raw.q, "q", 100),
    sortBy,
    order: resolveOrder(raw.order, sortBy),
    limit: resolveLimit(raw.limit),
    offset: resolveOffset(raw.offset),
    numericMode,
    tolerance,
    valueField,
    value,
  };
}

export function normalizeExportRequest(raw: RawExportInput): ExportRequest {
  const scope = (pickOne(toStringList(raw.scope), EXPORT_SCOPES, "scope") ?? "results") as ExportScope;
  const format = (pickOne(toStringList(raw.format), EXPORT_FORMATS, "format") ?? "json") as ExportFormat;

  if (scope === "submission" && format !== "json") {
    throw new ResultQueryError(
      "scope=submission exports the plain JSON file used for official scoring, which only supports format=json (for txt/md/csv use scope=results or scope=conflicts)"
    );
  }

  return {
    scope,
    format,
    query: normalizeResultQuery(raw),
    conflictQuery: normalizeConflictQuery(raw),
  };
}

// -- Below are small parsing utilities: all defensive against unknown input --

function toStringList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const parts = Array.isArray(value) ? value : String(value).split(",");
  const cleaned = parts.map((part) => String(part).trim()).filter((part) => part !== "");
  return cleaned.length ? cleaned : undefined;
}

function pickAll<T extends string>(
  values: string[] | undefined,
  allowed: readonly T[],
  label: string
): T[] | undefined {
  if (!values) return undefined;
  const unknown = values.filter((value) => !allowed.includes(value as T));
  if (unknown.length) {
    throw new ResultQueryError(
      `${label} does not support: ${unknown.join(" / ")} (allowed: ${allowed.join(" / ")})`
    );
  }
  return [...new Set(values)] as T[];
}

function pickOne<T extends string>(
  values: string[] | undefined,
  allowed: readonly T[],
  label: string
): T | undefined {
  if (!values) return undefined;
  const picked = pickAll(values, allowed, label);
  return picked?.[0];
}

function toBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const text = String(value).toLowerCase();
  if (text === "true" || text === "1") return true;
  if (text === "false" || text === "0") return false;
  throw new ResultQueryError(`${label} must be true / false, got: ${String(value)}`);
}

function toShortText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (text === "") return undefined;
  if (text.length > maxLength) {
    throw new ResultQueryError(`${label} is too long (max ${maxLength} characters)`);
  }
  return text;
}

/** Tolerance: a non-negative finite number; omitted = null (numeric-query.ts applies the per-field default) */
function toTolerance(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ResultQueryError(`tolerance must be a number >= 0, got: ${String(value)}`);
  }
  return parsed;
}

/** Numeric value for search-by-value: must be a valid finite number; returned as-is as a string, converted again when compared */
function toNumericValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!Number.isFinite(Number(text))) {
    throw new ResultQueryError(`value must be a number (decimals allowed), got: ${text}`);
  }
  return text;
}

function resolveLimit(value: unknown): number {
  const limit = toInteger(value, DEFAULT_LIMIT, "limit");
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new ResultQueryError(`limit must be between 1 and ${MAX_LIMIT}, got: ${limit}`);
  }
  return limit;
}

function resolveOffset(value: unknown): number {
  const offset = toInteger(value, 0, "offset");
  if (offset < 0) throw new ResultQueryError(`offset cannot be less than 0, got: ${offset}`);
  return offset;
}

function toInteger(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new ResultQueryError(`${label} must be an integer, got: ${String(value)}`);
  }
  return parsed;
}

// Default sort direction: ascending reads more naturally by email_id; descending reads more naturally by defect count/time
function resolveOrder(value: unknown, sortBy: string): SortOrder {
  const order = pickOne(toStringList(value), SORT_ORDERS, "order");
  if (order) return order;
  return sortBy === "email_id" ? "asc" : "desc";
}
