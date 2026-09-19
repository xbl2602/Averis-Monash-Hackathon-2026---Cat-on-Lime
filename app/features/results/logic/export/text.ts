/**
 * 纯文本报告排版（给终端/记事本看的版本）。
 * 与 markdown.ts 用同一份 ReportData，只是不用表格语法。
 */
import type { ComparisonStatus } from "@/lib/shared/types";
import { buildStatsLines, scopeLabel, type ReportData } from "./report-data";

const KIND_LABEL: Record<ComparisonStatus, string> = {
  OK: "一致",
  MISMATCH: "不一致",
  NEEDS_REVIEW: "需要人工确认",
};

export function buildTextReport(data: ReportData): string {
  const lines: string[] = [];
  lines.push("航运单证核验结果报告");
  lines.push("=".repeat(36));
  lines.push(`生成时间：${data.generatedAt}`);
  lines.push(`导出场景：${scopeLabel(data.scope)}`);
  lines.push(`筛选条件：${data.filterDescription}`);
  lines.push("数据来源：Supabase verification_results（只读）");
  lines.push("");

  lines.push("【统计摘要】");
  for (const line of buildStatsLines(data.stats)) lines.push(`  ${line}`);
  lines.push("");

  if (data.scope === "stats") return lines.join("\n");

  if (data.scope === "results") {
    lines.push(`【结果明细】共 ${data.results.length} 条`);
    for (const row of data.results) {
      lines.push(
        `  ${row.email_id} | ${row.category ?? "未处理"} | ${
          row.comparison_status ?? "-"
        } | 差异：${row.defect_fields.join("、") || "-"} | ${row.model_provider ?? "-"} | ${
          row.updated_at ?? "-"
        }`
      );
    }
    lines.push("");
    return lines.join("\n");
  }

  // scope === "conflicts"
  lines.push(`【冲突文件对】共 ${data.conflicts.length} 组`);
  for (const pair of data.conflicts) {
    lines.push("");
    lines.push(
      `  ${pair.email_id} — ${KIND_LABEL[pair.status]}${
        pair.review_reason ? `（${pair.review_reason}）` : ""
      }`
    );
    lines.push(`    发件人：${pair.from || "-"}`);
    lines.push(`    主题：${pair.subject || "-"}`);
    lines.push(`    SI 文件：${pair.si_file ?? "-"}`);
    lines.push(`    BL 文件：${pair.bl_file ?? "-"}`);
    if (pair.other_files.length) lines.push(`    其它附件：${pair.other_files.join("、")}`);
    if (pair.status === "MISMATCH") {
      for (const field of pair.defect_fields) {
        const siValue = pair.si_values[field] ?? "（缺失）";
        const blValue = pair.bl_values[field] ?? "（缺失）";
        lines.push(`    ${field}：SI「${siValue}」↔ BL「${blValue}」`);
      }
    }
  }
  lines.push("");
  return lines.join("\n");
}
