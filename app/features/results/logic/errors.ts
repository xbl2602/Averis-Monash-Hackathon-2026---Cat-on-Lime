/**
 * The two expected error types in the results module:
 * - ResultQueryError: invalid query parameters (HTTP 400 / MCP returns a readable error)
 * - DataAccessError: failed to read from Supabase (HTTP 503)
 * Any other unexpected error is caught as a 500 by each transport layer — not swallowed here.
 */

export class ResultQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResultQueryError";
  }
}

export class DataAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataAccessError";
  }
}
