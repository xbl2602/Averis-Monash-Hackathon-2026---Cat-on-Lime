/**
 * CSV export (a format explicitly requested by the business side, per the 2026-09-21 workshop notes:
 * the on-site verification process needs to export "what's in the SI, what's in the BL, and why it was
 * judged a mismatch", for the operations team to print/send as an amendment).
 *
 * The conflicts scenario is the main use case: one row = one field to fix in one email (an "amendment
 * list"); the results/stats scenarios are filled out as simple tables, so all three non-submission
 * scenarios are covered by all four formats (json/md/txt/csv) — csv isn't forced onto submission
 * (official scoring only accepts json, see params.ts).
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

/** One row = one item to address: MISMATCH splits into one row per field (with both SI/BL values), NEEDS_REVIEW has no specific field so it just gives the reason */
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

// RFC 4180: fields containing a comma/quote/newline must be wrapped in double quotes, with internal quotes escaped as two quotes
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: string[][]): string {
  // Guards against garbled non-ASCII text in Excel: lead with a UTF-8 BOM
  return "﻿" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}
