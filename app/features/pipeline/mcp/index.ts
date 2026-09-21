import { z } from "zod";
import { LLM_PROVIDER_IDS } from "@/lib/llm";
import { makeReviewMcpTools } from "@/lib/shared/review/mcp";
import { normalizeBatchRequest, runPipelineBatch } from "../logic";
import { BATCH_DEFAULT_LIMIT, BATCH_MAX_CONCURRENCY, BATCH_MAX_LIMIT } from "../logic/types";

/**
 * pipeline 模块暴露的 MCP tool（会写库，不是只读）。
 * handler 只做"schema → logic"的转发，和 REST 共用同一套校验与实现。
 * 写保护：dry_run=false 经汇总层 gate 要求 x-admin-token；dry_run=true 允许匿名预览（单次封顶 20 封）。
 */
export const pipelineMcpTool = {
  name: "run_batch",
  description:
    `触发整箱批量核验：对样例邮件跑"分类→抽取→比对"，按 email_id upsert 进结果表（会写库）。` +
    `全量 520 封，内容/引擎没变过的自动跳过；单次最多 limit 封（默认 ${BATCH_DEFAULT_LIMIT}），` +
    `每块结束后检查 30s deadline，被打断时响应里 stopped_by_deadline=true、remaining 是还没跑的数量。` +
    `写模式（dry_run=false）需要 x-admin-token；匿名只能 dry_run=true 预览（单次最多 20 封，不写库）。`,
  inputSchema: {
    email_ids: z
      .array(z.string())
      .optional()
      .describe("只跑这几封（如 ['email_004']）；不传 = 全部样例邮件；不能和 retry_failed 同时用"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(BATCH_MAX_LIMIT)
      .optional()
      .describe(`单次最多跑几封，默认 ${BATCH_DEFAULT_LIMIT}，最大 ${BATCH_MAX_LIMIT}`),
    force: z.boolean().optional().describe("true = 忽略增量指纹强制重算，默认 false"),
    dry_run: z
      .boolean()
      .optional()
      .describe("true = 只计算不写库（不需要 service key），默认 false；匿名时单次封顶 20 封"),
    provider: z
      .enum(LLM_PROVIDER_IDS)
      .optional()
      .describe("文本兜底模型，默认 gemini；不能用 jev（jev 只能做结构化判断）"),
    concurrency: z
      .number()
      .int()
      .min(1)
      .max(BATCH_MAX_CONCURRENCY)
      .optional()
      .describe(`同时最多处理几封（也是一块的大小），默认 4，最大 ${BATCH_MAX_CONCURRENCY}`),
    retry_failed: z
      .boolean()
      .optional()
      .describe(
        "true = 一键重试结果表里所有处理失败或降级的邮件（名单自动挑、强制重算）；不能和 email_ids 同时用"
      ),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    // 同一批邮件重复跑是 upsert（覆盖同一条），不会产生重复数据
    idempotentHint: true,
    openWorldHint: false,
  },
  /**
   * 写 tool 的匿名例外：dry_run=true 的预览不写库，允许匿名（封顶在 logic 里）；
   * dry_run=false（真正写库）没带口令会在汇总层被 gate 拒绝。
   */
  anonymousWriteWhen: (args: unknown) =>
    (args as { dry_run?: unknown } | null)?.dry_run === true,
  handler: async (args: Record<string, unknown>, context?: { anonymous?: boolean }) =>
    runPipelineBatch(normalizeBatchRequest(args), { anonymous: context?.anonymous === true }),
};

// 人工复核闭环（P1-1）：队列 = processing_status=failed 或 model_provider 含 degraded 的邮件
export const pipelineReviewMcpTools = makeReviewMcpTools("pipeline", "流水线");
