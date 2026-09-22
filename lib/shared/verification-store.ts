/**
 * Read/write wrapper for the verification_results table (single entry point).
 *
 * Used by: the evaluation script `scripts/evaluate.ts` and the batch entry point
 * `app/features/pipeline/`.
 * Writes always use upsert (conflict key email_id, see the "High Concurrency" section of
 * CLAUDE.md) — never "query then insert".
 * Reads use the publicly readable anon key; writes use the service role key (they carry
 * different permissions, so don't mix them up).
 */
import { getSupabaseClient, getSupabaseServiceClient } from "./supabase";
import {
  PIPELINE_LOGIC_VERSION,
  type PipelineEmailInput,
  type PipelineOutcome,
} from "./pipeline";
import type {
  ComparedField,
  ComparisonStatus,
  EmailCategory,
  ExtractedDocumentEvidence,
  ExtractedDocumentFields,
  ReviewReason,
} from "./types";

export type ProcessingStatus = "ok" | "failed";

/** A row read back from the results table (used for incremental-skip decisions) */
export interface StoredVerificationRow {
  email_id: string;
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[];
  has_defect: boolean | null;
  model_provider: string | null;
  input_hash: string | null;
  logic_version: string | null;
  processing_status: ProcessingStatus;
}

/** A row to write into verification_results (snake_case matches the DB column names) */
export interface VerificationResultRow {
  email_id: string;
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[];
  has_defect: boolean | null;
  extracted_si: ExtractedDocumentFields | null;
  extracted_bl: ExtractedDocumentFields | null;
  evidence_si: ExtractedDocumentEvidence | null;
  evidence_bl: ExtractedDocumentEvidence | null;
  model_provider: string | null;
  input_hash: string;
  logic_version: string;
  processing_status: ProcessingStatus;
  error_message: string | null;
}

const SELECT_COLUMNS =
  "email_id,category,comparison_status,review_reason,defect_fields,has_defect,model_provider,input_hash,logic_version,processing_status";

const UPSERT_BATCH_SIZE = 100;

export async function loadStoredVerificationRows(): Promise<Map<string, StoredVerificationRow>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("verification_results")
    .select(SELECT_COLUMNS)
    .limit(5000);

  if (error) throw new Error(`Failed to read verification_results: ${error.message}`);

  const rows = new Map<string, StoredVerificationRow>();
  for (const row of (data ?? []) as StoredVerificationRow[]) {
    rows.set(row.email_id, row);
  }
  return rows;
}

export function buildSuccessRow(
  input: PipelineEmailInput,
  outcome: PipelineOutcome,
  inputHash: string
): VerificationResultRow {
  return {
    email_id: input.email.email_id,
    category: outcome.result.category,
    comparison_status: outcome.result.status,
    review_reason: outcome.result.review_reason,
    defect_fields: outcome.result.defect_fields,
    has_defect: outcome.result.has_defect,
    extracted_si: outcome.extracted.si,
    extracted_bl: outcome.extracted.bl,
    evidence_si: outcome.evidence.si,
    evidence_bl: outcome.evidence.bl,
    model_provider: [
      outcome.meta.classifier,
      outcome.meta.extractor.si ?? "-",
      outcome.meta.extractor.bl ?? "-",
      outcome.meta.comparer ?? "-",
    ].join("/"),
    input_hash: inputHash,
    logic_version: PIPELINE_LOGIC_VERSION,
    processing_status: "ok",
    error_message: null,
  };
}

/** Emails that fail processing must also leave a trace: the results layer can see failed + the reason, and reruns will automatically retry them (see incremental-skip logic) */
export function buildFailureRow(
  input: PipelineEmailInput,
  error: unknown,
  inputHash: string
): VerificationResultRow {
  return {
    email_id: input.email.email_id,
    category: null,
    comparison_status: null,
    review_reason: null,
    defect_fields: [],
    has_defect: null,
    extracted_si: null,
    extracted_bl: null,
    evidence_si: null,
    evidence_bl: null,
    model_provider: null,
    input_hash: inputHash,
    logic_version: PIPELINE_LOGIC_VERSION,
    processing_status: "failed",
    error_message: describeError(error).slice(0, 2000),
  };
}

export async function upsertVerificationRows(rows: VerificationResultRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = getSupabaseServiceClient();

  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase
      .from("verification_results")
      .upsert(batch, { onConflict: "email_id" });
    if (error) {
      throw new Error(
        `Failed to write verification_results rows ${i + 1}-${i + batch.length}: ${error.message}`
      );
    }
  }
}

export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
