/**
 * Turns a failed API response into an English message for the user.
 * The server's own error text (which may be in another language or contain internals) is kept
 * separately as `detail` so it can be shown in a collapsed "technical detail" block, not as the headline.
 */
export interface ApiErrorInfo {
  message: string;
  detail?: string;
}

const MESSAGES: Record<number, string> = {
  400: "The request was not accepted. Check the values you entered and try again.",
  401: "This action needs an admin token, and none was accepted.",
  403: "This action is not enabled on this server.",
  404: "The requested item was not found.",
  409: "Someone else changed this item first. Reload it to see the latest version, then try again.",
  413: "That upload is too large. Send fewer or smaller files at a time.",
  422: "The file could not be read. Check that it is a text, PDF, Word or Excel document with readable text.",
  429: "Too many requests right now. Wait a moment and try again.",
  503: "A service or API key this step depends on is not configured on this server. Try another model.",
};

/**
 * True when the failure means "no database is connected to this server" rather than a bad request,
 * so the screen can offer the set-up steps instead of a red error. Every module answers 503 for this
 * (the review queue was fixed to match in 2026-09-21); a 500 that names Supabase is kept as a safety net.
 */
export function isDatabaseUnavailable(status: number, body: unknown): boolean {
  if (status === 503) return true;
  const detail = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : "";
  return status === 500 && /supabase/i.test(detail);
}

export function describeApiError(status: number, body: unknown): ApiErrorInfo {
  const detail =
    body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
      ? (body as { error: string }).error
      : undefined;
  const message = MESSAGES[status] ?? "Something went wrong on the server. Please try again in a moment.";
  return { message, detail };
}

export function describeNetworkError(): ApiErrorInfo {
  return { message: "Could not reach the server. Check your connection and try again." };
}
