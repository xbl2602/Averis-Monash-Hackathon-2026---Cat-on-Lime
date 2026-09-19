/**
 * 冲突文件对：把"SI 与 BL 不一致（MISMATCH）"和"拿不准需要人看（NEEDS_REVIEW）"
 * 的邮件整理成一组组文件对，附上两边抽取到的字段值，供人工复核和导出。
 * 读 verification_overview 视图（只包含处理过的行，字段是扁平列）。
 */
import type { ComparisonStatus, ReviewReason } from "@/lib/shared/types";
import { fetchAllRows, getReadClient, ilikeFragment, sanitizeSearchTerm } from "./db";
import { DataAccessError } from "./errors";
import { OVERVIEW_VIEW } from "./query";
import type { ConflictList, ConflictPair, ConflictQuery } from "./types";

const CONFLICT_SELECT = [
  "email_id",
  "from_address",
  "subject",
  "attachment_paths",
  "comparison_status",
  "review_reason",
  "defect_fields",
  "defect_count",
  "extracted_si",
  "extracted_bl",
  "updated_at",
].join(",");

function buildBaseQuery(options?: { withCount?: boolean }) {
  const client = getReadClient();
  return client
    .from(OVERVIEW_VIEW)
    .select(CONFLICT_SELECT, options?.withCount ? { count: "exact" } : undefined)
    .eq("processed", true);
}

type ConflictQueryBuilder = ReturnType<typeof buildBaseQuery>;

interface ConflictRow {
  email_id: string;
  from_address: string | null;
  subject: string | null;
  attachment_paths: string[] | null;
  comparison_status: string | null;
  review_reason: string | null;
  defect_fields: string[] | null;
  defect_count: number | null;
  extracted_si: Record<string, string> | null;
  extracted_bl: Record<string, string> | null;
  updated_at: string | null;
}

export async function listConflicts(query: ConflictQuery): Promise<ConflictList> {
  const builder = applyConflictFilters(buildBaseQuery({ withCount: true }), query);
  const { data, error, count } = await applyConflictOrder(builder, query)
    .range(query.offset, query.offset + query.limit - 1);

  if (error) throw new DataAccessError(`查询冲突文件对失败：${error.message}`);

  return {
    total: count ?? 0,
    limit: query.limit,
    offset: query.offset,
    sortBy: query.sortBy,
    order: query.order,
    items: ((data ?? []) as unknown as ConflictRow[]).map(toConflictPair),
  };
}

/** 导出用：同样筛选条件下取回全部冲突对 */
export async function listAllConflicts(query: ConflictQuery): Promise<ConflictPair[]> {
  const rows = await fetchAllRows<ConflictRow>((from, to) => {
    const builder = applyConflictFilters(buildBaseQuery(), query);
    return applyConflictOrder(builder, query).range(from, to);
  });
  return rows.map(toConflictPair);
}

function applyConflictFilters<T extends ConflictQueryBuilder>(
  builder: T,
  query: ConflictQuery
): T {
  let q = builder.in("comparison_status", query.statuses);

  if (query.q) {
    const term = sanitizeSearchTerm(query.q);
    if (term) {
      q = q.or(
        [
          ilikeFragment("email_id", term),
          ilikeFragment("subject", term),
          ilikeFragment("from_address", term),
        ].join(",")
      );
    }
  }

  return q;
}

function applyConflictOrder<T extends ConflictQueryBuilder>(
  builder: T,
  query: ConflictQuery
): T {
  return builder.order(query.sortBy, {
    ascending: query.order === "asc",
    nullsFirst: false,
  });
}

function toConflictPair(row: ConflictRow): ConflictPair {
  const attachments = row.attachment_paths ?? [];
  const siFile = attachments.find((path) => /_SI[._]/i.test(path)) ?? null;
  const blFile = attachments.find((path) => /_BL[._]/i.test(path)) ?? null;

  return {
    email_id: row.email_id,
    from: row.from_address ?? "",
    subject: row.subject ?? "",
    si_file: siFile,
    bl_file: blFile,
    other_files: attachments.filter((path) => path !== siFile && path !== blFile),
    status: (row.comparison_status ?? "NEEDS_REVIEW") as ComparisonStatus,
    review_reason: (row.review_reason as ReviewReason | null) ?? null,
    defect_fields: row.defect_fields ?? [],
    defect_count: row.defect_count ?? 0,
    si_values: row.extracted_si ?? {},
    bl_values: row.extracted_bl ?? {},
    updated_at: row.updated_at,
  };
}
