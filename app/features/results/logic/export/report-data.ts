/**
 * 导出报告共用的数据结构与摘要格式化。
 * 三种格式（json/md/txt）都从这里取同一份数据，只是排版不同——
 * 不要在各自的格式文件里重新算一遍统计或重新描述筛选条件。
 */
import type {
  ConflictPair,
  ConflictQuery,
  ExportScope,
  ResultQuery,
  ResultRow,
  StatsSummary,
} from "../types";

export interface ReportData {
  scope: ExportScope;
  generatedAt: string;
  filterDescription: string;
  stats: StatsSummary;
  results: ResultRow[];
  conflicts: ConflictPair[];
}

export function describeResultFilters(query: ResultQuery): string {
  const parts: string[] = [];
  if (query.categories?.length) parts.push(`类别=${query.categories.join("|")}`);
  if (query.statuses?.length) parts.push(`状态=${query.statuses.join("|")}`);
  if (query.processing) parts.push(`处理情况=${query.processing}`);
  if (query.hasDefect !== undefined) parts.push(`有缺陷=${query.hasDefect}`);
  if (query.provider) parts.push(`模型=${query.provider}`);
  if (query.q) parts.push(`关键词=${query.q}`);
  return parts.length ? parts.join("，") : "（无筛选）";
}

export function describeConflictFilters(query: ConflictQuery): string {
  const parts: string[] = [`状态=${query.statuses.join("|")}`];
  if (query.q) parts.push(`关键词=${query.q}`);
  return parts.join("，");
}

/** 统计摘要的逐行文本（md/txt 共用同一份内容，只有缩进样式不同） */
export function buildStatsLines(stats: StatsSummary): string[] {
  const categoryLine = Object.entries(stats.by_category)
    .map(([key, value]) => `${key} ${value}`)
    .join(" / ");
  const statusLine = Object.entries(stats.by_status)
    .map(([key, value]) => `${key} ${value}`)
    .join(" / ");
  const defectLine = stats.defect_field_frequency.length
    ? stats.defect_field_frequency.map((item) => `${item.field} ${item.count}`).join(" / ")
    : "（无）";

  const lines = [
    `原始邮件总数：${stats.total_emails}`,
    `已处理：${stats.processed}（其中失败 ${stats.failed}）`,
    `未处理：${stats.pending}`,
    `分类分布：${categoryLine}`,
    `状态分布：${statusLine}`,
    `差异字段频次：${defectLine}`,
    `最近更新时间：${stats.last_updated_at ?? "（暂无）"}`,
  ];
  return lines;
}

export function scopeLabel(scope: ExportScope): string {
  switch (scope) {
    case "results":
      return "结果列表";
    case "conflicts":
      return "冲突文件对";
    case "stats":
      return "统计汇总";
    case "submission":
      return "官方提交文件";
  }
}
