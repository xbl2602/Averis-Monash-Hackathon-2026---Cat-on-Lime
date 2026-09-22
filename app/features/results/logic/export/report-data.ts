/**
 * Data structures and summary formatting shared by export reports.
 * All three formats (json/md/txt) pull from this same data, differing only in layout —
 * don't recompute stats or re-describe filter conditions separately in each format file.
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
  if (query.categories?.length) parts.push(`categories=${query.categories.join("|")}`);
  if (query.statuses?.length) parts.push(`statuses=${query.statuses.join("|")}`);
  if (query.processing) parts.push(`processing=${query.processing}`);
  if (query.hasDefect !== undefined) parts.push(`has_defect=${query.hasDefect}`);
  if (query.provider) parts.push(`provider=${query.provider}`);
  if (query.q) parts.push(`keyword=${query.q}`);
  return parts.length ? parts.join(", ") : "(no filters)";
}

export function describeConflictFilters(query: ConflictQuery): string {
  const parts: string[] = [`status=${query.statuses.join("|")}`];
  if (query.q) parts.push(`keyword=${query.q}`);
  if (query.numericMode === "fuzzy") {
    parts.push(`numeric_mode=fuzzy (tolerance ${query.tolerance ?? "default"})`);
  }
  if (query.valueField && query.value) {
    parts.push(`value_search=${query.valueField}≈${query.value}`);
  }
  return parts.join(", ");
}

/** Line-by-line text for the stats summary (md/txt share this same content, differing only in indentation style) */
export function buildStatsLines(stats: StatsSummary): string[] {
  const categoryLine = Object.entries(stats.by_category)
    .map(([key, value]) => `${key} ${value}`)
    .join(" / ");
  const statusLine = Object.entries(stats.by_status)
    .map(([key, value]) => `${key} ${value}`)
    .join(" / ");
  const defectLine = stats.defect_field_frequency.length
    ? stats.defect_field_frequency.map((item) => `${item.field} ${item.count}`).join(" / ")
    : "(none)";

  const lines = [
    `Total emails: ${stats.total_emails}`,
    `Processed: ${stats.processed} (of which failed: ${stats.failed})`,
    `Pending: ${stats.pending}`,
    `Category distribution: ${categoryLine}`,
    `Status distribution: ${statusLine}`,
    `Defect field frequency: ${defectLine}`,
    `Last updated: ${stats.last_updated_at ?? "(none yet)"}`,
  ];
  return lines;
}

export function scopeLabel(scope: ExportScope): string {
  switch (scope) {
    case "results":
      return "Result list";
    case "conflicts":
      return "Conflicting file pairs";
    case "stats":
      return "Statistics summary";
    case "submission":
      return "Official submission file";
  }
}
