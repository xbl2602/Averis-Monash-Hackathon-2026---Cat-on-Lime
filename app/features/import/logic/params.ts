/**
 * 参数归一化：REST query / 请求体 / MCP args 共用同一套校验，
 * 非法参数一律抛可读的 ImportRequestError（api 层映射 400）。
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
    throw new ImportRequestError("请求体缺少 files 数组（形如 [{ name, mime?, data_base64 }]）");
  }
  if (raw.files.length > MAX_BATCH_FILES) {
    throw new ImportRequestError(
      `单次最多 ${MAX_BATCH_FILES} 个文件，请分批上传（当前 ${raw.files.length} 个）`
    );
  }
  const batchId = raw.batch_id;
  if (batchId !== undefined && batchId !== null && typeof batchId !== "string") {
    throw new ImportRequestError("batch_id 必须是字符串");
  }
  return {
    files: raw.files,
    batch_id: typeof batchId === "string" && batchId.trim() !== "" ? batchId.trim() : undefined,
  };
}

export function normalizeDocumentListQuery(raw: Record<string, unknown>): DocumentListQuery {
  const reviewStatus = optionalString(raw.review_status, "review_status");
  if (reviewStatus && !(REVIEW_STATUSES as readonly string[]).includes(reviewStatus)) {
    throw new ImportRequestError(`review_status 不合法，可选：${REVIEW_STATUSES.join(" / ")}`);
  }
  const detectedType = optionalString(raw.detected_type, "detected_type");
  if (detectedType && !(DOCUMENT_TYPES as readonly string[]).includes(detectedType)) {
    throw new ImportRequestError(`detected_type 不合法，可选：${DOCUMENT_TYPES.join(" / ")}`);
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
    throw new ImportRequestError("id 必须是文档的 uuid（从上传结果或文档列表里取）");
  }
  const detectedType = optionalString(raw.detected_type, "detected_type")?.toUpperCase();
  if (!detectedType || !(MANUAL_DOCUMENT_TYPES as readonly string[]).includes(detectedType)) {
    throw new ImportRequestError(
      `人工归类只能选 ${MANUAL_DOCUMENT_TYPES.join(" / ")}（UNKNOWN 是"还没归类"，不能作为目标类型）`
    );
  }
  const expected = raw.expected_updated_at;
  if (expected !== undefined && expected !== null && typeof expected !== "string") {
    throw new ImportRequestError("expected_updated_at 必须是时间字符串");
  }
  return {
    id,
    detected_type: detectedType as DocumentType,
    expected_updated_at: typeof expected === "string" && expected !== "" ? expected : undefined,
  };
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new ImportRequestError(`${name} 必须是字符串`);
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
    throw new ImportRequestError(`${name} 必须是 ${min} ~ ${max} 之间的整数`);
  }
  return parsed;
}
