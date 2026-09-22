/**
 * Shared types for the human-review loop (P1-1, see docs/REVIEW_SPEC.md).
 * Single source of truth: the REST/MCP of all four modules
 * (classification/extraction/comparison/pipeline) import from here — don't redefine a copy
 * in each module.
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

// Actions accepted by /review; undo goes through the separate /review/undo endpoint and isn't in this enum
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

// The audit log has one more action type than REVIEW_ACTION_TYPES: undo
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

/** A row in the review_overrides table (the currently effective human conclusion) */
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

/** A row in the review_actions table (append-only audit log) */
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

/** One item in the review queue: the system's original conclusion + the human override + the merged effective conclusion */
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

/** POST .../review request body (one action at a time) */
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
