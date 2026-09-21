/**
 * 人工复核闭环（P1-1，见 docs/REVIEW_SPEC.md）的共用类型。
 * 唯一来源：四个模块（classification/extraction/comparison/pipeline）的 REST/MCP
 * 都从这里 import，不要各自重复定义一份。
 */
import type {
  ComparedField,
  ComparisonStatus,
  EmailCategory,
  ExtractedDocumentFields,
  ReviewReason,
} from "@/lib/shared/types";

export const REVIEW_TARGET_KINDS = [
  "classification",
  "extraction",
  "comparison",
  "pipeline",
] as const;
export type ReviewTargetKind = (typeof REVIEW_TARGET_KINDS)[number];

export function isReviewTargetKind(value: unknown): value is ReviewTargetKind {
  return typeof value === "string" && (REVIEW_TARGET_KINDS as readonly string[]).includes(value);
}

export const REVIEW_STATES = ["confirmed", "corrected", "deferred"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

// /review 接受的动作；undo 走独立的 /review/undo 端点，不在这个枚举里
export const REVIEW_ACTION_TYPES = [
  "confirm",
  "correct",
  "disposition",
  "defer",
  "undefer",
  "note",
  "rerun",
] as const;
export type ReviewActionType = (typeof REVIEW_ACTION_TYPES)[number];

// 审计日志里出现的动作类型比 REVIEW_ACTION_TYPES 多一个 undo
export const REVIEW_AUDIT_ACTION_TYPES = [...REVIEW_ACTION_TYPES, "undo"] as const;
export type ReviewAuditActionType = (typeof REVIEW_AUDIT_ACTION_TYPES)[number];

export const REVIEW_DISPOSITIONS = [
  "accepted",
  "corrected",
  "routed",
  "returned",
  "awaiting_input",
  "unprocessable",
] as const;
export type ReviewDisposition = (typeof REVIEW_DISPOSITIONS)[number];

export function isReviewDisposition(value: unknown): value is ReviewDisposition {
  return typeof value === "string" && (REVIEW_DISPOSITIONS as readonly string[]).includes(value);
}

/** review_overrides 表的一行（当前生效的人工结论） */
export interface ReviewOverride {
  target_kind: ReviewTargetKind;
  email_id: string;
  review_state: ReviewState;
  disposition: ReviewDisposition | null;
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[] | null;
  extracted_si: ExtractedDocumentFields | null;
  extracted_bl: ExtractedDocumentFields | null;
  note: string | null;
  decided_by: string;
  created_at: string;
  updated_at: string;
}

/** review_actions 表的一行（append-only 审计） */
export interface ReviewActionRow {
  id: number;
  target_kind: ReviewTargetKind;
  email_id: string;
  action_type: ReviewAuditActionType;
  before_state: ReviewOverride | null;
  after_state: ReviewOverride | null;
  undo_of: number | null;
  reason: string | null;
  note: string | null;
  actor: string;
  batch_id: string | null;
  created_at: string;
}

/** 复核队列一项：系统原始结论 + 人工覆盖 + 合并后的有效结论 */
export interface ReviewQueueItem {
  email_id: string;
  subject: string;
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[];
  processing_status: "ok" | "failed" | "pending";
  model_provider: string | null;
  override: ReviewOverride | null;
  last_action_at: string | null;
  updated_at: string | null;
}

/** POST .../review 请求体（一次一个动作） */
export interface ApplyReviewActionRequest {
  email_id: string;
  action: ReviewActionType;
  payload?: {
    category?: EmailCategory;
    comparison_status?: ComparisonStatus;
    review_reason?: ReviewReason | null;
    defect_fields?: ComparedField[];
    extracted_si?: ExtractedDocumentFields;
    extracted_bl?: ExtractedDocumentFields;
    disposition?: ReviewDisposition;
    provider?: string;
  };
  note?: string;
  reason?: string;
  expected_updated_at?: string;
}

export interface ApplyReviewActionResult {
  item: ReviewQueueItem;
  action: ReviewActionRow;
  /**
   * 只有 rerun 会带：这次重跑成功后，哪几个模块上原有的人工结论被新的系统结论取代、清掉了
   * （空数组 = 没有清掉任何东西，比如重跑失败，或者本来就没有人工结论）。见 REVIEW_SPEC §4.5。
   */
  replaced_decisions?: ReviewTargetKind[];
}

export interface UndoReviewActionRequest {
  email_id: string;
  action_id?: number;
  expected_updated_at?: string;
}

export interface BulkReviewActionRequest {
  email_ids: string[];
  action: Extract<ReviewActionType, "confirm" | "disposition" | "defer">;
  payload?: ApplyReviewActionRequest["payload"];
}

export interface BulkReviewActionResult {
  batch_id: string;
  succeeded: string[];
  failed: { email_id: string; error: string }[];
}
