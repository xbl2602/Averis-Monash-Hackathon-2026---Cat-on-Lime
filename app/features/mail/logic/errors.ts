/**
 * Error classification for the mail module (api/params.ts maps these to HTTP status codes by type, see PHASE2_SPEC section 1).
 * name is set explicitly: MCP/request error mapping matches on the stable name (see lib/shared/request-errors.ts).
 */

/** Invalid request parameters (missing field, wrong format, target doesn't exist) -> HTTP 400 */
export class MailRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailRequestError";
  }
}

/** Target resource doesn't exist (e.g. no row found for the project id to deactivate) -> HTTP 404; extends MailRequestError to reuse the upstream catch */
export class MailNotFoundError extends MailRequestError {
  constructor(message: string) {
    super(message);
    this.name = "MailNotFoundError";
  }
}

/** Mail-related data tables can't be read/written (missing Supabase service key, table not created, connection failure) -> HTTP 503 */
export class MailStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailStoreUnavailableError";
  }
}

/** A Supabase call returned an error (wrong table structure, network failure, etc.) -> HTTP 500 */
export class MailDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailDataError";
  }
}
