/**
 * 上传校验链里的 import 专属部分（SPEC 第 5.2 节第 1~3 步 + Storage 路径）。
 * 通用的文件校验（扩展名/base64/魔数/文件名净化）已经挪到 lib/shared/file-validate.ts
 * （sandbox 模块新增后两边都要用，见该文件头注释）；这里只做 import 自己的适配：
 * 用 import 的 ALLOWED_EXTENSIONS/MAX_FILE_NAME_LENGTH，把 FileValidationError
 * 转成 ImportRequestError，保持这个模块对外的错误类型不变。
 */
import {
  assertAllowedExtension as assertAllowedExtensionGeneric,
  checkMagicBytes as checkMagicBytesGeneric,
  decodeBase64File as decodeBase64FileGeneric,
  estimateBase64DecodedBytes,
  extensionOf,
  FileValidationError,
  formatBytes,
  sanitizeFileName as sanitizeFileNameGeneric,
} from "@/lib/shared/file-validate";
import { ImportRequestError } from "./errors";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_NAME_LENGTH,
  type AllowedExtension,
} from "./types";

export { extensionOf, estimateBase64DecodedBytes, formatBytes };

const CONTENT_TYPES: Record<AllowedExtension, string> = {
  txt: "text/plain",
  md: "text/markdown",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** 把通用校验的 FileValidationError 转成本模块对外一直在用的 ImportRequestError */
function asImportError<T>(fn: () => T): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof FileValidationError) throw new ImportRequestError(err.message);
    throw err;
  }
}

export function assertAllowedExtension(name: string): AllowedExtension {
  return asImportError(() => assertAllowedExtensionGeneric(name, ALLOWED_EXTENSIONS)) as AllowedExtension;
}

export function decodeBase64File(dataBase64: string): Buffer {
  return asImportError(() => decodeBase64FileGeneric(dataBase64));
}

export function checkMagicBytes(extension: AllowedExtension, content: Buffer): string | null {
  return checkMagicBytesGeneric(extension, content);
}

export function sanitizeFileName(name: string): string {
  return sanitizeFileNameGeneric(name, MAX_FILE_NAME_LENGTH);
}

/** Storage 路径：documents/<sha256前2位>/<sha256>/<净化后的文件名>（SPEC 5.1） */
export function storagePathFor(fileHash: string, safeName: string): string {
  return `documents/${fileHash.slice(0, 2)}/${fileHash}/${safeName}`;
}

/** Storage 的 content type 以扩展名/魔数推出，不采用客户端声明的 mime */
export function detectContentType(extension: AllowedExtension): string {
  return CONTENT_TYPES[extension];
}
