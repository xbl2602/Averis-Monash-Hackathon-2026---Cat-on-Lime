import { classificationMcpTool } from "@/app/features/classification/mcp";
import { extractionMcpTool } from "@/app/features/extraction/mcp";
import { comparisonMcpTool } from "@/app/features/comparison/mcp";

/**
 * 汇总各个 feature 模块暴露的 MCP tool 定义。
 * 这个文件只做"汇总"，不包含任何一个模块的具体业务逻辑（见 CLAUDE.md）。
 * 新增 feature 时，在这个数组里加一行就够了，不用改其他任何地方。
 */
export const mcpTools = [classificationMcpTool, extractionMcpTool, comparisonMcpTool];
