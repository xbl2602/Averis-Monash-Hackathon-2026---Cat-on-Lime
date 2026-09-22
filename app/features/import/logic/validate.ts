/**
 * The import-specific part of the upload validation chain (SPEC section 5.2, steps 1-3 + Storage path).
 * The generic file validation (extension/base64/magic bytes/filename sanitization) has been moved to
 * lib/shared/file-validate.ts (needed by both sides once the sandbox module was added, see that file's
 * header comment); this file only handles import's own adaptation: using import's
 * ALLOWED_EXTENSIONS/MAX_FILE_NAME_LENGTH, and converting FileValidationError into
 * ImportRequestError so this module's external error type stays unchanged.
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

/** Convert the generic validator's FileValidationError into the ImportRequestError this module has always used externally */
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

/** Storage path: documents/<first 2 chars of sha256>/<sha256>/<sanitized filename> (SPEC 5.1) */
export function storagePathFor(fileHash: string, safeName: string): string {
  return `documents/${fileHash.slice(0, 2)}/${fileHash}/${safeName}`;
}

/** Storage's content type is inferred from the extension/magic bytes, not from the client-declared mime */
export function detectContentType(extension: AllowedExtension): string {
  return CONTENT_TYPES[extension];
}
