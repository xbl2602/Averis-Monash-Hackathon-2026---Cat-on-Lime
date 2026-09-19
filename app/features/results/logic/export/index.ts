/**
 * 导出的唯一编排入口：按 scope 取数 → 按 format 序列化 → 返回文件内容。
 * HTTP 层只负责把 ExportDocument 变成带下载头的响应；MCP 层只负责把 content
 * 作为 text 返回（文件名放在 _meta），两边都不重新拼内容。
 */
import type { ComparedField, EmailVerificationResult } from "@/lib/shared/types";
import { listAllConflicts } from "../conflicts";
import { listAllResults } from "../query";
import { getStats } from "../stats";
import type { ExportDocument, ExportFormat, ExportRequest, ResultQuery } from "../types";
import { toJson } from "./json";
import { buildMarkdownReport } from "./markdown";
import {
  buildStatsLines,
  describeConflictFilters,
  describeResultFilters,
  scopeLabel,
  type ReportData,
} from "./report-data";
import { buildTextReport } from "./text";

const MIME_TYPES: Record<ExportFormat, string> = {
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

// 官方提交文件要"全部已处理的邮件"，不接受筛选；limit/offset 会被 listAllResults 忽略
const ALL_RESULTS_QUERY: ResultQuery = { sortBy: "email_id", order: "asc", limit: 1, offset: 0 };

export async function exportResults(request: ExportRequest): Promise<ExportDocument> {
  const generatedAt = new Date().toISOString();
  const stats = await getStats();

  if (request.scope === "submission") {
    return buildSubmissionDocument(stats.total_emails, stats.failed, generatedAt);
  }

  const results = request.scope === "results" ? await listAllResults(request.query) : [];
  const conflicts =
    request.scope === "conflicts" ? await listAllConflicts(request.conflictQuery) : [];

  const data: ReportData = {
    scope: request.scope,
    generatedAt,
    filterDescription:
      request.scope === "conflicts"
        ? describeConflictFilters(request.conflictQuery)
        : request.scope === "results"
          ? describeResultFilters(request.query)
          : "（全量，无筛选）",
    stats,
    results,
    conflicts,
  };

  const itemCount =
    request.scope === "results" ? results.length : request.scope === "conflicts" ? conflicts.length : 0;

  return {
    filename: `shipping-${request.scope}_${timestampForFilename(generatedAt)}.${request.format}`,
    mimeType: MIME_TYPES[request.format],
    format: request.format,
    scope: request.scope,
    itemCount,
    expectedTotal: null,
    incomplete: false,
    content: serialize(request.format, data),
    generatedAt,
  };
}

/** 官方提交格式：{ email_id: EmailVerificationResult }，不带任何包装字段 */
async function buildSubmissionDocument(
  expectedTotal: number,
  failedCount: number,
  generatedAt: string
): Promise<ExportDocument> {
  const rows = await listAllResults(ALL_RESULTS_QUERY);
  const payload: Record<string, EmailVerificationResult> = {};

  for (const row of rows) {
    if (!row.category || !row.comparison_status) continue; // failed 行没有合法结果，跳过
    payload[row.email_id] = {
      category: row.category,
      status: row.comparison_status,
      review_reason: row.review_reason,
      defect_fields: row.defect_fields as ComparedField[],
      has_defect: row.has_defect,
    };
  }

  const itemCount = Object.keys(payload).length;

  return {
    filename: "submission.json",
    mimeType: MIME_TYPES.json,
    format: "json",
    scope: "submission",
    itemCount,
    expectedTotal,
    incomplete: itemCount < expectedTotal || failedCount > 0,
    content: toJson(payload),
    generatedAt,
  };
}

function serialize(format: ExportFormat, data: ReportData): string {
  if (format === "json") return toJson(buildJsonPayload(data));
  if (format === "md") return buildMarkdownReport(data);
  return buildTextReport(data);
}

function buildJsonPayload(data: ReportData): unknown {
  const payload: Record<string, unknown> = {
    generated_at: data.generatedAt,
    scope: data.scope,
    scope_label: scopeLabel(data.scope),
    filters: data.filterDescription,
    stats: data.stats,
  };

  if (data.scope === "results") {
    payload.item_count = data.results.length;
    payload.items = data.results;
  } else if (data.scope === "conflicts") {
    payload.item_count = data.conflicts.length;
    payload.items = data.conflicts;
  } else {
    payload.stats_lines = buildStatsLines(data.stats);
  }

  return payload;
}

// 2026-09-20T00:30:00.000Z -> 20260920-0030
function timestampForFilename(iso: string): string {
  const compact = iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
  return `${compact.slice(0, 8)}-${compact.slice(9, 13)}`;
}
