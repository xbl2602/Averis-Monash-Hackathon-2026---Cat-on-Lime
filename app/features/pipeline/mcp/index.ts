import { z } from "zod";
import { LLM_PROVIDER_IDS } from "@/lib/llm";
import { makeReviewMcpTools } from "@/lib/shared/review/mcp";
import { normalizeBatchRequest, runPipelineBatch } from "../logic";
import { BATCH_DEFAULT_LIMIT, BATCH_MAX_CONCURRENCY, BATCH_MAX_LIMIT } from "../logic/types";

/**
 * The MCP tool exposed by the pipeline module (this one writes to the database, it isn't read-only).
 * The handler only forwards "schema -> logic", sharing the same validation and implementation as REST.
 * Write protection: dry_run=false requires x-admin-token via the aggregation-layer gate; dry_run=true
 * allows anonymous preview (capped at 20 emails per call).
 */
export const pipelineMcpTool = {
  name: "run_batch",
  description:
    `Trigger a full batch verification run: runs "classify -> extract -> compare" over the sample emails, ` +
    `upserting into the results table by email_id (this writes to the database). ` +
    `Full set is 520 emails; ones whose content/engine haven't changed are skipped automatically. Max limit emails per call (default ${BATCH_DEFAULT_LIMIT}); ` +
    `checks a 30s deadline after each chunk, and if interrupted the response has stopped_by_deadline=true with remaining showing how many are left to run. ` +
    `Write mode (dry_run=false) requires x-admin-token; anonymous callers may only use dry_run=true to preview (max 20 emails per call, no writes).`,
  inputSchema: {
    email_ids: z
      .array(z.string())
      .optional()
      .describe("Only run these emails (e.g. ['email_004']); omit = all sample emails; cannot be combined with retry_failed"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(BATCH_MAX_LIMIT)
      .optional()
      .describe(`Max emails to run per call, default ${BATCH_DEFAULT_LIMIT}, max ${BATCH_MAX_LIMIT}`),
    force: z.boolean().optional().describe("true = ignore the incremental fingerprint and force recomputation, default false"),
    dry_run: z
      .boolean()
      .optional()
      .describe("true = only compute, don't write to the database (no service key needed), default false; anonymous callers are capped at 20 per call"),
    provider: z
      .enum(LLM_PROVIDER_IDS)
      .optional()
      .describe("Text fallback model, default gemini; cannot use jev (jev can only do structured judgments)"),
    concurrency: z
      .number()
      .int()
      .min(1)
      .max(BATCH_MAX_CONCURRENCY)
      .optional()
      .describe(`Max emails to process at once (also the chunk size), default 4, max ${BATCH_MAX_CONCURRENCY}`),
    retry_failed: z
      .boolean()
      .optional()
      .describe(
        "true = one-click retry of every email in the results table that failed processing or was degraded (the list is picked automatically, and recomputation is forced); cannot be combined with email_ids"
      ),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    // Rerunning the same batch of emails is an upsert (overwrites the same row), so it never produces duplicate data
    idempotentHint: true,
    openWorldHint: false,
  },
  /**
   * Anonymous exception for the write tool: dry_run=true previews don't write to the database, so
   * anonymous access is allowed (the cap is enforced in logic); dry_run=false (an actual write)
   * without a token gets rejected by the aggregation-layer gate.
   */
  anonymousWriteWhen: (args: unknown) =>
    (args as { dry_run?: unknown } | null)?.dry_run === true,
  handler: async (args: Record<string, unknown>, context?: { anonymous?: boolean }) =>
    runPipelineBatch(normalizeBatchRequest(args), { anonymous: context?.anonymous === true }),
};

// Manual review loop (P1-1): the queue = emails with processing_status=failed or model_provider containing degraded
export const pipelineReviewMcpTools = makeReviewMcpTools("pipeline", "Pipeline");
