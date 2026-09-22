/**
 * Two kinds of readable error for the LLM layer (REST/MCP map these to 503/429/502/504
 * accordingly, without passing the upstream's raw text to the client).
 *
 * - LLMConfigError: no key configured locally / the provider isn't available in this
 *   environment (HTTP 503).
 *   message is a readable, self-constructed string (includes the provider name and the
 *   environment variable name) and can be displayed directly.
 * - UpstreamServiceError: the upstream service returned an error or timed out (HTTP 429/502/504).
 *   message is always the fixed template of provider + status + a stable code; the raw SDK
 *   error text and the upstream response body must **never** be appended into message — those
 *   are only allowed to go into console.warn (see lib/llm/index.ts, jev.ts).
 */

export class LLMConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMConfigError";
  }
}

export interface UpstreamServiceErrorInfo {
  provider: string;
  /** The upstream HTTP status code; a local timeout is always represented as 504 */
  status: number;
  /** A stable short code: rate_limited / unauthorized / invalid_request / overloaded / timeout / network_error / invalid_response / http_error */
  code: string;
}

export class UpstreamServiceError extends Error {
  readonly provider: string;
  readonly status: number;
  readonly code: string;

  constructor(info: UpstreamServiceErrorInfo) {
    super(
      `Upstream service (${info.provider}) returned ${info.status} (${info.code}); please retry later. ` +
        `If it keeps failing, check whether that provider's API key is valid`
    );
    this.name = "UpstreamServiceError";
    this.provider = info.provider;
    this.status = info.status;
    this.code = info.code;
  }
}

/**
 * Determines whether an exception represents a "call timeout".
 * The DOMException thrown by AbortSignal.timeout is named TimeoutError; different SDKs may
 * wrap it inside a cause chain, so this looks two extra levels deep into `cause`. This
 * function is only responsible for "deciding whether it's a timeout" — whether to retry is
 * decided by the caller (`callLLM` in `lib/llm/index.ts`) — as of 2026-09-21, a timeout is
 * automatically retried once (see that file).
 */
export function isTimeoutError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 3 && current instanceof Error; depth += 1) {
    if (current.name === "TimeoutError" || current.name === "AbortError") return true;
    const code = (current as { code?: unknown }).code;
    if (code === "ETIMEDOUT" || code === "ABORT_ERR") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
