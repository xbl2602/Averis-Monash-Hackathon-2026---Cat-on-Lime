/** The server accepts about 3 MB of files per request, so a big selection is sent as several requests. */
export const BATCH_LIMIT_BYTES = 2.8 * 1024 * 1024;
export const MAX_FILES_PER_BATCH = 50;
export const ALLOWED_EXTENSIONS = ["txt", "md", "pdf", "docx", "xlsx"];

export interface QueuedFile {
  id: string;
  file: File;
  /** A reason the file will not be sent (wrong type, too big, empty) */
  problem: string | null;
}

/** Judge a file before it is queued, using the same rules the server applies. */
export function problemWith(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `.${ext || "?"} is not supported`;
  if (file.size === 0) return "The file is empty";
  if (file.size > BATCH_LIMIT_BYTES) return "Over the 3 MB per-file limit";
  return null;
}

/** Greedy split that keeps each request under the size and count limits, preserving order. */
export function splitIntoBatches<T extends { file: File }>(items: T[]): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const item of items) {
    const overflow = bytes + item.file.size > BATCH_LIMIT_BYTES || current.length >= MAX_FILES_PER_BATCH;
    if (overflow && current.length > 0) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += item.file.size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
