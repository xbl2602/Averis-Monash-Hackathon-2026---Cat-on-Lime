/**
 * verification_results 结果表的读写封装（唯一入口）。
 *
 * 谁用：评测脚本 `scripts/evaluate.ts`、批量入口 `app/features/pipeline/`。
 * 写入一律 upsert（冲突键 email_id，见 CLAUDE.md「高并发」），不要"先查后插"。
 * 读用公开只读的 anon key，写用 service role key（有权限差异，别混）。
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
  ExtractedDocumentFields,
  ReviewReason,
} from "./types";

export type ProcessingStatus = "ok" | "failed";

/** 从结果表读回来的一行（增量跳过判断用） */
export interface StoredVerificationRow {
  email_id: string;
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[];
  has_defect: boolean | null;
  input_hash: string | null;
  logic_version: string | null;
  processing_status: ProcessingStatus;
}

/** 要写进 verification_results 的一行（snake_case 对应数据库列名） */
export interface VerificationResultRow {
  email_id: string;
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[];
  has_defect: boolean | null;
  extracted_si: ExtractedDocumentFields | null;
  extracted_bl: ExtractedDocumentFields | null;
  model_provider: string | null;
  input_hash: string;
  logic_version: string;
  processing_status: ProcessingStatus;
  error_message: string | null;
}

const SELECT_COLUMNS =
  "email_id,category,comparison_status,review_reason,defect_fields,has_defect,input_hash,logic_version,processing_status";

const UPSERT_BATCH_SIZE = 100;

export async function loadStoredVerificationRows(): Promise<Map<string, StoredVerificationRow>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("verification_results")
    .select(SELECT_COLUMNS)
    .limit(5000);

  if (error) throw new Error(`读取 verification_results 失败：${error.message}`);

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

/** 处理失败的邮件也要留痕：结果层看得见 failed + 原因，重跑时也会自动重试（见增量判断） */
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
        `写入 verification_results 第 ${i + 1}~${i + batch.length} 行失败：${error.message}`
      );
    }
  }
}

export function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
