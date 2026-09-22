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
 * Aggregates the MCP tool definitions exposed by each feature module.
 * This file only does the "aggregating" — it contains no module's actual business logic (see CLAUDE.md).
 * Adding a new feature only requires adding one line to this array; nothing else needs to change.
 *
 * Convention: a feature's mcp/index.ts can export either a single tool object or an array of tools
 * (the results module exports 4). The actual tool registration happens in ./route.ts; this file only holds the definitions.
 */

/** The second argument the aggregation layer passes to the handler (currently only "whether this call is anonymous") */
export interface McpToolContext {
  /** true = a call made without x-admin-token (currently only occurs in anonymous exceptions like a dry_run preview) */
  anonymous: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  /** zod raw shape: one zod schema per field, converted to JSON Schema by the MCP SDK */
  inputSchema: Record<string, z.ZodType>;
  /**
   * Hard rule for MCP tool annotations (the write-protection gate judges fail-closed, see ./route.ts):
   * - **A read-only tool must explicitly declare `readOnlyHint: true`**
   * - **A tool that writes to the database must explicitly declare `readOnlyHint: false`**
   * - Anything undeclared is treated as "requires a token" across the board (a write tool that forgot
   *   its annotation gets blocked, never slips through)
   */
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  /**
   * Determines the "anonymous exception" for a write tool (e.g. run_batch's dry_run=true preview):
   * when this returns true, a call without a token still executes, with `context.anonymous = true`.
   * If a write tool doesn't set this, a token is always required.
   */
  anonymousWriteWhen?: (args: unknown) => boolean;
  /**
   * Arguments are validated against inputSchema by the MCP SDK before being passed in; using `any`
   * here is the only "dynamic boundary" — each feature's own handler arguments are still concretely typed.
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
