/**
 * Readable error types for the review loop (REST/MCP map these to status codes accordingly;
 * see lib/shared/request-errors.ts).
 * Naming follows the same convention as every other feature's errors.ts: this.name is set
 * explicitly at construction time, so request-errors.ts can match on the stable err.name
 * without importing this file.
 */
export class ReviewRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewRequestError";
  }
}

export class ReviewNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewNotFoundError";
  }
}

export class ReviewConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewConflictError";
  }
}

export class ReviewStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewStoreUnavailableError";
  }
}
