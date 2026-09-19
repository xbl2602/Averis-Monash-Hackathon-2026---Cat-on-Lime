/**
 * 查询参数的唯一校验/归一化入口。
 *
 * HTTP 层把 query string 转成原始值（字符串/逗号分隔），MCP 层直接把 typed 参数传进来，
 * 两边都走这里，保证"同一份校验规则"，不在各自传输层重写一遍。
 */
import { COMPARISON_STATUSES, EMAIL_CATEGORIES } from "@/lib/shared/types";
import { ResultQueryError } from "./errors";
import {
  CONFLICT_SORT_FIELDS,
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  GROUP_FIELDS,
  PROCESSING_STATES,
  RESULT_SORT_FIELDS,
  SORT_ORDERS,
  type ConflictQuery,
  type ConflictSortField,
  type ExportFormat,
  type ExportRequest,
  type ExportScope,
  type GroupField,
  type ResultQuery,
  type ResultSortField,
  type SortOrder,
} from "./types";

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

// 两种传输层共用的原始输入：值可能是字符串、数组、数字、布尔（都不信任）
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
}

export interface RawConflictQueryInput {
  status?: unknown;
  q?: unknown;
  sort_by?: unknown;
  order?: unknown;
  limit?: unknown;
  offset?: unknown;
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

  return {
    // 缺省看"所有需要人关注的"：MISMATCH + NEEDS_REVIEW
    statuses: statuses ?? ["MISMATCH", "NEEDS_REVIEW"],
    q: toShortText(raw.q, "q", 100),
    sortBy,
    order: resolveOrder(raw.order, sortBy),
    limit: resolveLimit(raw.limit),
    offset: resolveOffset(raw.offset),
  };
}

export function normalizeExportRequest(raw: RawExportInput): ExportRequest {
  const scope = (pickOne(toStringList(raw.scope), EXPORT_SCOPES, "scope") ?? "results") as ExportScope;
  const format = (pickOne(toStringList(raw.format), EXPORT_FORMATS, "format") ?? "json") as ExportFormat;

  if (scope === "submission" && format !== "json") {
    throw new ResultQueryError(
      "scope=submission 导出的是给官方评分用的纯 JSON 文件，只支持 format=json（txt/md 请用 scope=results 或 scope=conflicts）"
    );
  }

  return {
    scope,
    format,
    query: normalizeResultQuery(raw),
    conflictQuery: normalizeConflictQuery(raw),
  };
}

// —— 下面是小的解析工具：全部对未知输入做防御 ——

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
      `${label} 不支持：${unknown.join(" / ")}（可选：${allowed.join(" / ")}）`
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
  throw new ResultQueryError(`${label} 只能是 true / false，收到：${String(value)}`);
}

function toShortText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (text === "") return undefined;
  if (text.length > maxLength) {
    throw new ResultQueryError(`${label} 太长了（最多 ${maxLength} 个字符）`);
  }
  return text;
}

function resolveLimit(value: unknown): number {
  const limit = toInteger(value, DEFAULT_LIMIT, "limit");
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new ResultQueryError(`limit 必须在 1~${MAX_LIMIT} 之间，收到：${limit}`);
  }
  return limit;
}

function resolveOffset(value: unknown): number {
  const offset = toInteger(value, 0, "offset");
  if (offset < 0) throw new ResultQueryError(`offset 不能小于 0，收到：${offset}`);
  return offset;
}

function toInteger(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new ResultQueryError(`${label} 必须是整数，收到：${String(value)}`);
  }
  return parsed;
}

// 排序方向缺省值：按 email_id 排是升序更自然；按缺陷数/时间排是降序更自然
function resolveOrder(value: unknown, sortBy: string): SortOrder {
  const order = pickOne(toStringList(value), SORT_ORDERS, "order");
  if (order) return order;
  return sortBy === "email_id" ? "asc" : "desc";
}
