/** The two expected error types for the batch entry point (mapping to HTTP 400 / 503).
 * name is set explicitly: MCP/request error mapping matches on the stable name (see lib/shared/request-errors.ts),
 * so these can be recognized without importing the feature's error classes. */

export class BatchRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchRequestError";
  }
}

export class StoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreUnavailableError";
  }
}
