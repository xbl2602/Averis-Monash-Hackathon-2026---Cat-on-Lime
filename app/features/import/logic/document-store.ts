/**
 * Read/write layer for the uploaded_documents table + Storage (uploads bucket).
 *
 * Concurrency conventions (SPEC section 6):
 * - Deduplicated writes use upsert + onConflict(file_hash) + ignoreDuplicates: when the same file is
 *   uploaded concurrently, the database guarantees only one row exists, the later request gets an
 *   empty result and is returned as duplicate; never "check first, then insert", and never overwrite
 *   an existing record
 * - Reads use the anon client (the table has select open to anon), writes use the service client
 */
import { getSupabaseClient, getSupabaseServiceClient } from "@/lib/shared/supabase";
import { DocumentStoreError } from "./errors";
import {
  UPLOAD_BUCKET,
  type ClassifyDocumentRequest,
  type DocumentListQuery,
  type NewDocumentRow,
  type UpdateClassificationResult,
  type UploadedDocumentRow,
} from "./types";

function getReadClient() {
  try {
    return getSupabaseClient();
  } catch (err) {
    throw new DocumentStoreError(err instanceof Error ? err.message : "Failed to initialize the Supabase read-only client");
  }
}

/** Dedup pre-check: only looks at id/detected_type, a duplicate file doesn't need to be parsed again */
export async function findDocumentByHash(
  fileHash: string
): Promise<Pick<UploadedDocumentRow, "id" | "detected_type"> | null> {
  const { data, error } = await getReadClient()
    .from("uploaded_documents")
    .select("id, detected_type")
    .eq("file_hash", fileHash)
    .maybeSingle();
  if (error) throw new DocumentStoreError(`Failed to query for duplicate document: ${error.message}`);
  return data as Pick<UploadedDocumentRow, "id" | "detected_type"> | null;
}

/**
 * Insert a document record. Returning null means the file hash already exists (someone else inserted
 * it first under concurrency) — the caller should return duplicate rather than overwriting the original record.
 */
export async function insertDocumentRow(row: NewDocumentRow): Promise<UploadedDocumentRow | null> {
  const { data, error } = await getSupabaseServiceClient()
    .from("uploaded_documents")
    .upsert(row, { onConflict: "file_hash", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (error) throw new DocumentStoreError(`Failed to write document record: ${error.message}`);
  return (data as UploadedDocumentRow | null) ?? null;
}

/** List query: returns the matching total count and the current page's rows */
export async function listDocumentRows(
  query: DocumentListQuery
): Promise<{ total: number; rows: UploadedDocumentRow[] }> {
  let request = getReadClient()
    .from("uploaded_documents")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);
  if (query.review_status) request = request.eq("review_status", query.review_status);
  if (query.detected_type) request = request.eq("detected_type", query.detected_type);

  const { data, error, count } = await request;
  if (error) throw new DocumentStoreError(`Failed to query document list: ${error.message}`);
  return { total: count ?? 0, rows: (data ?? []) as UploadedDocumentRow[] };
}

export async function getDocumentRowById(id: string): Promise<UploadedDocumentRow | null> {
  const { data, error } = await getReadClient()
    .from("uploaded_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new DocumentStoreError(`Failed to query document detail: ${error.message}`);
  return (data as UploadedDocumentRow | null) ?? null;
}

/**
 * Manual classification: updates detected_type and sets review_status to filed.
 * Uses optimistic locking when expected_updated_at is given; if no row is updated, distinguishes between "doesn't exist" and "was changed".
 */
export async function updateDocumentClassification(
  request: ClassifyDocumentRequest
): Promise<UpdateClassificationResult> {
  let update = getSupabaseServiceClient()
    .from("uploaded_documents")
    .update({
      detected_type: request.detected_type,
      review_status: "filed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);
  if (request.expected_updated_at) {
    update = update.eq("updated_at", request.expected_updated_at);
  }

  const { data, error } = await update.select("*").maybeSingle();
  if (error) throw new DocumentStoreError(`Failed to update document classification: ${error.message}`);
  if (data) return { status: "ok", row: data as UploadedDocumentRow };

  const existing = await getDocumentRowById(request.id);
  return existing ? { status: "conflict" } : { status: "not_found" };
}

/** Write the original file into Storage: the path is generated from the content hash, so writing the same content again is idempotent (upsert) */
export async function uploadOriginalFile(
  storagePath: string,
  content: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await getSupabaseServiceClient()
    .storage.from(UPLOAD_BUCKET)
    .upload(storagePath, content, { contentType, upsert: true });
  if (error) throw new DocumentStoreError(`Failed to upload the original file to Storage: ${error.message}`);
}

/** Compensating action (deletes the just-uploaded original file if the database write fails): best-effort, logs a warning on failure instead of throwing */
export async function removeStoredFile(storagePath: string): Promise<void> {
  try {
    const { error } = await getSupabaseServiceClient()
      .storage.from(UPLOAD_BUCKET)
      .remove([storagePath]);
    if (error) {
      console.warn(`[import] Failed to roll back (delete) Storage file (${storagePath}): ${error.message}`);
    }
  } catch (err) {
    console.warn(`[import] Exception while rolling back (deleting) Storage file (${storagePath}):`, err);
  }
}
