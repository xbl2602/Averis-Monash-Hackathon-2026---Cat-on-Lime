/**
 * Upload processing chain: whole-batch size cap → per file (validate → dedupe → parse →
 * identify → store the original file → write to DB).
 *
 * Per-file failure isolation (SPEC §6): each file has its own try/catch, combined with
 * mapWithConcurrencyLimit from lib/shared/concurrency.ts (at most 3 concurrent); one file
 * erroring only affects its own result entry, other files keep processing.
 */
import { createHash } from "node:crypto";
import { extractAttachmentText } from "@/lib/shared/attachment-text";
import { mapWithConcurrencyLimit } from "@/lib/shared/concurrency";
import { identifyDocumentType } from "@/lib/shared/document-identify";
import {
  findDocumentByHash,
  insertDocumentRow,
  removeStoredFile,
  uploadOriginalFile,
} from "./document-store";
import { BatchTooLargeError, ImportRequestError } from "./errors";
import {
  MAX_BATCH_BYTES,
  MAX_FILE_BYTES,
  UPLOAD_CONCURRENCY,
  UPLOADED_BY,
  type UploadItemResult,
  type UploadRequest,
  type UploadResponse,
} from "./types";
import {
  assertAllowedExtension,
  checkMagicBytes,
  decodeBase64File,
  detectContentType,
  estimateBase64DecodedBytes,
  formatBytes,
  sanitizeFileName,
  storagePathFor,
} from "./validate";

export async function uploadDocuments(request: UploadRequest): Promise<UploadResponse> {
  assertBatchWithinLimit(request.files);

  const batchId =
    request.batch_id ??
    `batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const jobs = request.files.map((raw, index) => ({ raw, index }));
  const outcome = await mapWithConcurrencyLimit(jobs, (job) => processUploadedFile(job.raw, job.index), {
    concurrency: UPLOAD_CONCURRENCY,
  });

  // Fill results back in original order, so the caller's `items` order matches the upload order
  const items: UploadItemResult[] = new Array(request.files.length);
  for (const { item, result } of outcome.succeeded) items[item.index] = result;
  for (const { item, error } of outcome.failed) {
    console.warn(`[import/upload] File #${item.index + 1} failed to process (unexpected error)`, error);
    items[item.index] = {
      name: fallbackName(item.raw, item.index),
      status: "rejected",
      reason: `Processing failed: ${describeError(error)}`,
    };
  }

  return { batch_id: batchId, items };
}

/** Whole-batch size check: over 3MB is rejected with 413 immediately, telling the frontend to split it into smaller batches (the GUI convention from SPEC 5.3) */
function assertBatchWithinLimit(files: unknown[]): void {
  let total = 0;
  for (const raw of files) {
    const base64 = readStringField(raw, "data_base64") ?? "";
    total += estimateBase64DecodedBytes(base64);
  }
  if (total > MAX_BATCH_BYTES) {
    throw new BatchTooLargeError(
      `This batch totals about ${formatBytes(total)}, over the per-request limit of ${formatBytes(MAX_BATCH_BYTES)}; ` +
        `please split it into batches of around 3MB each and upload them separately (each batch's results are shown separately, and failures can be retried individually)`
    );
  }
}

async function processUploadedFile(raw: unknown, index: number): Promise<UploadItemResult> {
  const displayName = fallbackName(raw, index);
  try {
    const extension = assertAllowedExtension(displayName);
    const dataBase64 = readStringField(raw, "data_base64");
    if (dataBase64 === null) {
      throw new ImportRequestError("Missing data_base64 (the file content was not sent)");
    }

    const content = decodeBase64File(dataBase64);
    if (content.length > MAX_FILE_BYTES) {
      throw new ImportRequestError(
        `File is ${formatBytes(content.length)}, over the per-file limit of ${formatBytes(MAX_FILE_BYTES)}`
      );
    }
    const magicError = checkMagicBytes(extension, content);
    if (magicError) throw new ImportRequestError(magicError);

    const fileHash = createHash("sha256").update(content).digest("hex");

    // Step 4: if it already exists, return duplicate right away without re-parsing/re-uploading
    const existing = await findDocumentByHash(fileHash);
    if (existing) {
      return {
        name: displayName,
        status: "duplicate",
        id: existing.id,
        detected_type: existing.detected_type,
      };
    }

    // Step 5: parse the text + identify the type from content (content that can't be read is marked unreadable but still stored, pending manual handling)
    const parsed = await extractAttachmentText(displayName, content);
    const detectedType = parsed.status === "ok" ? identifyDocumentType(parsed.text) : "UNKNOWN";

    const safeName = sanitizeFileName(displayName);
    const storagePath = storagePathFor(fileHash, safeName);
    const contentType = detectContentType(extension);

    // Step 6: store the original file first, then write the DB row; if the DB write fails, compensate by deleting the file so Storage doesn't accumulate orphans
    await uploadOriginalFile(storagePath, content, contentType);
    let row;
    try {
      row = await insertDocumentRow({
        file_name: safeName,
        file_size: content.length,
        mime: contentType,
        storage_path: storagePath,
        file_hash: fileHash,
        parse_status: parsed.status,
        parse_error: parsed.status === "ok" ? null : (parsed.error ?? "Parsing failed (reason unknown)"),
        extracted_text: parsed.status === "ok" ? parsed.text : null,
        detected_type: detectedType,
        review_status: detectedType === "UNKNOWN" ? "pending" : "filed",
        uploaded_by: UPLOADED_BY,
      });
    } catch (err) {
      await removeStoredFile(storagePath);
      throw new Error(
        `The original file was uploaded to Storage, but writing the document record failed; the original file has been rolled back and deleted: ${describeError(err)}`
      );
    }

    if (!row) {
      // Concurrent race: another request inserted the same hash while this one was parsing. The
      // path is derived from the hash and the content is identical, so we don't delete the
      // original file (the other record points to it); return duplicate and don't overwrite the
      // other record.
      const raced = await findDocumentByHash(fileHash);
      return {
        name: displayName,
        status: "duplicate",
        id: raced?.id,
        detected_type: raced?.detected_type,
      };
    }

    return {
      name: displayName,
      status: "stored",
      id: row.id,
      detected_type: row.detected_type,
      parse_status: row.parse_status,
      ...(row.parse_error ? { parse_error: row.parse_error } : {}),
    };
  } catch (err) {
    if (err instanceof ImportRequestError) {
      return { name: displayName, status: "rejected", reason: err.message };
    }
    throw err; // Unexpected errors are collected centrally by the concurrency layer (there's a console.warn at the corresponding call site above — never swallowed silently)
  }
}

function fallbackName(raw: unknown, index: number): string {
  const name = readStringField(raw, "name");
  return name && name.trim() !== "" ? name.trim() : `File #${index + 1}`;
}

function readStringField(raw: unknown, field: string): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = (raw as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
