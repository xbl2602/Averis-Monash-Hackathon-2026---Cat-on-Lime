/**
 * 上传处理链：整批限额 → 逐文件（校验 → 去重 → 解析 → 识别 → 存原文件 → 落库）。
 *
 * 单文件失败隔离（SPEC 第 6 节）：每个文件自己有 try/catch，配合
 * lib/shared/concurrency.ts 的 mapWithConcurrencyLimit（同时最多 3 个），
 * 一个文件出错只影响它自己的结果项，其他文件继续处理。
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

  // 按原始顺序回填结果，前端拿到的 items 顺序和上传的文件顺序一致
  const items: UploadItemResult[] = new Array(request.files.length);
  for (const { item, result } of outcome.succeeded) items[item.index] = result;
  for (const { item, error } of outcome.failed) {
    console.warn(`[import/upload] 第 ${item.index + 1} 个文件处理失败（意外错误）`, error);
    items[item.index] = {
      name: fallbackName(item.raw, item.index),
      status: "rejected",
      reason: `处理失败：${describeError(error)}`,
    };
  }

  return { batch_id: batchId, items };
}

/** 整批合计检查：超过 3MB 直接 413，提示前端按批次切开（SPEC 5.3 的 GUI 约定） */
function assertBatchWithinLimit(files: unknown[]): void {
  let total = 0;
  for (const raw of files) {
    const base64 = readStringField(raw, "data_base64") ?? "";
    total += estimateBase64DecodedBytes(base64);
  }
  if (total > MAX_BATCH_BYTES) {
    throw new BatchTooLargeError(
      `本批文件合计约 ${formatBytes(total)}，超过单请求上限 ${formatBytes(MAX_BATCH_BYTES)}；` +
        `请把文件按每批 3MB 左右拆开分多次上传（每个批次的结果单独展示、失败的可以单独重试）`
    );
  }
}

async function processUploadedFile(raw: unknown, index: number): Promise<UploadItemResult> {
  const displayName = fallbackName(raw, index);
  try {
    const extension = assertAllowedExtension(displayName);
    const dataBase64 = readStringField(raw, "data_base64");
    if (dataBase64 === null) {
      throw new ImportRequestError("缺少 data_base64（文件内容没有传上来）");
    }

    const content = decodeBase64File(dataBase64);
    if (content.length > MAX_FILE_BYTES) {
      throw new ImportRequestError(
        `文件 ${formatBytes(content.length)}，超过单文件上限 ${formatBytes(MAX_FILE_BYTES)}`
      );
    }
    const magicError = checkMagicBytes(extension, content);
    if (magicError) throw new ImportRequestError(magicError);

    const fileHash = createHash("sha256").update(content).digest("hex");

    // 第 4 步：已存在直接返回 duplicate，不再解析/重复上传
    const existing = await findDocumentByHash(fileHash);
    if (existing) {
      return {
        name: displayName,
        status: "duplicate",
        id: existing.id,
        detected_type: existing.detected_type,
      };
    }

    // 第 5 步：解析文本 + 按内容识别类型（读不出内容的标 unreadable，仍然入库待人工处理）
    const parsed = await extractAttachmentText(displayName, content);
    const detectedType = parsed.status === "ok" ? identifyDocumentType(parsed.text) : "UNKNOWN";

    const safeName = sanitizeFileName(displayName);
    const storagePath = storagePathFor(fileHash, safeName);
    const contentType = detectContentType(extension);

    // 第 6 步：先存原文件再落库；落库失败时补偿删除，避免 Storage 留孤儿文件
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
        parse_error: parsed.status === "ok" ? null : (parsed.error ?? "解析失败（原因未知）"),
        extracted_text: parsed.status === "ok" ? parsed.text : null,
        detected_type: detectedType,
        review_status: detectedType === "UNKNOWN" ? "pending" : "filed",
        uploaded_by: UPLOADED_BY,
      });
    } catch (err) {
      await removeStoredFile(storagePath);
      throw new Error(
        `原文件已上传到 Storage，但写入文档记录失败，已回滚删除原文件：${describeError(err)}`
      );
    }

    if (!row) {
      // 并发竞态：解析期间另一个请求插入了同一个 hash。路径按 hash 生成、内容相同，
      // 不删原文件（对方的记录指向它），按 duplicate 返回、不覆盖对方记录。
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
    throw err; // 意外错误交给并发层统一收集（上面对应位置有 console.warn，不静默吞）
  }
}

function fallbackName(raw: unknown, index: number): string {
  const name = readStringField(raw, "name");
  return name && name.trim() !== "" ? name.trim() : `第 ${index + 1} 个文件`;
}

function readStringField(raw: unknown, field: string): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = (raw as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
