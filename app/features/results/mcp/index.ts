import { z } from "zod";
import { COMPARISON_STATUSES, EMAIL_CATEGORIES } from "@/lib/shared/types";
import {
  exportResults,
  getStats,
  listConflicts,
  listResults,
  normalizeConflictQuery,
  normalizeExportRequest,
  normalizeResultQuery,
} from "../logic";
import {
  CONFLICT_SORT_FIELDS,
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  GROUP_FIELDS,
  NUMERIC_MODES,
  NUMERIC_SEARCH_FIELDS,
  PROCESSING_STATES,
  RESULT_SORT_FIELDS,
  SORT_ORDERS,
} from "../logic";

/**
 * results 模块暴露的 4 个 MCP tool（只读），被 /app/core/mcp-server 汇总注册。
 * handler 只做"schema → logic"的转发；筛选/校验/导出都在 logic 里，和 REST 共用。
 */

const resultFilterShape = {
  category: z
    .array(z.enum(EMAIL_CATEGORIES))
    .optional()
    .describe("只返回这些分类（BL_COMPARISON / SI_REQUEST / INVOICE_QUERY / GENERAL / SPAM）"),
  status: z
    .array(z.enum(COMPARISON_STATUSES))
    .optional()
    .describe("只返回这些比对状态（OK / MISMATCH / NEEDS_REVIEW）"),
  processing: z
    .enum(PROCESSING_STATES)
    .optional()
    .describe("processed=已处理；pending=还没有结果；failed=处理失败"),
  has_defect: z.boolean().optional().describe("true 只看有差异（MISMATCH）的邮件"),
  provider: z.string().optional().describe('模型来源子串匹配，例如 "jev"、"rules"'),
  q: z.string().optional().describe("按邮件ID / 发件人 / 主题做关键词搜索"),
};

const listResultsMcpTool = {
  name: "list_results",
  description:
    "查询 520 封样例邮件的核验结果（含未处理的），支持按分类/状态/处理情况筛选，按字段排序、分组和分页。返回邮件基本信息 + 分类 + 比对结果 + 抽取字段",
  inputSchema: {
    ...resultFilterShape,
    sort_by: z.enum(RESULT_SORT_FIELDS).optional().describe("排序字段，缺省 email_id"),
    order: z.enum(SORT_ORDERS).optional().describe("排序方向；按 email_id 缺省 asc，其余缺省 desc"),
    group_by: z
      .enum(GROUP_FIELDS)
      .optional()
      .describe("附带分组计数（category 或 comparison_status）"),
    limit: z.number().int().min(1).max(200).optional().describe("每页条数，缺省 50，最大 200"),
    offset: z.number().int().min(0).optional().describe("跳过多少条，缺省 0"),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) => listResults(normalizeResultQuery(args)),
};

const getStatsMcpTool = {
  name: "get_stats",
  description:
    "获取核验结果统计：邮件总数、已处理/未处理/失败数量、分类分布、状态分布、差异字段频次、模型分布",
  inputSchema: {},
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async () => getStats(),
};

const listConflictsMcpTool = {
  name: "list_conflicts",
  description:
    "列出冲突文件对：SI 与 BL 不一致（MISMATCH）或需要人工确认（NEEDS_REVIEW）的邮件，包含 SI/BL 附件路径、差异字段和两边取值",
  inputSchema: {
    status: z
      .array(z.enum(COMPARISON_STATUSES))
      .optional()
      .describe("缺省 MISMATCH + NEEDS_REVIEW"),
    q: z.string().optional().describe("按邮件ID / 发件人 / 主题做关键词搜索"),
    sort_by: z.enum(CONFLICT_SORT_FIELDS).optional().describe("排序字段，缺省 defect_count"),
    order: z.enum(SORT_ORDERS).optional().describe("排序方向，缺省 desc"),
    limit: z.number().int().min(1).max(200).optional().describe("每页条数，缺省 50"),
    offset: z.number().int().min(0).optional().describe("跳过多少条，缺省 0"),
    numeric_mode: z
      .enum(NUMERIC_MODES)
      .optional()
      .describe(
        "数值口径（只影响查询，不影响官方提交）：exact=默认，与结果表存储的判定一致；fuzzy=容差内的小差异不算冲突"
      ),
    tolerance: z
      .number()
      .min(0)
      .optional()
      .describe("仅 numeric_mode=fuzzy 时可用；不传用默认（重量 max(0.5kg, 0.1%)、箱数 0）"),
    value_field: z
      .enum(NUMERIC_SEARCH_FIELDS)
      .optional()
      .describe("按值搜索的字段（container_count / gross_weight_kg），必须和 value 成对出现"),
    value: z
      .string()
      .optional()
      .describe('按值搜索的数值（如 "12000"），命中 SI 或 BL 任一侧；必须和 value_field 成对'),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) => listConflicts(normalizeConflictQuery(args)),
};

const exportResultsMcpTool = {
  name: "export_results",
  description:
    "把结果导出成文件内容（Save as）。scope=results 结果列表 / conflicts 冲突文件对 / stats 统计汇总 / submission 官方提交格式（仅 json）；format=json|md|txt。返回的 text 就是文件内容，文件名在 _meta.filename",
  inputSchema: {
    scope: z.enum(EXPORT_SCOPES).optional().describe("导出场景，缺省 results"),
    format: z.enum(EXPORT_FORMATS).optional().describe("文件格式，缺省 json"),
    ...resultFilterShape,
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) => {
    const doc = await exportResults(normalizeExportRequest(args));
    return {
      content: [{ type: "text" as const, text: doc.content }],
      _meta: {
        filename: doc.filename,
        mime_type: doc.mimeType,
        format: doc.format,
        scope: doc.scope,
        item_count: doc.itemCount,
        expected_total: doc.expectedTotal,
        incomplete: doc.incomplete,
        expected_source: doc.expectedSource,
        missing: doc.missingIds.length,
        missing_ids: doc.missingIds.slice(0, 50),
        stale: doc.staleIds.length,
        stale_ids: doc.staleIds.slice(0, 50),
        invalid: doc.invalidIds.length,
        invalid_ids: doc.invalidIds.slice(0, 50),
        review_pending: doc.reviewPending,
        review_deferred: doc.reviewDeferred,
        generated_at: doc.generatedAt,
      },
    };
  },
};

export const resultsMcpTools = [
  listResultsMcpTool,
  getStatsMcpTool,
  listConflictsMcpTool,
  exportResultsMcpTool,
];
