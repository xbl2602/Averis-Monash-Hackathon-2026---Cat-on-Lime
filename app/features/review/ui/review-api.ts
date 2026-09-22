import type {
  ApplyReviewActionRequest,
  ApplyReviewActionResult,
  BulkReviewActionResult,
  ReviewActionRow,
  ReviewDisposition,
  ReviewQueueItem as ServerReviewQueueItem,
  ReviewState,
} from "@/lib/shared/review/types";
import type { ComparisonStatus, FutureRowFields } from "../../../_lib/contracts";
import { queryString } from "../../../_lib/api-client";
import type { IconName } from "../../../_components/icon";

export type { ApplyReviewActionRequest, ApplyReviewActionResult, BulkReviewActionResult, ReviewActionRow, ReviewDisposition, ReviewState };

/** A queue item as the server sends it today, plus the fields the screens are ready for (see _lib/backend-contract.ts). */
export type ReviewQueueItem = ServerReviewQueueItem & Pick<FutureRowFields, "classification_confidence" | "classification_needs_review" | "body"> & { from?: string };

export type ReviewModule = "comparison" | "extraction" | "classification" | "pipeline";

export const REVIEW_MODULES: { key: ReviewModule; label: string; icon: IconName; blurb: string }[] = [
  { key: "comparison", label: "Comparison", icon: "compare", blurb: "SI and BL disagree, or the system could not decide." },
  { key: "extraction", label: "Extraction", icon: "list", blurb: "A document was missing, unreadable or the wrong kind." },
  { key: "classification", label: "Classification", icon: "mail", blurb: "Every model failed, so a fallback guess was used." },
  { key: "pipeline", label: "Pipeline", icon: "play", blurb: "The email failed to process or used a fallback." },
];

export interface QueueResponse {
  total: number;
  items: ReviewQueueItem[];
}

export interface HistoryResponse {
  email_id: string;
  actions: ReviewActionRow[];
}

export interface QueueFilters {
  q: string;
  status: "" | ComparisonStatus;
  reviewState: "" | "none" | ReviewState;
  includeOk: boolean;
  limit: number;
  offset: number;
}

export const DEFAULT_QUEUE_FILTERS: QueueFilters = { q: "", status: "", reviewState: "", includeOk: false, limit: 20, offset: 0 };

export const reviewBase = (module: ReviewModule) => `/features/${module}/api/review`;

export function queueUrl(module: ReviewModule, f: QueueFilters): string {
  return `${reviewBase(module)}${queryString({
    q: f.q.trim(),
    status: f.status,
    review_state: f.reviewState,
    include_ok: f.includeOk,
    limit: f.limit,
    offset: f.offset,
  })}`;
}

export const historyUrl = (module: ReviewModule, emailId: string) => `${reviewBase(module)}/history${queryString({ email_id: emailId })}`;

export { DISPOSITION_LABELS, REVIEW_STATE_META } from "../../../_lib/labels";

export const ACTION_LABELS: Record<string, string> = {
  confirm: "Confirmed",
  correct: "Corrected",
  disposition: "Set a destination",
  defer: "Set aside",
  undefer: "Brought back",
  note: "Added a note",
  rerun: "Re-ran the pipeline",
  undo: "Undid an action",
};
