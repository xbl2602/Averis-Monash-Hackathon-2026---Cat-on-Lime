/**
 * 人工复核闭环的 MCP tool 工厂（见 docs/REVIEW_SPEC.md §8）。
 * 每个模块的 mcp/index.ts 用目标 target_kind 调这里，拿到 4 个 tool 定义加进自己导出的数组。
 * 写 tool 必须显式 readOnlyHint:false（汇总层 gate 按 fail-closed 判定，见 app/core/mcp-server/route.ts）。
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
  .describe("视 action 而定，具体字段见 docs/REVIEW_SPEC.md §4");

export function makeReviewMcpTools(targetKind: ReviewTargetKind, moduleLabel: string) {
  const listReviewTool = {
    name: `list_${targetKind}_review`,
    description: `列出${moduleLabel}的人工复核队列（默认只显示异常驱动的项：需要复核/有差异/失败/降级）`,
    inputSchema: {
      include_ok: z.boolean().optional().describe("true = 也显示已判 OK 的项"),
      q: z.string().optional().describe("按邮件ID/主题关键词搜索"),
      status: z.enum(COMPARISON_STATUSES).optional(),
      reason: z.enum(REVIEW_REASONS).optional(),
      review_state: z
        .enum(["confirmed", "corrected", "deferred", "none"])
        .optional()
        .describe("none = 还没有任何人工处置的项"),
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
    description: `查看${moduleLabel}某封邮件的人工复核动作时间线（审计日志）`,
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
      `对${moduleLabel}的一封邮件应用人工复核动作（会写库）：` +
      `confirm 确认系统结论 / correct 修正 / disposition 分拣去向 / defer 搁置 / undefer 恢复 / note 备注 / rerun 重跑。`,
    inputSchema: {
      email_id: z.string(),
      action: z.enum(REVIEW_ACTION_TYPES),
      payload: payloadSchema.optional(),
      note: z.string().optional(),
      reason: z.string().optional(),
      expected_updated_at: z
        .string()
        .optional()
        .describe("乐观锁：传当前 override 的 updated_at，不匹配会失败（并发冲突）"),
    },
    annotations: { readOnlyHint: false, openWorldHint: false },
    handler: async (args: Record<string, unknown>) =>
      applyReviewAction(targetKind, args as unknown as Parameters<typeof applyReviewAction>[1]),
  };

  const undoTool = {
    name: `undo_${targetKind}_review_action`,
    description: `撤销${moduleLabel}某封邮件最近一次人工复核动作（会写库），或撤销指定 action_id`,
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
