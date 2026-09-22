/**
 * Adapter layer for TypeSafe's "System One" structured decision model, Jev (see "Multi-LLM
 * Support" in CLAUDE.md).
 *
 * It's different from a normal LLM: the input is a state (the material to judge) + a set of
 * typed questions, and the output is a structured answer with calibrated probabilities —
 * **it never generates any free text**. So it can't go through callLLM; it must be called via
 * the callJev exposed here. Official docs: https://docs.typesafe.ai/api
 *
 * Jev is suited to "making a judgment call in code" (classification / routing / whether
 * individual fields match), not to extraction tasks that need to produce written text — those
 * should keep using callLLM.
 */
import { isTimeoutError, LLMConfigError, UpstreamServiceError } from "./errors";

export type JevQuestion =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
  | { type: "score"; instructions: string; criteria: string[] };

export interface JevNoulAnswer {
  type: "noul";
  noul: number; // 0 to 1, the probability of answering "yes" — there's no separate confidence field
}

export interface JevChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number; // 0 to 1, confidence computed from the probability distribution
}

export interface JevScoreAnswer {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer;

export interface JevResponse {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export type JevState = string | Record<string, unknown> | unknown[];

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_JEV_MODEL = "jev-latest";
/**
 * A single call times out after 20s (same as callLLM); on timeout/failure it fails outright
 * with no retry here — when Jev fails, the caller (the hybrid engine in
 * classification/comparison) goes straight to the next degradation path (see DECISION_LOG
 * decision 25). This is a different failure-handling strategy from callLLM's internal
 * "retry once within the same provider" — the two don't conflict.
 */
const JEV_TIMEOUT_MS = 20_000;

// Whether TYPESAFE_API_KEY is configured — the UI/logic can use this to decide whether to let the user pick Jev
export function isJevAvailable(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

// Translates an HTTP status code into something an operator can understand (see the error-handling requirements in the "Code Quality Red Lines" section of CLAUDE.md)
function explainJevStatus(status: number): string {
  switch (status) {
    case 401:
      return " (the API key is missing or invalid, check TYPESAFE_API_KEY)";
    case 422:
      return " (the request body is invalid, usually the state or questions structure is wrong)";
    case 429:
      return " (rate limit exceeded, retry later or lower the batch concurrency)";
    case 529:
      return " (the TypeSafe service is temporarily overloaded, retry later)";
    default:
      return "";
  }
}

/**
 * The unified call to Jev. Follows the "debugging convention": an external call failure must
 * throw a meaningful, readable error — never swallowed silently here, and never blindly retried.
 *
 * Failure convention (2026-09-20 reliability/security review):
 * - TYPESAFE_API_KEY not configured -> LLMConfigError (readable, includes the variable name)
 * - Network error/timeout/non-2xx upstream -> UpstreamServiceError (message only contains
 *   provider + status + code)
 *   The upstream response body only goes to console.warn — it's never appended to the message
 *   or returned to the caller
 */
export async function callJev(
  state: JevState,
  questions: Record<string, JevQuestion>
): Promise<JevResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new LLMConfigError(
      "Missing the TYPESAFE_API_KEY environment variable, cannot call Jev. Please configure this variable in .env.local or on the deployment platform, or switch to a different provider."
    );
  }

  const model = process.env.JEV_MODEL || DEFAULT_JEV_MODEL;

  let response: Response;
  try {
    response = await fetch(TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state, model, questions }),
      signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
    });
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new UpstreamServiceError({ provider: "jev", status: 504, code: "timeout" });
    }
    console.warn(
      `[jev] Network error (raw details only go to the server log): ${err instanceof Error ? err.message : String(err)}`
    );
    throw new UpstreamServiceError({ provider: "jev", status: 502, code: "network_error" });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // The upstream response body only goes to the server log, never appended into message / returned to the caller
    console.warn(
      `[jev] HTTP ${response.status}${explainJevStatus(response.status)}${
        detail ? `: ${detail.slice(0, 500)}` : ""
      }`
    );
    throw new UpstreamServiceError({
      provider: "jev",
      status: response.status,
      code: explainJevCode(response.status),
    });
  }

  try {
    return (await response.json()) as JevResponse;
  } catch (err) {
    // 200 but the response body isn't valid JSON (a gateway error page/truncated response/etc.):
    // normalized the same way as other upstream failures — raw details only go to the server
    // log, never appended into message / returned to the caller
    console.warn(
      `[jev] The response body isn't valid JSON (raw details only go to the server log): ${err instanceof Error ? err.message : String(err)}`
    );
    throw new UpstreamServiceError({ provider: "jev", status: 502, code: "invalid_response" });
  }
}

// Stable short codes for UpstreamServiceError (the part that's safe to return to the client)
function explainJevCode(status: number): string {
  switch (status) {
    case 401:
      return "unauthorized";
    case 422:
      return "invalid_request";
    case 429:
      return "rate_limited";
    case 529:
      return "overloaded";
    default:
      return "http_error";
  }
}
