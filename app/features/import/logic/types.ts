/**
 * import feature 的类型与常量（第二阶段 SPEC 第 5 节）。
 * 本模块自包含：表 uploaded_documents 和 Storage bucket uploads 只由这里读写。
 */
import type { DocumentType } from "@/lib/shared/types";

// 类型唯一来源仍是 lib/shared/types.ts，这里 re-export 方便本模块内部引用
export type { DocumentType };

export const UPLOAD_BUCKET = "uploads";

// 下面两个上限先写死为 SPEC 的默认值（storage.upload_max_file_mb=20 / upload_max_batch_mb=3），
// 配置系统（config feature）接入后改为读 app_config；本阶段保证行为固定、可预期。
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_BATCH_BYTES = 3 * 1024 * 1024;
// Vercel 请求体上限约 4.5MB：base64 比原文大 ~33%，3MB 原文约 4MB，留余量后在这里提前拦截
export const MAX_RAW_BODY_BYTES = 4_500_000;

export const UPLOAD_CONCURRENCY = 3;
export const DOCUMENT_PREVIEW_CHARS = 500;
export const DOCUMENT_LIST_DEFAULT_LIMIT = 20;
export const DOCUMENT_LIST_MAX_LIMIT = 200;
export const UPLOADED_BY = "admin";
export const MAX_FILE_NAME_LENGTH = 120;
// 单请求最多几个文件（纯防误用：上传本来就有口令保护；超限返回可读 400 提示分批）
export const MAX_BATCH_FILES = 50;

export const ALLOWED_EXTENSIONS = ["txt", "md", "pdf", "docx", "xlsx"] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export const REVIEW_STATUSES = ["pending", "filed", "skipped"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// 运行时的类型清单（类型的唯一来源仍是 lib/shared/types.ts；这里用 satisfies 保证两边同步，
// 一旦那边增删取值，typecheck 会在这里报错）
export const DOCUMENT_TYPES = ["SI", "BL", "OTHER", "UNKNOWN"] as const satisfies readonly DocumentType[];
// 人工归类的允许目标：UNKNOWN 文档只能改成这三类之一
export const MANUAL_DOCUMENT_TYPES = ["SI", "BL", "OTHER"] as const;

export type ParseStatus = "ok" | "unreadable";

/** 上传请求：files 的每一项在 processUploadedFile 里逐项校验（不整批 400） */
export interface UploadRequest {
  files: unknown[];
  batch_id?: string;
}

export type UploadItemStatus = "stored" | "duplicate" | "rejected";

export interface UploadItemResult {
  name: string;
  status: UploadItemStatus;
  /** rejected 时的可读原因；unreadable 的文档也带 parse_error */
  reason?: string;
  id?: string;
  detected_type?: DocumentType;
  parse_status?: ParseStatus;
  parse_error?: string;
}

export interface UploadResponse {
  batch_id: string;
  items: UploadItemResult[];
}

export interface DocumentListQuery {
  review_status?: ReviewStatus;
  detected_type?: DocumentType;
  limit: number;
  offset: number;
}

export interface DocumentListItem {
  id: string;
  file_name: string;
  file_size: number;
  mime: string | null;
  file_hash: string;
  storage_path: string | null;
  parse_status: ParseStatus;
  parse_error: string | null;
  detected_type: DocumentType;
  review_status: ReviewStatus;
  uploaded_by: string | null;
  updated_at: string | null;
  /** 列表只给前 500 字符预览，不返回全文（全文走单文档详情） */
  extracted_text_preview: string | null;
}

export interface DocumentListResponse {
  total: number;
  limit: number;
  offset: number;
  items: DocumentListItem[];
}

export interface DocumentDetail extends DocumentListItem {
  extracted_text: string | null;
}

export interface ClassifyDocumentRequest {
  id: string;
  detected_type: DocumentType;
  /** 可选乐观锁：和库里当前 updated_at 不一致时返回 409（SPEC 第 6 节） */
  expected_updated_at?: string;
}

/** uploaded_documents 表的一行（列名与数据库一致） */
export interface UploadedDocumentRow {
  id: string;
  file_name: string;
  file_size: number;
  mime: string | null;
  storage_path: string | null;
  file_hash: string;
  parse_status: ParseStatus;
  parse_error: string | null;
  extracted_text: string | null;
  detected_type: DocumentType;
  review_status: ReviewStatus;
  uploaded_by: string | null;
  updated_at: string | null;
}

/** 新插入行需要的字段（id / updated_at 由数据库生成） */
export type NewDocumentRow = Omit<UploadedDocumentRow, "id" | "updated_at">;

export type UpdateClassificationResult =
  | { status: "ok"; row: UploadedDocumentRow }
  | { status: "conflict" }
  | { status: "not_found" };
