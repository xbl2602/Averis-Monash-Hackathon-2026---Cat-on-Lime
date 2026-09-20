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
  429: "Too many requests right now. Wait a moment and try again.",
  503: "A service or API key this step depends on is not configured on this server. Try another model.",
};

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
