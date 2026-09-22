/**
 * Response shapes the screens read. They mirror the contract in docs/SHARED_INTERFACES.md
 * (that document is the authority; if a route changes, update it and this file together).
 * Only the shared types in lib/shared are imported, never another feature's internals.
 */
import type { ReviewOverride } from "@/lib/shared/review/types";
import type {
  ComparisonStatus,
  EmailCategory,
  ExtractDocumentResult,
  ExtractedDocumentEvidence,
  ComparedField,
  ReviewReason,
} from "@/lib/shared/types";

export type { ComparedField, ComparisonStatus, EmailCategory, ExtractDocumentResult, ExtractedDocumentEvidence, ReviewReason };

export type ProcessingStatus = "ok" | "failed" | "pending";
export type FieldValues = Record<string, string>;

/**
 * Fields the server does not send yet; every screen that uses one works without it and switches on when it appears.
 * See _lib/backend-contract.ts for what each one means and which parameter goes with it.
 */
export interface FutureRowFields {
  classification_confidence?: number | null;
  classification_needs_review?: boolean;
  review?: ReviewOverride | null;
  body?: string | null;
}

// ---- results ----
export interface ResultRow extends FutureRowFields {
  email_id: string;
  from: string;
  subject: string;
  body: string;
  attachment_paths: string[];
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: string[];
  defect_count: number;
  has_defect: boolean;
  processing_status: ProcessingStatus;
  error_message: string | null;
  model_provider: string | null;
  logic_version: string | null;
  updated_at: string | null;
  extracted_si: FieldValues | null;
  extracted_bl: FieldValues | null;
  evidence_si: ExtractedDocumentEvidence | null;
  evidence_bl: ExtractedDocumentEvidence | null;
}

export interface ResultList {
  total: number;
  limit: number;
  offset: number;
  groups: { key: string; count: number }[] | null;
  items: ResultRow[];
}

export interface StatsSummary {
  total_emails: number;
  processed: number;
  pending: number;
  failed: number;
  mismatch: number;
  needs_review: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
  defect_field_frequency: { field: string; count: number }[];
  providers: Record<string, number>;
  last_updated_at: string | null;
  /** Not sent yet: how many emails the classifier was unsure about */
  classification_needs_review?: number;
}

// ---- conflicts ----
export interface ConflictPair extends FutureRowFields {
  email_id: string;
  from: string;
  subject: string;
  si_file: string | null;
  bl_file: string | null;
  other_files: string[];
  status: ComparisonStatus;
  review_reason: ReviewReason | null;
  defect_fields: string[];
  defect_count: number;
  si_values: FieldValues;
  bl_values: FieldValues;
  si_evidence: ExtractedDocumentEvidence | null;
  bl_evidence: ExtractedDocumentEvidence | null;
  updated_at: string | null;
}

export interface ConflictList {
  total: number;
  limit: number;
  offset: number;
  items: ConflictPair[];
}

// ---- pipeline ----
export interface RunSummary {
  total_emails: number;
  selected: number;
  skipped: number;
  ran: number;
  succeeded: number;
  failed: number;
  wrote: number;
  remaining: number;
  stopped_by_deadline: boolean;
  dry_run: boolean;
  logic_version: string;
  duration_ms: number;
  failures: { email_id: string; error: string }[];
}

// ---- sandbox ----
export interface SandboxResult {
  classification: { category: EmailCategory; confidence: number | null; needs_review: boolean } | null;
  extraction: { si: ExtractDocumentResult; bl: ExtractDocumentResult };
  comparison: {
    status: ComparisonStatus;
    defect_fields: ComparedField[];
    has_defect: boolean;
    review_reason: ReviewReason | null;
  };
}

// ---- documents (import) ----
export type DetectedType = "SI" | "BL" | "OTHER" | "UNKNOWN";
export type DocumentReviewStatus = "pending" | "filed" | "skipped";

export interface UploadItemResult {
  name: string;
  status: "stored" | "duplicate" | "rejected";
  reason?: string;
  id?: string;
  detected_type?: DetectedType;
  parse_status?: "ok" | "unreadable";
  parse_error?: string;
}

export interface UploadResponse {
  batch_id: string;
  items: UploadItemResult[];
}

export interface DocumentListItem {
  id: string;
  file_name: string;
  file_size: number;
  mime: string | null;
  file_hash: string;
  parse_status: "ok" | "unreadable";
  parse_error: string | null;
  detected_type: DetectedType;
  review_status: DocumentReviewStatus;
  uploaded_by: string | null;
  updated_at: string | null;
  extracted_text_preview: string | null;
}

export interface DocumentList {
  total: number;
  limit: number;
  offset: number;
  items: DocumentListItem[];
}

export interface DocumentDetail extends DocumentListItem {
  extracted_text: string | null;
}

// ---- config / mail ----
export interface ConfigItem {
  key: string;
  category: "llm" | "pipeline" | "storage" | "mail" | "general";
  value: unknown;
  is_secret: boolean;
  has_value: boolean;
  source: "db" | "env" | "default" | "unset";
  updated_at: string | null;
}

export interface GmailConnection {
  provider: "gmail";
  status: "disconnected" | "pending" | "connected" | "error";
  email_address: string | null;
  scopes: string[] | null;
  token_expires_at: string | null;
  last_synced_at: string | null;
  has_access_token: boolean;
  has_refresh_token: boolean;
  updated_at: string | null;
}

export interface SupabaseProject {
  id: string;
  label: string;
  project_url: string;
  anon_key: string | null;
  service_key: string | null;
  has_service_key: boolean;
  is_active: boolean;
  updated_at: string | null;
}
