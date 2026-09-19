/**
 * 结果列表查询（筛选 + 排序 + 分组 + 分页）。
 *
 * 读的是数据库视图 verification_overview（raw_emails 左连接 verification_results）：
 * - 未处理的邮件也在里面（processing_status='pending'、processed=false），能被查到
 * - 所有可用字段都是扁平列，筛选/排序直接做，不依赖 PostgREST 的内嵌表语义
 *   （内嵌排序实测不会影响父行顺序，之前踩过坑）
 */
import type { ComparisonStatus, EmailCategory, ReviewReason } from "@/lib/shared/types";
import { fetchAllRows, getReadClient, ilikeFragment, sanitizeSearchTerm } from "./db";
import { DataAccessError } from "./errors";
import type { ProcessingState, ResultList, ResultQuery, ResultRow } from "./types";

export const OVERVIEW_VIEW = "verification_overview";

const VIEW_COLUMNS = [
  "email_id",
  "from_address",
  "subject",
  "attachment_paths",
  "category",
  "comparison_status",
  "review_reason",
  "defect_fields",
  "defect_count",
  "has_defect",
  "processing_status",
  "processed",
  "error_message",
  "model_provider",
  "logic_version",
  "updated_at",
  "extracted_si",
  "extracted_bl",
].join(",");

interface OverviewRow {
  email_id: string;
  from_address: string | null;
  subject: string | null;
  attachment_paths: string[] | null;
  category: string | null;
  comparison_status: string | null;
  review_reason: string | null;
  defect_fields: string[] | null;
  defect_count: number | null;
  has_defect: boolean | null;
  processing_status: string | null;
  processed: boolean | null;
  error_message: string | null;
  model_provider: string | null;
  logic_version: string | null;
  updated_at: string | null;
  extracted_si: Record<string, string> | null;
  extracted_bl: Record<string, string> | null;
}

function buildBaseQuery(options?: { withCount?: boolean }) {
  const client = getReadClient();
  return client
    .from(OVERVIEW_VIEW)
    .select(VIEW_COLUMNS, options?.withCount ? { count: "exact" } : undefined);
}

/**
 * 查询构造器只用到这几个方法（结构类型）：
 * 这样列表查询和分组查询可以用同一个 applyFilters，不需要关心 PostgREST 泛型细节。
 */
interface FilterableBuilder<T> {
  in(column: string, values: readonly unknown[]): T;
  eq(column: string, value: unknown): T;
  ilike(column: string, pattern: string): T;
  or(filters: string): T;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): T;
}

export async function listResults(query: ResultQuery): Promise<ResultList> {
  const builder = applyFilters(buildBaseQuery({ withCount: true }), query);
  const { data, error, count } = await applyOrder(builder, query)
    .range(query.offset, query.offset + query.limit - 1);

  if (error) throw new DataAccessError(`查询结果列表失败：${error.message}`);

  const items = ((data ?? []) as unknown as OverviewRow[]).map(toResultRow);
  const groups = query.groupBy ? await fetchGroups(query) : null;

  return {
    total: count ?? 0,
    limit: query.limit,
    offset: query.offset,
    sortBy: query.sortBy,
    order: query.order,
    groupBy: query.groupBy ?? null,
    groups,
    items,
  };
}

/** 导出/报表用：同样筛选条件下，把所有匹配行都取回来（分页拉全量） */
export async function listAllResults(query: ResultQuery): Promise<ResultRow[]> {
  const rows = await fetchAllRows<OverviewRow>((from, to) => {
    const builder = applyFilters(buildBaseQuery(), query);
    return applyOrder(builder, query).range(from, to);
  });
  return rows.map(toResultRow);
}

function applyFilters<T extends FilterableBuilder<T>>(builder: T, query: ResultQuery): T {
  let q = builder;

  if (query.categories?.length) q = q.in("category", query.categories);
  if (query.statuses?.length) q = q.in("comparison_status", query.statuses);
  if (query.hasDefect !== undefined) q = q.eq("has_defect", query.hasDefect);
  if (query.provider) q = q.ilike("model_provider", `%${query.provider}%`);

  if (query.processing === "pending") {
    q = q.eq("processed", false);
  } else if (query.processing === "processed") {
    q = q.eq("processed", true);
  } else if (query.processing === "failed") {
    q = q.eq("processing_status", "failed");
  }

  if (query.q) {
    const term = sanitizeSearchTerm(query.q);
    if (term) {
      q = q.or(
        [
          ilikeFragment("email_id", term),
          ilikeFragment("from_address", term),
          ilikeFragment("subject", term),
        ].join(",")
      );
    }
  }

  return q;
}

function applyOrder<T extends FilterableBuilder<T>>(builder: T, query: ResultQuery): T {
  return builder.order(query.sortBy, {
    ascending: query.order === "asc",
    nullsFirst: false,
  });
}

function buildGroupQuery(groupColumn: string) {
  const client = getReadClient();
  return client.from(OVERVIEW_VIEW).select(`email_id,${groupColumn}`);
}

/** 分组计数：对"筛选后的全集"统计，不受分页影响 */
async function fetchGroups(query: ResultQuery): Promise<{ key: string; count: number }[]> {
  const groupColumn = query.groupBy as string;
  const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
    applyFilters(buildGroupQuery(groupColumn), query).range(from, to)
  );

  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[groupColumn];
    const key = typeof value === "string" && value !== "" ? value : "NOT_PROCESSED";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function toResultRow(row: OverviewRow): ResultRow {
  return {
    email_id: row.email_id,
    from: row.from_address ?? "",
    subject: row.subject ?? "",
    attachment_paths: row.attachment_paths ?? [],
    category: (row.category as EmailCategory | null) ?? null,
    comparison_status: (row.comparison_status as ComparisonStatus | null) ?? null,
    review_reason: (row.review_reason as ReviewReason | null) ?? null,
    defect_fields: row.defect_fields ?? [],
    defect_count: row.defect_count ?? 0,
    has_defect: row.has_defect ?? false,
    processing_status: (row.processing_status as ProcessingState) ?? "pending",
    error_message: row.error_message ?? null,
    model_provider: row.model_provider ?? null,
    logic_version: row.logic_version ?? null,
    updated_at: row.updated_at ?? null,
    extracted_si: row.extracted_si ?? null,
    extracted_bl: row.extracted_bl ?? null,
  };
}
