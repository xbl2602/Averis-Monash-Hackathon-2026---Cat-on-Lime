import { z } from "zod";
import { LLM_PROVIDER_IDS } from "@/lib/llm";
import { normalizeBatchRequest, runPipelineBatch } from "../logic";
import { BATCH_DEFAULT_LIMIT, BATCH_MAX_CONCURRENCY, BATCH_MAX_LIMIT } from "../logic/types";

/**
 * pipeline 模块暴露的 MCP tool（会写库，不是只读）。
 * handler 只做"schema → logic"的转发，和 REST 共用同一套校验与实现。
 */
export const pipelineMcpTool = {
  name: "run_batch",
  description:
    `触发整箱批量核验：对样例邮件跑"分类→抽取→比对"，按 email_id upsert 进结果表（会写库）。` +
    `全量 520 封，内容/引擎没变过的自动跳过；单次最多 limit 封（默认 ${BATCH_DEFAULT_LIMIT}），` +
    `响应里的 remaining 表示还剩多少没跑。建议先 dry_run=true + 小 limit 预览，再正式跑。`,
  inputSchema: {
    email_ids: z
      .array(z.string())
      .optional()
      .describe("只跑这几封（如 ['email_004']）；不传 = 全部样例邮件"),
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
      .describe("true = 只计算不写库（不需要 service key），默认 false"),
    provider: z
      .enum(LLM_PROVIDER_IDS)
      .optional()
      .describe("文本兜底模型，默认 claude；不能用 jev（jev 只能做结构化判断）"),
    concurrency: z
      .number()
      .int()
      .min(1)
      .max(BATCH_MAX_CONCURRENCY)
      .optional()
      .describe(`同时最多处理几封，默认 4，最大 ${BATCH_MAX_CONCURRENCY}`),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    // 同一批邮件重复跑是 upsert（覆盖同一条），不会产生重复数据
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) => runPipelineBatch(normalizeBatchRequest(args)),
};
