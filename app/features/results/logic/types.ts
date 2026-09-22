/**
 * Types and constants for the results module (result queries / stats / conflict pairs / export).
 *
 * These are "read models" used only within this module; the external contract (HTTP response /
 * MCP tool return format) is written in the "results module" section of SHARED_INTERFACES.md —
 * keep both in sync when changing either.
 * Do not import internal implementation details from here in another feature (see "everything is
 * a plugin" in CLAUDE.md).
 */
import type {
  ComparisonStatus,
  EmailCategory,
  ExtractedDocumentEvidence,
  ReviewReason,
} from "@/lib/shared/types";

// Fields the list can be sorted by (whitelist: only these columns can be used for querying/sorting, to avoid arbitrary column names)
export const RESULT_SORT_FIELDS = [
  "email_id",
  "category",
  "comparison_status",
  "defect_count",
  "updated_at",
] as const;
export type ResultSortField = (typeof RESULT_SORT_FIELDS)[number];

// Fields conflict pairs can be sorted by
export const CONFLICT_SORT_FIELDS = ["email_id", "defect_count", "updated_at"] as const;
export type ConflictSortField = (typeof CONFLICT_SORT_FIELDS)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

// Three states: processed=there's a row in the results table; failed=the row in the results table has processing_status='failed';
// pending=the raw email has no result row yet (no row in the table doesn't mean it failed, it just hasn't run yet)
export const PROCESSING_STATES = ["processed", "pending", "failed"] as const;
export type ProcessingState = (typeof PROCESSING_STATES)[number];

// Fields the list can be grouped by for display (corresponds to "custom display mode")
export const GROUP_FIELDS = ["category", "comparison_status"] as const;
export type GroupField = (typeof GROUP_FIELDS)[number];

export const EXPORT_FORMATS = ["json", "md", "txt", "csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// Export scenarios: the same underlying data exports different content depending on scenario (see SHARED_INTERFACES.md)
export const EXPORT_SCOPES = ["results", "conflicts", "stats", "submission"] as const;
export type ExportScope = (typeof EXPORT_SCOPES)[number];

export interface ResultQuery {
  /** Only these categories; default = all (including unprocessed) */
  categories?: EmailCategory[];
  statuses?: ComparisonStatus[];
  /** processed / pending / failed; default = all */
  processing?: ProcessingState;
  /** Only show MISMATCH (genuine defects) */
  hasDefect?: boolean;
  /** Substring match on model_provider, e.g. "jev", "rules" */
  provider?: string;
  /** Keyword search by email ID / sender / subject */
  q?: string;
  sortBy: ResultSortField;
  order: SortOrder;
  groupBy?: GroupField;
  limit: number;
  offset: number;
}

export interface ResultRow {
  email_id: string;
  from: string;
  subject: string;
  attachment_paths: string[];
  /** For unprocessed emails, all of these result fields are null / empty */
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: string[];
  defect_count: number;
  has_defect: boolean;
  processing_status: ProcessingState;
  error_message: string | null;
  model_provider: string | null;
  logic_version: string | null;
  updated_at: string | null;
  extracted_si: Record<string, string> | null;
  extracted_bl: Record<string, string> | null;
  /** Field-level provenance (rule-matched line number/original sentence; LLM fallback only marks the source), null if none */
  evidence_si: ExtractedDocumentEvidence | null;
  evidence_bl: ExtractedDocumentEvidence | null;
}

export interface ResultList {
  total: number;
  limit: number;
  offset: number;
  sortBy: ResultSortField;
  order: SortOrder;
  groupBy: GroupField | null;
  /** Only populated when groupBy is passed (counts the whole filtered set, not just the current page) */
  groups: { key: string; count: number }[] | null;
  items: ResultRow[];
}

export interface StatsSummary {
  /** Total number of raw emails (raw_emails) */
  total_emails: number;
  /** Number of rows present in the results table (including failed) */
  processed: number;
  /** Number with no result row yet = total_emails - processed */
  pending: number;
  /** Number with processing_status='failed' */
  failed: number;
  mismatch: number;
  needs_review: number;
  /** 5 categories + NOT_PROCESSED */
  by_category: Record<string, number>;
  /** OK / MISMATCH / NEEDS_REVIEW + NOT_PROCESSED */
  by_status: Record<string, number>;
  /** Ranking of defect field frequency (defect_fields from MISMATCH rows) */
  defect_field_frequency: { field: string; count: number }[];
  /** Distribution of model_provider values */
  providers: Record<string, number>;
  last_updated_at: string | null;
}

// Fields usable for numeric search / fuzzy matching ("exact/fuzzy" only makes sense for numeric fields;
// the authoritative set of numeric fields lives in canonical.ts in the comparison module — this is the
// read-side subset, keep both in sync if either changes)
export const NUMERIC_SEARCH_FIELDS = ["container_count", "gross_weight_kg"] as const;
export type NumericSearchField = (typeof NUMERIC_SEARCH_FIELDS)[number];

export const NUMERIC_MODES = ["exact", "fuzzy"] as const;
export type NumericMode = (typeof NUMERIC_MODES)[number];

export interface ConflictQuery {
  statuses: ComparisonStatus[];
  q?: string;
  sortBy: ConflictSortField;
  order: SortOrder;
  limit: number;
  offset: number;
  /** Numeric comparison mode: exact (default, matches what's stored in the results table) / fuzzy (small differences within tolerance don't count as a conflict) */
  numericMode: NumericMode;
  /** Only usable with fuzzy; when omitted each field uses its default tolerance (weight max(0.5kg, 0.1%), container count 0) */
  tolerance: number | null;
  /** Field to search by value (paired with value; both empty = no value search) */
  valueField: NumericSearchField | null;
  /** Numeric value to search for (already converted to a valid numeric string during validation) */
  value: string | null;
}

export interface ConflictPair {
  email_id: string;
  from: string;
  subject: string;
  /** Distinguished by _SI / _BL in the attachment filename; null if not found */
  si_file: string | null;
  bl_file: string | null;
  other_files: string[];
  status: ComparisonStatus;
  review_reason: ReviewReason | null;
  defect_fields: string[];
  defect_count: number;
  si_values: Record<string, string>;
  bl_values: Record<string, string>;
  /** Field-level provenance (same source as values; only present when a rule matched, giving line number/original sentence) */
  si_evidence: ExtractedDocumentEvidence | null;
  bl_evidence: ExtractedDocumentEvidence | null;
  updated_at: string | null;
}

export interface ConflictList {
  total: number;
  limit: number;
  offset: number;
  sortBy: ConflictSortField;
  order: SortOrder;
  items: ConflictPair[];
}

export interface ExportRequest {
  scope: ExportScope;
  format: ExportFormat;
  /** Effective when scope=results / conflicts; ignored for stats / submission */
  query: ResultQuery;
  conflictQuery: ConflictQuery;
}

export interface ExportDocument {
  filename: string;
  mimeType: string;
  format: ExportFormat;
  scope: ExportScope;
  itemCount: number;
  /** When scope=submission, the denominator for "how many there should be", used to judge whether the submission is complete */
  expectedTotal: number | null;
  /**
   * When scope=submission: where the denominator came from.
   * - sample = the official sample list (filenames under data/sample/inbox, most trustworthy)
   * - db-fallback = the list couldn't be read, fell back to the database total (incomplete is forced to true in this case)
   */
  expectedSource: "sample" | "db-fallback" | null;
  /** When scope=submission and expectedSource=sample: email_ids present in the list but missing from the export */
  missingIds: string[];
  /** When scope=submission: email_ids that have a result but whose logic_version doesn't match the current engine version */
  staleIds: string[];
  /**
   * When scope=submission: email_ids whose row fields are internally inconsistent (violating the official
   * schema, e.g. MISMATCH with no defect list, NEEDS_REVIEW carrying defects, or a review missing its reason).
   * Always an empty array for non-submission scenarios.
   */
  invalidIds: string[];
  /**
   * submission scenario: true if any of the following holds: expectedSource isn't sample, the item count
   * doesn't match the denominator, there are missing/stale-version/failed rows, or invalid rows
   * (fail-closed: better to report incomplete than to falsely claim "complete").
   */
  incomplete: boolean;
  /**
   * When scope=submission: number of items that should be reviewed but haven't been resolved yet
   * (NEEDS_REVIEW/MISMATCH with no corresponding manual override).
   * Part of the manual review loop (P1-1, see docs/REVIEW_SPEC.md §5.2); always 0 for non-submission scenarios.
   * Being greater than 0 doesn't affect incomplete (the submission format is still valid) — it just tells
   * the frontend "N items are still not manually resolved".
   */
  reviewPending: number;
  /** When scope=submission: number of items manually deferred and not yet resolved; always 0 for non-submission scenarios */
  reviewDeferred: number;
  /** The file content itself: used directly as the response body over HTTP, returned as text over MCP */
  content: string;
  generatedAt: string;
}
