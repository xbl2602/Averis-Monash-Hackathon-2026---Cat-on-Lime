import type { z } from "zod";
import { classificationMcpTool } from "@/app/features/classification/mcp";
import { extractionMcpTool } from "@/app/features/extraction/mcp";
import { comparisonMcpTool } from "@/app/features/comparison/mcp";
import { resultsMcpTools } from "@/app/features/results/mcp";
import { pipelineMcpTool } from "@/app/features/pipeline/mcp";
import { mailMcpTools } from "@/app/features/mail/mcp";
import { importMcpTools } from "@/app/features/import/mcp";

/**
 * 汇总各个 feature 模块暴露的 MCP tool 定义。
 * 这个文件只做"汇总"，不包含任何一个模块的具体业务逻辑（见 CLAUDE.md）。
 * 新增 feature 时，在这个数组里加一行就够了，不用改其他任何地方。
 *
 * 约定：一个 feature 的 mcp/index.ts 可以导出单个 tool 对象，也可以导出 tool 数组
 * （results 模块就导出 4 个）。工具的真实注册在 ./route.ts，这里只存定义。
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  /** zod raw shape：每个字段一个 zod schema，由 MCP SDK 转成 JSON Schema */
  inputSchema: Record<string, z.ZodType>;
  /**
   * MCP 工具注解。缺省按只读处理；会写库的工具（如 run_batch）必须自己声明
   * readOnlyHint: false，别让 AI client 误以为它只是查询。
   */
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  /**
   * 参数由 MCP SDK 用 inputSchema 校验后传进来；这里用 any 是唯一的"动态边界"，
   * 各 feature 自己的 handler 参数仍然是具体类型。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => Promise<unknown>;
}

export const mcpTools: McpToolDefinition[] = [
  classificationMcpTool,
  extractionMcpTool,
  comparisonMcpTool,
  pipelineMcpTool,
  ...resultsMcpTools,
  ...mailMcpTools,
  ...importMcpTools,
];
