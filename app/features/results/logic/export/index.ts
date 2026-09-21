/**
 * 导出的唯一编排入口：按 scope 取数 → 按 format 序列化 → 返回文件内容。
 * HTTP 层只负责把 ExportDocument 变成带下载头的响应；MCP 层只负责把 content
 * 作为 text 返回（文件名/完整性元信息放在 _meta），两边都不重新拼内容。
 *
 * 完整性判定（2026-09-20 安全评审的 fail-closed 口径）：
 * - 分母优先锚定"官方样例清单"（listSampleEmailIds，只 readdir、不解析 JSON）；
 *   读不到清单时降级用数据库总数，并强制 incomplete=true（expectedSource=db-fallback）
 * - 逐 key 求缺失集合；logic_version 与当前引擎版本不一致的结果行计入 stale
 * - 注意：这里**直接**从 @/lib/shared/inbox / versions 取数，不经过 sample-inputs，
 *   避免把附件解析依赖（mammoth/pdf-parse 等）拖进导出函数包（next.config 只带文件名清单）
 */
import { listSampleEmailIds } from "@/lib/shared/inbox";
import { applyOverridesToSubmission } from "@/lib/shared/review/merge";
import { PIPELINE_LOGIC_VERSION } from "@/lib/shared/versions";
import type { ComparedField, EmailVerificationResult } from "@/lib/shared/types";
import { listAllConflicts } from "../conflicts";
import { listAllResults } from "../query";
import { getStats } from "../stats";
import type { ExportDocument, ExportFormat, ExportRequest, ResultQuery, StatsSummary } from "../types";
import { buildCsvReport } from "./csv";
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
  csv: "text/csv; charset=utf-8",
};

// 官方提交文件要"全部已处理的邮件"，不接受筛选；limit/offset 会被 listAllResults 忽略
const ALL_RESULTS_QUERY: ResultQuery = { sortBy: "email_id", order: "asc", limit: 1, offset: 0 };

export async function exportResults(request: ExportRequest): Promise<ExportDocument> {
  const generatedAt = new Date().toISOString();
  const stats = await getStats();

  if (request.scope === "submission") {
    return buildSubmissionDocument(stats, stats.failed, generatedAt);
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
    expectedSource: null,
    missingIds: [],
    staleIds: [],
    invalidIds: [],
    incomplete: false,
    reviewPending: 0,
    reviewDeferred: 0,
    overriddenIds: [],
    content: serialize(request.format, data),
    generatedAt,
  };
}

/** 官方提交格式：{ email_id: EmailVerificationResult }，不带任何包装字段 */
async function buildSubmissionDocument(
  stats: StatsSummary,
  failedCount: number,
  generatedAt: string
): Promise<ExportDocument> {
  const rows = await listAllResults(ALL_RESULTS_QUERY);
  const expected = await resolveExpectedSampleIds(stats);
  // 提交文件的成员资格锚定官方样例清单，不是"数据库里有什么就交什么"。
  // 2026-09-22 实测到的真 bug：共用的 Supabase 项目里还躺着内部扰动测试数据（pt1~pt14，2768 行，
  // 见 DECISION_LOG 决策35①），它们同样有合法的 category/status，于是被一起写进了提交文件——
  // 实测导出 3288 条，其中 2768 条是测试数据。清单读不到时（db-fallback）没有可信成员名单，
  // 只能维持原样，但那条路径本来就强制 incomplete=true。
  const allowed = expected.source === "sample" ? new Set(expected.ids) : null;
  const systemPayload: Record<string, EmailVerificationResult> = {};

  for (const row of rows) {
    if (!row.category || !row.comparison_status) continue; // failed 行没有合法结果，跳过
    if (allowed && !allowed.has(row.email_id)) continue; // 不在官方清单里的一律不进提交文件
    systemPayload[row.email_id] = {
      category: row.category,
      status: row.comparison_status,
      review_reason: row.review_reason,
      defect_fields: row.defect_fields as ComparedField[],
      has_defect: row.has_defect,
    };
  }

  // 人工复核覆盖只套用在 submission 导出上（§5.3）；results/conflicts 仍展示系统原值
  const { payload, reviewPending, reviewDeferred, overriddenIds } = await applyOverridesToSubmission(systemPayload);

  const itemCount = Object.keys(payload).length;
  const invalidIds = findInvalidSubmissionIds(payload);

  const present = new Set(Object.keys(payload));
  const missingIds =
    expected.source === "sample" ? expected.ids.filter((id) => !present.has(id)) : [];
  // 只有"有合法结果"的行才算 stale：pending 行（没结果）算缺失、failed 行由 failedCount 覆盖。
  // 同样只看真正进了提交文件的行——库里的内部测试数据不会被官方流水线重跑，
  // 让它们把提交标成"引擎版本过期"是误报。
  const staleIds = rows
    .filter(
      (row) =>
        present.has(row.email_id) &&
        row.category !== null &&
        row.comparison_status !== null &&
        row.logic_version !== PIPELINE_LOGIC_VERSION
    )
    .map((row) => row.email_id);

  const incomplete =
    expected.source !== "sample" ||
    itemCount !== expected.total ||
    missingIds.length > 0 ||
    staleIds.length > 0 ||
    failedCount > 0 ||
    invalidIds.length > 0;

  return {
    filename: "submission.json",
    mimeType: MIME_TYPES.json,
    format: "json",
    scope: "submission",
    itemCount,
    expectedTotal: expected.total,
    expectedSource: expected.source,
    missingIds,
    staleIds,
    invalidIds,
    incomplete,
    reviewPending,
    reviewDeferred,
    overriddenIds,
    content: toJson(payload),
    generatedAt,
  };
}

/**
 * 提交文件的合法性校验（2026-09-21 P0-4，规则来自官方 data/sample/README.md）：
 * - MISMATCH：defect_fields 非空、has_defect 为 true、review_reason 为空
 * - NEEDS_REVIEW：review_reason 有值（官方四类之一）、defect_fields 为空（不确定不许当缺陷导出）
 * - OK：defect_fields 为空、has_defect 为 false、review_reason 为空
 * 违反任一条的行进 invalidIds：导出不拦截，但 incomplete 强制为 true + 专用响应头，绝不悄悄放过。
 */
function findInvalidSubmissionIds(payload: Record<string, EmailVerificationResult>): string[] {
  const invalid: string[] = [];
  for (const [emailId, result] of Object.entries(payload)) {
    const hasDefects = result.defect_fields.length > 0;
    const consistent =
      result.has_defect === hasDefects &&
      (result.status === "MISMATCH"
        ? hasDefects && result.review_reason === null
        : result.status === "NEEDS_REVIEW"
          ? !hasDefects && result.review_reason !== null
          : !hasDefects && result.review_reason === null);
    if (!consistent) invalid.push(emailId);
  }
  return invalid;
}

interface ExpectedSampleIds {
  source: "sample" | "db-fallback";
  total: number;
  ids: string[];
}

/** 分母锚定官方样例清单；清单读不到/为空时降级数据库总数（fail-closed，见文件头注释） */
async function resolveExpectedSampleIds(stats: StatsSummary): Promise<ExpectedSampleIds> {
  try {
    const ids = await listSampleEmailIds();
    if (ids.length > 0) {
      return { source: "sample", total: ids.length, ids };
    }
    console.warn("[results/export] 样例清单为空，降级用数据库总数（incomplete 强制为 true）");
  } catch (err) {
    console.warn(
      "[results/export] 读取样例清单失败，降级用数据库总数（incomplete 强制为 true）：",
      err instanceof Error ? err.message : err
    );
  }
  return { source: "db-fallback", total: stats.total_emails, ids: [] };
}

function serialize(format: ExportFormat, data: ReportData): string {
  if (format === "json") return toJson(buildJsonPayload(data));
  if (format === "md") return buildMarkdownReport(data);
  if (format === "csv") return buildCsvReport(data);
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
