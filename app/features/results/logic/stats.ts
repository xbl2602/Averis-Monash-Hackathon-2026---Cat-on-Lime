/**
 * 统计汇总：总数 / 已处理 / 未处理 / 失败 / 分类分布 / 状态分布 / 差异字段频次。
 * 读 verification_overview 视图（每封原始邮件一行，处理过与否都算）。
 * 当前数据量（几百封）直接全量聚合；以后变大可换成数据库聚合，对外格式不变。
 */
import { COMPARISON_STATUSES, EMAIL_CATEGORIES } from "@/lib/shared/types";
import { fetchAllRows, getReadClient } from "./db";
import { OVERVIEW_VIEW } from "./query";
import type { StatsSummary } from "./types";

const NOT_PROCESSED = "NOT_PROCESSED";

interface StatsRow {
  processed: boolean | null;
  processing_status: string | null;
  category: string | null;
  comparison_status: string | null;
  defect_fields: string[] | null;
  model_provider: string | null;
  updated_at: string | null;
}

export async function getStats(): Promise<StatsSummary> {
  const client = getReadClient();
  const rows = await fetchAllRows<StatsRow>((from, to) =>
    client
      .from(OVERVIEW_VIEW)
      .select(
        "processed,processing_status,category,comparison_status,defect_fields,model_provider,updated_at"
      )
      .order("email_id", { ascending: true })
      .range(from, to)
  );

  const byCategory: Record<string, number> = {};
  for (const category of EMAIL_CATEGORIES) byCategory[category] = 0;
  byCategory[NOT_PROCESSED] = 0;

  const byStatus: Record<string, number> = {};
  for (const status of COMPARISON_STATUSES) byStatus[status] = 0;
  byStatus[NOT_PROCESSED] = 0;

  let processedCount = 0;
  let failed = 0;
  let mismatch = 0;
  let needsReview = 0;
  let lastUpdatedAt: string | null = null;
  const defectFieldCounts = new Map<string, number>();
  const providerCounts = new Map<string, number>();

  for (const row of rows) {
    if (row.updated_at && (!lastUpdatedAt || row.updated_at > lastUpdatedAt)) {
      lastUpdatedAt = row.updated_at;
    }
    if (row.processed) processedCount += 1;
    if (row.processing_status === "failed") failed += 1;

    if (row.category && row.category in byCategory) byCategory[row.category] += 1;
    else byCategory[NOT_PROCESSED] += 1;

    if (row.comparison_status && row.comparison_status in byStatus) {
      byStatus[row.comparison_status] += 1;
    } else {
      byStatus[NOT_PROCESSED] += 1;
    }

    if (row.comparison_status === "MISMATCH") mismatch += 1;
    if (row.comparison_status === "NEEDS_REVIEW") needsReview += 1;

    for (const field of row.defect_fields ?? []) {
      defectFieldCounts.set(field, (defectFieldCounts.get(field) ?? 0) + 1);
    }
    if (row.model_provider) {
      providerCounts.set(row.model_provider, (providerCounts.get(row.model_provider) ?? 0) + 1);
    }
  }

  const totalEmails = rows.length;

  return {
    total_emails: totalEmails,
    processed: processedCount,
    pending: Math.max(0, totalEmails - processedCount),
    failed,
    mismatch,
    needs_review: needsReview,
    by_category: byCategory,
    by_status: byStatus,
    defect_field_frequency: [...defectFieldCounts.entries()]
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field)),
    providers: Object.fromEntries(
      [...providerCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    ),
    last_updated_at: lastUpdatedAt,
  };
}
