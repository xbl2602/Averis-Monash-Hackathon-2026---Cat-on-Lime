/**
 * Types used to pass data between the three feature modules (classification / extraction /
 * comparison). These types map directly to the official submission format required (see
 * SHARED_INTERFACES.md and data/sample/README.md) — confirm with the operator before changing
 * anything here, since all three people depend on it.
 */

// This is the shape of the mailbox data in the official problem set (see data/sample/inbox/email_*.json)
export interface InboxEmail {
  email_id: string;
  from: string;
  subject: string;
  body: string;
  attachments: string[]; // e.g. "attachments/email_004_SI.txt"
}

// Output of the classification module.
// Note: the runtime list and the type are both defined here (single source of truth); any
// filtering/validation/dropdown options should be derived from here — don't write another
// copy of the category list in another module (see rule 4 of the data-flow rules in
// DATA_FLOW.md).
export const EMAIL_CATEGORIES = [
  "BL_COMPARISON",
  "SI_REQUEST",
  "INVOICE_QUERY",
  "GENERAL",
  "SPAM",
] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

// Output status of the comparison module (the runtime list here is likewise the single source of truth)
export const COMPARISON_STATUSES = ["OK", "MISMATCH", "NEEDS_REVIEW"] as const;
export type ComparisonStatus = (typeof COMPARISON_STATUSES)[number];

// Reason given when we're not sure (required whenever status is NEEDS_REVIEW)
export const REVIEW_REASONS = [
  "wrong_doc_type",
  "missing_attachment",
  "unreadable",
  "missing_value",
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

// The 7 fields the official spec requires us to compare. SI and BL may label these fields
// differently, so the extraction module is responsible for "aligning by meaning", not by
// matching the original field name verbatim.
export const COMPARED_FIELDS = [
  "shipper",
  "consignee",
  "notify_party",
  "port_of_loading",
  "port_of_discharge",
  "container_count",
  "gross_weight_kg",
] as const;
export type ComparedField = (typeof COMPARED_FIELDS)[number];

// Output of the extraction module: the fields pulled out of one document (SI or BL)
export type ExtractedDocumentFields = Partial<Record<ComparedField, string>>;

// The extraction module's judgment of "what this document actually is" (OTHER = clearly not
// an SI/BL, e.g. a commercial invoice/packing list/certificate of origin)
export type DocumentType = "SI" | "BL" | "OTHER" | "UNKNOWN";

// Field-level evidence (2026-09-21 P1-7): the source location matched by rule-based parsing
// (line number + original sentence); fields obtained via the LLM fallback have no line
// evidence and are only tagged with their source (don't fake evidence that isn't there)
export interface FieldEvidence {
  /** When matched by rule-based parsing: the line number in the original text (1-based) */
  line?: number;
  /** When matched by rule-based parsing: the actual line of original text the value came from (trailing whitespace stripped) */
  text?: string;
  source: "rules" | "llm";
}
export type ExtractedDocumentEvidence = Partial<Record<ComparedField, FieldEvidence>>;

// The complete output of the extraction module
export interface ExtractDocumentResult {
  document_type: DocumentType;
  fields: ExtractedDocumentFields;
  /** Whether the fields mainly came from "rule-based parsing" or the "LLM fallback" — used for debugging and stats */
  extracted_by: "rules" | "llm";
  /** The source of each extracted field (only includes fields that were actually extracted) */
  evidence: ExtractedDocumentEvidence;
}

// Output of the comparison module, which is also the "single record" format of the result
// ultimately handed to the official scoring system
// (the final submission file is one big object shaped like { [email_id]: EmailVerificationResult },
//  see data/sample/sample_submission.json)
export interface EmailVerificationResult {
  category: EmailCategory;
  status: ComparisonStatus;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[];
  has_defect: boolean;
}

// The full file format ultimately submitted to the official scoring system
export type SubmissionFile = Record<string, EmailVerificationResult>;
