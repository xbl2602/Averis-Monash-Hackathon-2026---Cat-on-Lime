/**
 * 文档池的查询与人工归类（SPEC 第 5.3 / 5.4 节）：
 * - 列表/详情只读，映射成对外的 view（列表只给 500 字符预览，详情给全文）
 * - 人工归类把 UNKNOWN 改成 SI/BL/OTHER，并把 review_status 置 filed
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
  if (!row) throw new DocumentNotFoundError(`没有找到 id 为 ${id} 的文档`);
  return toDetail(row);
}

export async function classifyUploadedDocument(
  request: ClassifyDocumentRequest
): Promise<DocumentDetail> {
  const result = await updateDocumentClassification(request);
  if (result.status === "not_found") {
    throw new DocumentNotFoundError(`没有找到 id 为 ${request.id} 的文档`);
  }
  if (result.status === "conflict") {
    throw new DocumentConflictError(
      "这条文档在你打开之后已被别人修改（updated_at 变了）。请刷新后重试，避免覆盖别人的归类结果"
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
