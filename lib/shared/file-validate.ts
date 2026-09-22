/**
 * Common logic for validating uploaded files (originally only lived in the import module;
 * the P2 sandbox module needs the same validation, so it was pulled out into the shared
 * area). Touches neither the database nor the request object — pure functions, easy to reuse
 * and to unit test in isolation.
 *
 * All errors are thrown as FileValidationError (400 semantics); each caller wraps it in its
 * own error type as needed (e.g. the import module still throws ImportRequestError to the
 * outside world, keeping its existing external contract unchanged).
 */

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

/** Extracts the extension: only looks for the dot after the last path separator, so a name like "a.pdf/../x" can't confuse it */
export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

/** Validates the extension against an allowlist; throws FileValidationError if it isn't on the list */
export function assertAllowedExtension(name: string, allowedExtensions: readonly string[]): string {
  const extension = extensionOf(name);
  if (!allowedExtensions.includes(extension)) {
    throw new FileValidationError(
      `Unsupported file type ".${extension || "no extension"}": only ${allowedExtensions.map((e) => `.${e}`).join(" / ")} are allowed`
    );
  }
  return extension;
}

/**
 * base64 -> Buffer. Besides format validation, this also re-checks that "decoding then
 * re-encoding matches the input exactly": if the decoded result doesn't match what was
 * declared (non-standard padding/stray characters/altered length), it's rejected, to guard
 * against forgery.
 */
export function decodeBase64File(dataBase64: string): Buffer {
  const cleaned = dataBase64.replace(/\s+/g, "");
  if (cleaned === "") {
    throw new FileValidationError("data_base64 is empty (no file content was sent)");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    throw new FileValidationError("data_base64 is not valid base64 content");
  }
  const content = Buffer.from(cleaned, "base64");
  if (content.length === 0) {
    throw new FileValidationError("Decoding the base64 produced an empty file");
  }
  if (content.toString("base64") !== cleaned) {
    throw new FileValidationError("base64 round-trip validation failed (decoded content doesn't match what was declared), rejected");
  }
  return content;
}

/** Magic-byte validation (never trust the mime type the client sent — go by the file header/byte content instead); extensions other than pdf/docx/xlsx are checked as plain text */
export function checkMagicBytes(extension: string, content: Buffer): string | null {
  if (extension === "pdf") {
    return content.subarray(0, 4).toString("latin1") === "%PDF"
      ? null
      : "A PDF file must start with %PDF (this may be a fake PDF with a renamed extension)";
  }
  if (extension === "docx" || extension === "xlsx") {
    return isZipContainer(content)
      ? null
      : `${extension} is a ZIP container format and must start with PK (the file is corrupted or the extension doesn't match its content)`;
  }
  const badByte = findBinaryControlByte(content);
  return badByte === null
    ? null
    : `Found a binary control character in a text file (byte #${badByte + 1}) — this may be a binary file with a renamed extension`;
}

function isZipContainer(content: Buffer): boolean {
  return (
    content.length >= 4 &&
    content[0] === 0x50 &&
    content[1] === 0x4b &&
    content[2] === 0x03 &&
    content[3] === 0x04
  );
}

// The only control characters allowed in text are \t \n \r; every other control character below 0x20, plus DEL(0x7F), is treated as binary content
function findBinaryControlByte(content: Buffer): number | null {
  for (let i = 0; i < content.length; i++) {
    const byte = content[i];
    const isAllowedWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if ((byte < 0x20 && !isAllowedWhitespace) || byte === 0x7f) return i;
  }
  return null;
}

/**
 * Filename sanitization: strips path separators/control characters/characters reserved by
 * various OSes, to prevent path injection ("../", "\\"). Only used for the Storage path and
 * the display name stored in the database — it doesn't affect extension validation (that's
 * done against the original name).
 */
export function sanitizeFileName(name: string, maxLength: number): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  const safe = cleaned || "unnamed";
  return safe.length <= maxLength ? safe : truncateKeepingExtension(safe, maxLength);
}

function truncateKeepingExtension(name: string, maxLength: number): string {
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot) : "";
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const keep = Math.max(1, maxLength - extension.length);
  return `${stem.slice(0, keep)}${extension}`;
}

/** Estimates the number of bytes after base64 decoding (used for whole-batch size checks, to avoid decoding the whole batch twice) */
export function estimateBase64DecodedBytes(dataBase64: string): number {
  const cleaned = dataBase64.replace(/\s+/g, "");
  if (cleaned === "") return 0;
  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

/** Human-readable size, used in error messages */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
