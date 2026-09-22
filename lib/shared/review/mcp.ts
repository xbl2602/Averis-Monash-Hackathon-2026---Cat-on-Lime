/**
 * MCP tool factory for the human-review loop (see docs/REVIEW_SPEC.md §8).
 * Each module's mcp/index.ts calls this with its target target_kind to get the 4 tool
 * definitions and add them into the array it exports.
 * Write tools must explicitly set readOnlyHint:false (the aggregation layer's gate is
 * fail-closed, see app/core/mcp-server/route.ts).
 */
import { z } from "zod";
import { LLM_PROVIDER_IDS } from "@/lib/llm";
import {
  COMPARED_FIELDS,
  COMPARISON_STATUSES,
  EMAIL_CATEGORIES,
  REVIEW_REASONS,
} from "@/lib/shared/types";
import { applyReviewAction, undoReviewAction } from "./actions";
import { getQueueItem, listActions, listReviewQueue } from "./store";
import { REVIEW_ACTION_TYPES, REVIEW_DISPOSITIONS, type ReviewTargetKind } from "./types";

const payloadSchema = z
  .object({
    category: z.enum(EMAIL_CATEGORIES).optional(),
    comparison_status: z.enum(COMPARISON_STATUSES).optional(),
    review_reason: z.enum(REVIEW_REASONS).nullable().optional(),
    defect_fields: z.array(z.enum(COMPARED_FIELDS)).optional(),
    extracted_si: z.record(z.string(), z.string()).optional(),
    extracted_bl: z.record(z.string(), z.string()).optional(),
    disposition: z.enum(REVIEW_DISPOSITIONS).optional(),
    provider: z.enum(LLM_PROVIDER_IDS).optional(),
  })
  .describe("Depends on the action; see the specific fields in docs/REVIEW_SPEC.md §4");

export function makeReviewMcpTools(targetKind: ReviewTargetKind, moduleLabel: string) {
  const listReviewTool = {
    name: `list_${targetKind}_review`,
    description: `Lists the human-review queue for ${moduleLabel} (by default only shows anomaly-driven items: needs review / has a mismatch / failed / degraded)`,
    inputSchema: {
      include_ok: z.boolean().optional().describe("true = also show items already marked OK"),
      q: z.string().optional().describe("Search by email ID / subject keyword"),
      status: z.enum(COMPARISON_STATUSES).optional(),
      reason: z.enum(REVIEW_REASONS).optional(),
      review_state: z
        .enum(["confirmed", "corrected", "deferred", "none"])
        .optional()
        .describe("none = items with no human disposition yet"),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (args: Record<string, unknown>) =>
      listReviewQueue(targetKind, {
        includeOk: args.include_ok === true,
        q: typeof args.q === "string" ? args.q : undefined,
        status: args.status as never,
        reason: args.reason as never,
        reviewState: args.review_state as never,
        limit: typeof args.limit === "number" ? args.limit : undefined,
        offset: typeof args.offset === "number" ? args.offset : undefined,
      }),
  };

  const historyTool = {
    name: `get_${targetKind}_review_history`,
    description: `Views the human-review action timeline (audit log) for a given email in ${moduleLabel}`,
    inputSchema: { email_id: z.string() },
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async ({ email_id }: { email_id: string }) => {
      const [item, actions] = await Promise.all([
        getQueueItem(targetKind, email_id),
        listActions(targetKind, email_id),
      ]);
      return { item, actions };
    },
  };

  const applyTool = {
    name: `apply_${targetKind}_review_action`,
    description:
      `Applies a human-review action to one email in ${moduleLabel} (writes to the database): ` +
      `confirm the system's conclusion / correct it / disposition to route it / defer to set it aside / undefer to restore it / note to add a comment / rerun to recompute it.`,
    inputSchema: {
      email_id: z.string(),
      action: z.enum(REVIEW_ACTION_TYPES),
      payload: payloadSchema.optional(),
      note: z.string().optional(),
      reason: z.string().optional(),
      expected_updated_at: z
        .string()
        .optional()
        .describe("Optimistic lock: pass the current override's updated_at; a mismatch fails (concurrent conflict)"),
    },
    annotations: { readOnlyHint: false, openWorldHint: false },
    handler: async (args: Record<string, unknown>) =>
      applyReviewAction(targetKind, args as unknown as Parameters<typeof applyReviewAction>[1]),
  };

  const undoTool = {
    name: `undo_${targetKind}_review_action`,
    description: `Undoes the most recent human-review action for a given email in ${moduleLabel} (writes to the database), or a specific action_id`,
    inputSchema: {
      email_id: z.string(),
      action_id: z.number().int().optional(),
      expected_updated_at: z.string().optional(),
    },
    annotations: { readOnlyHint: false, openWorldHint: false },
    handler: async (args: Record<string, unknown>) =>
      undoReviewAction(targetKind, args as unknown as Parameters<typeof undoReviewAction>[1]),
  };

  return [listReviewTool, historyTool, applyTool, undoTool];
}
