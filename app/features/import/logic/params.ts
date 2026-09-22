/**
 * Parameter normalization: REST query / request body / MCP args all share the same validation,
 * with any invalid parameter throwing a readable ImportRequestError (mapped to 400 by the api layer).
 */
import { ImportRequestError } from "./errors";
import {
  DOCUMENT_TYPES,
  DOCUMENT_LIST_DEFAULT_LIMIT,
  DOCUMENT_LIST_MAX_LIMIT,
  MANUAL_DOCUMENT_TYPES,
  MAX_BATCH_FILES,
  REVIEW_STATUSES,
  type ClassifyDocumentRequest,
  type DocumentListQuery,
  type DocumentType,
  type ReviewStatus,
  type UploadRequest,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OFFSET_MAX = 1_000_000;

export function isDocumentId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function normalizeUploadRequest(raw: Record<string, unknown>): UploadRequest {
  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    throw new ImportRequestError("The request body is missing a files array (of the form [{ name, mime?, data_base64 }])");
  }
  if (raw.files.length > MAX_BATCH_FILES) {
    throw new ImportRequestError(
      `Max ${MAX_BATCH_FILES} files per call, please upload in batches (got ${raw.files.length})`
    );
  }
  const batchId = raw.batch_id;
  if (batchId !== undefined && batchId !== null && typeof batchId !== "string") {
    throw new ImportRequestError("batch_id must be a string");
  }
  return {
    files: raw.files,
    batch_id: typeof batchId === "string" && batchId.trim() !== "" ? batchId.trim() : undefined,
  };
}

export function normalizeDocumentListQuery(raw: Record<string, unknown>): DocumentListQuery {
  const reviewStatus = optionalString(raw.review_status, "review_status");
  if (reviewStatus && !(REVIEW_STATUSES as readonly string[]).includes(reviewStatus)) {
    throw new ImportRequestError(`review_status is invalid, allowed: ${REVIEW_STATUSES.join(" / ")}`);
  }
  const detectedType = optionalString(raw.detected_type, "detected_type");
  if (detectedType && !(DOCUMENT_TYPES as readonly string[]).includes(detectedType)) {
    throw new ImportRequestError(`detected_type is invalid, allowed: ${DOCUMENT_TYPES.join(" / ")}`);
  }
  return {
    review_status: reviewStatus as ReviewStatus | undefined,
    detected_type: detectedType as DocumentType | undefined,
    limit: parseInteger(raw.limit, DOCUMENT_LIST_DEFAULT_LIMIT, 1, DOCUMENT_LIST_MAX_LIMIT, "limit"),
    offset: parseInteger(raw.offset, 0, 0, OFFSET_MAX, "offset"),
  };
}

export function normalizeClassifyRequest(raw: Record<string, unknown>): ClassifyDocumentRequest {
  const id = optionalString(raw.id, "id");
  if (!id || !isDocumentId(id)) {
    throw new ImportRequestError("id must be a document uuid (from an upload result or the document list)");
  }
  const detectedType = optionalString(raw.detected_type, "detected_type")?.toUpperCase();
  if (!detectedType || !(MANUAL_DOCUMENT_TYPES as readonly string[]).includes(detectedType)) {
    throw new ImportRequestError(
      `Manual classification can only be one of ${MANUAL_DOCUMENT_TYPES.join(" / ")} (UNKNOWN means "not yet classified" and cannot be used as a target type)`
    );
  }
  const expected = raw.expected_updated_at;
  if (expected !== undefined && expected !== null && typeof expected !== "string") {
    throw new ImportRequestError("expected_updated_at must be a timestamp string");
  }
  return {
    id,
    detected_type: detectedType as DocumentType,
    expected_updated_at: typeof expected === "string" && expected !== "" ? expected : undefined,
  };
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ImportRequestError(`${name} must be a string`);
  return value.trim();
}

function parseInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  name: string
): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(String(value));
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ImportRequestError(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}
