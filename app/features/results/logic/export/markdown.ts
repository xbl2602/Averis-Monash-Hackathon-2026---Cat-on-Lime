/**
 * Markdown report layout (the human-readable version).
 * Tables/section headings all live here; the statistics come from the same data as report-data.
 */
import type { ComparisonStatus } from "@/lib/shared/types";
import { buildStatsLines, scopeLabel, type ReportData } from "./report-data";

const KIND_LABEL: Record<ComparisonStatus, string> = {
  OK: "Match",
  MISMATCH: "Mismatch",
  NEEDS_REVIEW: "Needs manual confirmation",
};

export function buildMarkdownReport(data: ReportData): string {
  const lines: string[] = [];
  lines.push("# Shipping Document Verification Report");
  lines.push("");
  lines.push(`- Generated at: ${data.generatedAt}`);
  lines.push(`- Export scope: ${scopeLabel(data.scope)}`);
  lines.push(`- Filters: ${data.filterDescription}`);
  lines.push(`- Data source: Supabase verification_results (read-only)`);
  lines.push("");

  lines.push("## Statistics Summary");
  for (const line of buildStatsLines(data.stats)) lines.push(`- ${line}`);
  lines.push("");

  if (data.scope === "stats") return lines.join("\n");

  if (data.scope === "results") {
    lines.push(`## Result Details (${data.results.length} items)`);
    lines.push("");
    lines.push("| Email ID | Category | Status | Defect Fields | Model | Updated At |");
    lines.push("|---|---|---|---|---|---|");
    for (const row of data.results) {
      lines.push(
        `| ${row.email_id} | ${row.category ?? "Not processed"} | ${
          row.comparison_status ?? "-"
        } | ${row.defect_fields.join(", ") || "-"} | ${row.model_provider ?? "-"} | ${
          row.updated_at ?? "-"
        } |`
      );
    }
    lines.push("");
    return lines.join("\n");
  }

  // scope === "conflicts"
  lines.push(`## Conflicting File Pairs (${data.conflicts.length} groups)`);
  for (const pair of data.conflicts) {
    lines.push("");
    lines.push(`### ${pair.email_id} — ${KIND_LABEL[pair.status]}${pair.review_reason ? ` (${pair.review_reason})` : ""}`);
    lines.push(`- From: ${pair.from || "-"}`);
    lines.push(`- Subject: ${pair.subject || "-"}`);
    lines.push(`- SI file: ${pair.si_file ?? "-"}`);
    lines.push(`- BL file: ${pair.bl_file ?? "-"}`);
    if (pair.other_files.length) lines.push(`- Other attachments: ${pair.other_files.join(", ")}`);
    if (pair.status === "MISMATCH") {
      for (const field of pair.defect_fields) {
        const siValue = pair.si_values[field] ?? "(missing)";
        const blValue = pair.bl_values[field] ?? "(missing)";
        lines.push(`- ${field}: SI "${siValue}" ↔ BL "${blValue}"`);
      }
    }
  }
  lines.push("");
  return lines.join("\n");
}
