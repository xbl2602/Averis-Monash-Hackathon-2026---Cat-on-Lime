/**
 * Error types for the sandbox feature: the API layer maps these to HTTP status codes
 * (see lib/shared/request-errors.ts). name is set explicitly so the request-error mapping
 * can match on a stable name without importing the error classes across modules.
 */

/** Invalid request parameters/file content → 400 */
export class SandboxRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxRequestError";
  }
}

/** A single file exceeds the size limit → 413 */
export class SandboxFileTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxFileTooLargeError";
  }
}
