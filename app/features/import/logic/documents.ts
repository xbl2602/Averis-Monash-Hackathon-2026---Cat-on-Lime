/**
 * Document pool querying and manual classification (SPEC sections 5.3 / 5.4):
 * - List/detail are read-only, mapped to the external view (list only gives a 500-character preview, detail gives the full text)
 * - Manual classification changes UNKNOWN to SI/BL/OTHER and sets review_status to filed
 */
import {
  getDocumentRowById,
  listDocumentRows,
  updateDocumentClassification,
} from "./document-store";
import { DocumentConflictError, DocumentNotFoundError } from "./errors";
import {
  DOCUMENT_PREVIEW_CHARS,
  type ClassifyDocumentRequest,
  type DocumentDetail,
  type DocumentListItem,
  type DocumentListQuery,
  type DocumentListResponse,
  type UploadedDocumentRow,
} from "./types";

export async function listUploadedDocuments(
  query: DocumentListQuery
): Promise<DocumentListResponse> {
  const { total, rows } = await listDocumentRows(query);
  return {
    total,
    limit: query.limit,
    offset: query.offset,
    items: rows.map(toListItem),
  };
}

export async function getUploadedDocument(id: string): Promise<DocumentDetail> {
  const row = await getDocumentRowById(id);
  if (!row) throw new DocumentNotFoundError(`No document found with id ${id}`);
  return toDetail(row);
}

export async function classifyUploadedDocument(
  request: ClassifyDocumentRequest
): Promise<DocumentDetail> {
  const result = await updateDocumentClassification(request);
  if (result.status === "not_found") {
    throw new DocumentNotFoundError(`No document found with id ${request.id}`);
  }
  if (result.status === "conflict") {
    throw new DocumentConflictError(
      "This document was modified by someone else after you opened it (updated_at changed). Please refresh and try again to avoid overwriting their classification"
    );
  }
  return toDetail(result.row);
}

export function toListItem(row: UploadedDocumentRow): DocumentListItem {
  const text = row.extracted_text ?? "";
  return {
    id: row.id,
    file_name: row.file_name,
    file_size: row.file_size,
    mime: row.mime,
    file_hash: row.file_hash,
    storage_path: row.storage_path,
    parse_status: row.parse_status,
    parse_error: row.parse_error,
    detected_type: row.detected_type,
    review_status: row.review_status,
    uploaded_by: row.uploaded_by,
    updated_at: row.updated_at,
    extracted_text_preview: text ? text.slice(0, DOCUMENT_PREVIEW_CHARS) : null,
  };
}

export function toDetail(row: UploadedDocumentRow): DocumentDetail {
  return { ...toListItem(row), extracted_text: row.extracted_text };
}
