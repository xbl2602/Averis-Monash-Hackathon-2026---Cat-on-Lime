/**
 * CSV 导出（业务方明确要的格式，2026-09-21 workshop 纪要：现场核对流程要导出
 * "SI 里是什么、BL 里是什么、为什么判 mismatch"，给操作团队打印/发 amendment 用）。
 *
 * conflicts 场景是主用途：一行 = 一个邮件里的一个待改字段（"amendment list"）；
 * results/stats 场景补齐成简单的表格，保持四种格式（json/md/txt/csv）都能覆盖三个非
 * submission 场景，不强行给 submission 加 csv（官方评分只认 json，见 params.ts）。
 */
import type { ReportData } from "./report-data";

export function buildCsvReport(data: ReportData): string {
  if (data.scope === "stats") return buildStatsCsv(data);
  if (data.scope === "results") return buildResultsCsv(data);
  return buildConflictsCsv(data);
}

function buildStatsCsv(data: ReportData): string {
  const rows: string[][] = [["metric", "value"]];
  const stats = data.stats;
  rows.push(["total_emails", String(stats.total_emails)]);
  rows.push(["processed", String(stats.processed)]);
  rows.push(["pending", String(stats.pending)]);
  rows.push(["failed", String(stats.failed)]);
  rows.push(["mismatch", String(stats.mismatch)]);
  rows.push(["needs_review", String(stats.needs_review)]);
  for (const [category, count] of Object.entries(stats.by_category)) {
    rows.push([`category:${category}`, String(count)]);
  }
  for (const [status, count] of Object.entries(stats.by_status)) {
    rows.push([`status:${status}`, String(count)]);
  }
  for (const item of stats.defect_field_frequency) {
    rows.push([`defect_field:${item.field}`, String(item.count)]);
  }
  rows.push(["last_updated_at", stats.last_updated_at ?? ""]);
  return toCsv(rows);
}

function buildResultsCsv(data: ReportData): string {
  const rows: string[][] = [
    [
      "email_id",
      "from",
      "subject",
      "category",
      "status",
      "review_reason",
      "defect_fields",
      "model_provider",
      "updated_at",
    ],
  ];
  for (const row of data.results) {
    rows.push([
      row.email_id,
      row.from,
      row.subject,
      row.category ?? "",
      row.comparison_status ?? "",
      row.review_reason ?? "",
      row.defect_fields.join(";"),
      row.model_provider ?? "",
      row.updated_at ?? "",
    ]);
  }
  return toCsv(rows);
}

/** 一行 = 一个待处理项：MISMATCH 按字段拆行（SI/BL 两边的值都在），NEEDS_REVIEW 没有具体字段就只给原因 */
function buildConflictsCsv(data: ReportData): string {
  const rows: string[][] = [
    ["email_id", "from", "subject", "status", "review_reason", "field", "si_value", "bl_value"],
  ];
  for (const pair of data.conflicts) {
    if (pair.defect_fields.length === 0) {
      rows.push([pair.email_id, pair.from, pair.subject, pair.status, pair.review_reason ?? "", "", "", ""]);
      continue;
    }
    for (const field of pair.defect_fields) {
      rows.push([
        pair.email_id,
        pair.from,
        pair.subject,
        pair.status,
        pair.review_reason ?? "",
        field,
        pair.si_values[field] ?? "",
        pair.bl_values[field] ?? "",
      ]);
    }
  }
  return toCsv(rows);
}

// RFC 4180：含逗号/引号/换行的字段要用双引号包起来，内部的引号转义成两个引号
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: string[][]): string {
  // Excel 中文乱码兜底：UTF-8 BOM 开头
  return "﻿" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}
