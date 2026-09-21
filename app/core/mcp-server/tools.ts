import type { z } from "zod";
import { classificationMcpTool, classificationReviewMcpTools } from "@/app/features/classification/mcp";
import { extractionMcpTool, extractionReviewMcpTools } from "@/app/features/extraction/mcp";
import { comparisonMcpTool, comparisonReviewMcpTools } from "@/app/features/comparison/mcp";
import { resultsMcpTools } from "@/app/features/results/mcp";
import { pipelineMcpTool, pipelineReviewMcpTools } from "@/app/features/pipeline/mcp";
import { mailMcpTools } from "@/app/features/mail/mcp";
import { importMcpTools } from "@/app/features/import/mcp";
import { sandboxMcpTool } from "@/app/features/sandbox/mcp";

/**
 * 汇总各个 feature 模块暴露的 MCP tool 定义。
 * 这个文件只做"汇总"，不包含任何一个模块的具体业务逻辑（见 CLAUDE.md）。
 * 新增 feature 时，在这个数组里加一行就够了，不用改其他任何地方。
 *
 * 约定：一个 feature 的 mcp/index.ts 可以导出单个 tool 对象，也可以导出 tool 数组
 * （results 模块就导出 4 个）。工具的真实注册在 ./route.ts，这里只存定义。
 */

/** 汇总层传给 handler 的第二参数（目前只有"这次是不是匿名调用"） */
export interface McpToolContext {
  /** true = 未带 x-admin-token 的调用（目前只会出现在 dry_run 预览这类匿名例外里） */
  anonymous: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  /** zod raw shape：每个字段一个 zod schema，由 MCP SDK 转成 JSON Schema */
  inputSchema: Record<string, z.ZodType>;
  /**
   * MCP 工具注解硬约定（写保护 gate 按 fail-closed 判定，见 ./route.ts）：
   * - **只读 tool 必须显式声明 `readOnlyHint: true`**
   * - **会写库的 tool 必须显式声明 `readOnlyHint: false`**
   * - 未声明的一律按"需要口令"处理（忘注解的写 tool 会被拦住，不会漏）
   */
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  /**
   * 写 tool 的"匿名例外"判定（如 run_batch 的 dry_run=true 预览）：返回 true 时，
   * 未带口令的调用也会以 `context.anonymous = true` 执行。写 tool 不设置 = 一律需要口令。
   */
  anonymousWriteWhen?: (args: unknown) => boolean;
  /**
   * 参数由 MCP SDK 用 inputSchema 校验后传进来；这里用 any 是唯一的"动态边界"，
   * 各 feature 自己的 handler 参数仍然是具体类型。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any, context: McpToolContext) => Promise<unknown>;
}

export const mcpTools: McpToolDefinition[] = [
  classificationMcpTool,
  ...classificationReviewMcpTools,
  extractionMcpTool,
  ...extractionReviewMcpTools,
  comparisonMcpTool,
  ...comparisonReviewMcpTools,
  pipelineMcpTool,
  ...pipelineReviewMcpTools,
  ...resultsMcpTools,
  ...mailMcpTools,
  ...importMcpTools,
  sandboxMcpTool,
];
