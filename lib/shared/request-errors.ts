/**
 * Unified mapping of request errors (shared by the three single-document REST routes and the
 * MCP aggregation layer).
 *
 * Goal: give the client an error it can understand, without leaking the server/upstream's raw
 * original text.
 * - Known error classes (already readable English text at construction time) -> returned as-is
 * - LLMConfigError -> 503 (the message text explains which environment variable is missing)
 * - UpstreamServiceError -> 429 / 502 / 504 (message only contains provider + status + stable code)
 * - Any other unknown error -> fixed 500 text; the raw error only goes into the server log
 *
 * Layering constraint: this file **must not import any feature's error classes**; feature
 * errors are matched by their stable err.name instead. This means every feature error class
 * must explicitly set this.name at construction time (see errors.ts in pipeline/import/mail).
 */
import { LLMConfigError, UpstreamServiceError } from "@/lib/llm/errors";

export interface ClientError {
  status: number;
  message: string;
}

/** Known readable error class name -> HTTP status (kept consistent with each feature's own api mapping) */
const KNOWN_ERROR_STATUS: Record<string, number> = {
  BatchRequestError: 400,
  StoreUnavailableError: 503,
  SampleDataPathError: 400,
  SampleNotFoundError: 404,
  ResultQueryError: 400,
  DataAccessError: 503,
  ImportRequestError: 400,
  BatchTooLargeError: 413,
  DocumentNotFoundError: 404,
  DocumentConflictError: 409,
  DocumentStoreError: 503,
  MailRequestError: 400,
  MailNotFoundError: 404,
  MailStoreUnavailableError: 503,
  MailDataError: 500,
  ReviewRequestError: 400,
  ReviewConsistencyError: 400,
  ReviewNotFoundError: 404,
  ReviewConflictError: 409,
  ReviewStoreUnavailableError: 503,
  SandboxRequestError: 400,
  SandboxFileTooLargeError: 413,
  FileValidationError: 400,
  DevModeRequestError: 400,
};

export const INTERNAL_ERROR_MESSAGE = "Internal error (see server logs for details)";

/** Maps an exception to a status code + readable message for the HTTP client (used by REST) */
export function toClientError(err: unknown): ClientError {
  if (err instanceof LLMConfigError) {
    return { status: 503, message: err.message };
  }
  if (err instanceof UpstreamServiceError) {
    return { status: upstreamStatus(err), message: err.message };
  }
  if (err instanceof Error) {
    const status = KNOWN_ERROR_STATUS[err.name];
    if (status !== undefined) return { status, message: err.message };
    if (isNotFoundFsError(err)) {
      return { status: 404, message: "Could not find the corresponding sample file" };
    }
  }
  console.error("[request-errors] Unexpected error:", err);
  return { status: 500, message: INTERNAL_ERROR_MESSAGE };
}

/**
 * Lets MCP's runTool use the same allowlist to decide "whether the message can be passed
 * back to the caller".
 * Unknown errors always get the fixed text (the original err is still console.error'd by the
 * caller, but never enters the response).
 */
export function safeErrorMessage(err: unknown): string {
  if (err instanceof LLMConfigError || err instanceof UpstreamServiceError) {
    return err.message;
  }
  if (err instanceof Error && KNOWN_ERROR_STATUS[err.name] !== undefined) {
    return err.message;
  }
  return INTERNAL_ERROR_MESSAGE;
}

function upstreamStatus(err: UpstreamServiceError): number {
  if (err.status === 429) return 429; // Rate limiting: preserve 429 semantics, hint to retry later
  if (err.status === 401 || err.status === 403) return 502; // Upstream rejected the request (key may be invalid)
  if (err.status === 504 || err.code === "timeout") return 504; // Timeout
  return 502;
}

function isNotFoundFsError(err: Error): boolean {
  return (err as NodeJS.ErrnoException).code === "ENOENT";
}
