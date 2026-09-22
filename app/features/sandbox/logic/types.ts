/**
 * Types and constants for the sandbox feature.
 *
 * Background (P2, 2026-09-21): the single-document classification/extraction endpoints originally only
 * worked against the repo's built-in sample data (passing email_id / attachment_path, pointing to files
 * under data/sample/) — there was no endpoint that could handle a judge bringing their own new SI/BL
 * document, or swapping in a different email to test. This module fills that gap: it accepts uploaded
 * file content directly (no persistence, no Supabase), runs classification+extraction+comparison once,
 * and returns the result.
 */
import type { ComparedField, ComparisonStatus, EmailCategory, ExtractDocumentResult, ReviewReason } from "@/lib/shared/types";

// Matches the formats lib/shared/attachment-text.ts can parse (txt/md are both read as plain text)
export const SANDBOX_ALLOWED_EXTENSIONS = ["txt", "md", "pdf", "docx", "xlsx"] as const;
export type SandboxAllowedExtension = (typeof SANDBOX_ALLOWED_EXTENSIONS)[number];

export const MAX_FILE_NAME_LENGTH = 120;
// Both files need to fit into a single JSON request body: Vercel's request body limit is roughly 4.5MB,
// and base64 is ~33% larger than the raw content, so the raw-content cap per file is set to 1.5MB (leaving
// enough headroom for two files plus JSON overhead). This is much more conservative than the import module's
// 20MB single-file limit — this use case is "paste one document pair to test," not "bulk archiving," so
// there's no need to match that limit.
export const MAX_FILE_BYTES = 1_500_000;

export interface SandboxFileInput {
  name: string;
  data_base64: string;
}

export interface RunAdhocTestRequest {
  /** Email body/subject are both optional: if omitted, classification is skipped and only extraction+comparison run */
  from?: string;
  subject?: string;
  body?: string;
  si: SandboxFileInput;
  bl: SandboxFileInput;
  provider?: string;
}

export interface RunAdhocTestResult {
  classification: { category: EmailCategory; confidence: number | null; needs_review: boolean } | null;
  extraction: { si: ExtractDocumentResult; bl: ExtractDocumentResult };
  comparison: {
    status: ComparisonStatus;
    defect_fields: ComparedField[];
    has_defect: boolean;
    review_reason: ReviewReason | null;
  };
}
