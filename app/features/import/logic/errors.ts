/**
 * Error types for the import feature: the api layer maps these to HTTP status codes (see api/params.ts).
 * All carry a readable message rather than an error-code string.
 * name is set explicitly: MCP/request error mapping matches on the stable name (see lib/shared/request-errors.ts).
 */

/** Invalid request parameters/content -> 400 */
export class ImportRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportRequestError";
  }
}

/** Total request size exceeds the 3MB cap -> 413 (tells the frontend to upload in batches) */
export class BatchTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchTooLargeError";
  }
}

/** Document id doesn't exist -> 404 */
export class DocumentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentNotFoundError";
  }
}

/** Optimistic lock conflict: the record was changed elsewhere -> 409 */
export class DocumentConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentConflictError";
  }
}

/** Storage-layer issue such as Supabase being unreachable/write failing -> 503 */
export class DocumentStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentStoreError";
  }
}
