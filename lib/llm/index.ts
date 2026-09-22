/**
 * The unified multi-LLM call layer (see "Multi-LLM Support" in CLAUDE.md).
 * Every feature module's logic/ should only import callLLM from this file — don't import a
 * specific LLM's SDK directly inside a feature module.
 *
 * This is a shared-area file; confirm with the operator before making changes.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { generateText, type LanguageModel } from "ai";
import { isJevAvailable } from "./jev";
import { isTimeoutError, LLMConfigError, UpstreamServiceError } from "./errors";

// The single authoritative list of providers — both the type and the runtime validation are derived from here, don't start a second copy elsewhere
export const LLM_PROVIDER_IDS = [
  "claude",
  "openai",
  "deepseek",
  "gemini",
  "lmstudio",
  "jev",
] as const;

export type LLMProvider = (typeof LLM_PROVIDER_IDS)[number];

/**
 * Text-generation providers (for scenarios like extraction that "write out a piece of text").
 * jev is a structured decision model that doesn't generate text, so it's excluded; `as const
 * satisfies` guarantees this stays a subset of LLM_PROVIDER_IDS while preserving the literal
 * types (needed by z.enum(TEXT_PROVIDER_IDS)).
 */
export const TEXT_PROVIDER_IDS = [
  "claude",
  "openai",
  "deepseek",
  "gemini",
  "lmstudio",
] as const satisfies readonly LLMProvider[];

export type TextLLMProvider = (typeof TEXT_PROVIDER_IDS)[number];

// Validates whether an arbitrary input is a legal provider (used when the API/MCP route parses a request)
export function isLLMProvider(value: unknown): value is LLMProvider {
  return typeof value === "string" && (LLM_PROVIDER_IDS as readonly string[]).includes(value);
}

// Validates whether an arbitrary input is a "provider that can write text" (used by extraction's REST/MCP)
export function isTextProvider(value: unknown): value is TextLLMProvider {
  return typeof value === "string" && (TEXT_PROVIDER_IDS as readonly string[]).includes(value);
}

/** Timeout for a single call, in milliseconds: fail fast when upstream is stuck (see the performance review) */
const LLM_CALL_TIMEOUT_MS = 20_000;

/**
 * Retry delay (in milliseconds) for automatic retries on timeouts/transient errors. P1-2
 * (2026-09-21): only retries once, and only for errors that are likely just "temporary
 * jitter this time" (timeout/rate-limited/upstream 5xx/network error); errors like
 * 401/403/400/422, where "retrying wouldn't help anyway", fail immediately without a retry.
 * This retry layer only happens within a single provider — it doesn't affect or replace the
 * "switch to the next provider" degradation chain in lib/shared/llm-chain.ts. The two stack:
 * first retry once within this provider, and only move on to the next provider in the
 * degradation chain if that retry also fails.
 */
const RETRY_DELAY_MS = 2_000;

function isRetryableUpstreamError(err: UpstreamServiceError): boolean {
  return (
    err.code === "timeout" ||
    err.code === "rate_limited" ||
    err.code === "upstream_error" ||
    err.code === "network_error"
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const LLM_PROVIDERS: { id: LLMProvider; label: string; cloudOnly: boolean }[] = [
  { id: "claude", label: "Claude (Anthropic)", cloudOnly: false },
  { id: "openai", label: "ChatGPT (OpenAI)", cloudOnly: false },
  { id: "deepseek", label: "DeepSeek", cloudOnly: false },
  { id: "gemini", label: "Gemini (Google)", cloudOnly: false },
  { id: "lmstudio", label: "Local LM Studio", cloudOnly: true }, // cloudOnly=true is a somewhat counterintuitive name here: it actually means "only usable in a non-cloud environment" — see isLocalLLMAvailable below
  { id: "jev", label: "Jev (TypeSafe structured decisions)", cloudOnly: false }, // Can only make structured judgments, doesn't support text generation, see lib/llm/jev.ts
];

// Whether we're currently running on Vercel's cloud — Vercel sets this environment variable automatically
function isRunningOnVercel(): boolean {
  return process.env.VERCEL === "1";
}

// Local LM Studio is only available when this isn't a Vercel cloud deployment (see the note
// in CLAUDE.md: Vercel's servers can't reach an LM Studio instance running on the operator's
// own machine)
export function isLocalLLMAvailable(): boolean {
  return !isRunningOnVercel();
}

/**
 * The environment variable name for each provider (hardcoded, kept in sync with .env.example).
 * LM Studio doesn't need a key (it's gated by "is this Vercel cloud" instead), and Jev uses
 * TYPESAFE_API_KEY, handled separately.
 */
const PROVIDER_KEY_ENV_VARS: Record<Exclude<LLMProvider, "lmstudio" | "jev">, string> = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
};

/**
 * Whether this provider is currently usable (whether its key is fully configured).
 *
 * Environment variables don't change once the process has started, so this reads them
 * directly with no caching (the conventions forbid module-level mutable state).
 * Note: LM Studio doesn't need an apiKey — it just needs to be a local/Docker environment to
 * be considered ready; Jev uses isJevAvailable() (TYPESAFE_API_KEY), to avoid writing this
 * check in two places.
 */
export function isProviderConfigured(provider: LLMProvider): boolean {
  if (provider === "lmstudio") return isLocalLLMAvailable();
  if (provider === "jev") return isJevAvailable();
  return Boolean(process.env[PROVIDER_KEY_ENV_VARS[provider]]);
}

/**
 * The safe fallback order for text models (added 2026-09-21, P0-2, see DECISION_LOG decision 25):
 * the preferred provider (if explicitly passed in) comes first, the rest fill in behind it in
 * a fixed order; only ones with a key currently configured are kept.
 * gemini is first because it's this project's demo fallback (see CLAUDE.md); lmstudio is only
 * available locally.
 * Computed fresh on every use, with no module-level caching (the conventions forbid
 * module-level mutable state; environment variables don't change within a process anyway).
 */
const TEXT_FALLBACK_ORDER: readonly TextLLMProvider[] = [
  "gemini",
  "deepseek",
  "openai",
  "claude",
  "lmstudio",
];

export function orderedTextProviders(preferred?: LLMProvider): TextLLMProvider[] {
  const ordered = [...TEXT_FALLBACK_ORDER];
  if (preferred && preferred !== "jev") {
    const index = ordered.indexOf(preferred as TextLLMProvider);
    if (index >= 0) {
      ordered.splice(index, 1);
      ordered.unshift(preferred as TextLLMProvider);
    }
  }
  return ordered.filter((provider) => isProviderConfigured(provider));
}

/** A readable explanation for the user when a provider is unavailable (including which environment variable to configure) */
function unavailableProviderMessage(provider: LLMProvider): string {
  switch (provider) {
    case "lmstudio":
      return "Local LM Studio can only be used in local/Docker deployment mode; the current deployment environment (Vercel) doesn't support it — please switch to a different provider";
    case "jev":
      return "Missing the TYPESAFE_API_KEY environment variable, cannot call Jev. Please configure this variable in .env.local or on the deployment platform, or switch to a different provider";
    default:
      return `Provider "${provider}" is currently unavailable: the environment variable ${PROVIDER_KEY_ENV_VARS[provider]} is missing (or not configured on the deployment platform). Please add it in .env.local / the deployment platform and try again, or switch to a provider that's already configured`;
  }
}

function getModel(provider: LLMProvider): LanguageModel {
  switch (provider) {
    case "claude":
      // Follow Anthropic's official docs for the model name; using a currently available model here — if the AI writing this code needs to, verify the latest name itself
      return anthropic("claude-sonnet-4-5");
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })("gpt-4o-mini");
    case "deepseek":
      // DeepSeek's API is OpenAI-protocol-compatible, so we reuse the openai provider and just swap the baseURL + apiKey
      return createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com/v1",
      })("deepseek-chat");
    case "gemini":
      // gemini-2.0-flash has been deprecated by Google; the API's error response explicitly recommends switching to gemini-3.6-flash
      return google("gemini-3.6-flash");
    case "lmstudio":
      if (!isLocalLLMAvailable()) {
        throw new Error(
          "Local LM Studio can only be used in local/Docker deployment mode; the current deployment environment (Vercel) doesn't support it — please switch to a different provider"
        );
      }
      // LM Studio is also OpenAI-protocol-compatible; running it locally doesn't need a real apiKey
      return createOpenAI({
        apiKey: "lm-studio",
        baseURL: process.env.LM_STUDIO_BASE_URL || "http://localhost:1234/v1",
      })("local-model");
    case "jev":
      // Jev is a structured decision model and doesn't go through the text-generation path; raise a readable error proactively instead of letting the SDK throw a confusing type error
      throw new Error(
        "Jev only supports structured decisions (classification/comparison), not text generation/extraction. Use lib/llm's callJev() instead, or switch to a text-generation LLM provider."
      );
  }
}

/**
 * The unified LLM call entry point. Every module should call LLMs through this function —
 * don't use an SDK directly on your own.
 * Follows the "debugging convention": an external call failure must be perceptible to the
 * caller (throw a meaningful error), never swallowed silently here.
 *
 * Failure convention (2026-09-20 reliability/security review; 2026-09-21 P1-2 added automatic retry):
 * - No key configured locally -> LLMConfigError (readable, includes the environment variable
 *   name), no retry (retrying a configuration problem wouldn't help)
 * - Upstream timeout/rate-limit/5xx/network error -> wait `RETRY_DELAY_MS` and retry once
 *   as-is; only throw UpstreamServiceError if it still fails (message only contains provider +
 *   status + a stable code; the raw error detail only goes to console.warn, never appended
 *   into the message or passed through as-is)
 * - Deterministic errors like 401/403/400/422 -> no retry, thrown immediately
 */
export async function callLLM(
  provider: LLMProvider,
  prompt: string,
  options?: { system?: string }
): Promise<string> {
  if (!isProviderConfigured(provider)) {
    throw new LLMConfigError(unavailableProviderMessage(provider));
  }
  const model = getModel(provider);

  const attemptOnce = async (): Promise<string> => {
    const { text } = await generateText({
      model,
      system: options?.system,
      prompt,
      // A single call times out after 20s: don't let the whole request hang when upstream is stuck
      abortSignal: AbortSignal.timeout(LLM_CALL_TIMEOUT_MS),
    });
    return text;
  };

  try {
    return await attemptOnce();
  } catch (firstErr) {
    const firstUpstreamErr = toUpstreamServiceError(provider, firstErr);
    if (!isRetryableUpstreamError(firstUpstreamErr)) {
      throw firstUpstreamErr;
    }
    console.warn(
      `[llm] The first call to ${provider} failed (${firstUpstreamErr.code}), retrying once after ${RETRY_DELAY_MS}ms`
    );
    await delay(RETRY_DELAY_MS);
    try {
      return await attemptOnce();
    } catch (secondErr) {
      throw toUpstreamServiceError(provider, secondErr);
    }
  }
}

function toUpstreamServiceError(provider: LLMProvider, err: unknown): UpstreamServiceError {
  const detail = err instanceof Error ? err.message : String(err);
  console.warn(`[llm] Call to ${provider} failed (raw details only go to the server log): ${detail}`);

  if (isTimeoutError(err)) {
    return new UpstreamServiceError({ provider, status: 504, code: "timeout" });
  }
  const statusCode = (err as { statusCode?: unknown }).statusCode;
  if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
    return new UpstreamServiceError({
      provider,
      status: statusCode,
      code: upstreamCodeOf(statusCode),
    });
  }
  return new UpstreamServiceError({ provider, status: 502, code: "network_error" });
}

function upstreamCodeOf(statusCode: number): string {
  if (statusCode === 401 || statusCode === 403) return "unauthorized";
  if (statusCode === 429) return "rate_limited";
  if (statusCode === 400 || statusCode === 422) return "invalid_request";
  if (statusCode >= 500) return "upstream_error";
  return "http_error";
}

// The Jev (TypeSafe System One) adapter layer: a capability parallel to callLLM, not the same
// thing. Use callJev when you need "the model to make a judgment among fixed options"; use
// callLLM when you need "a piece of text written out".
export {
  callJev,
  isJevAvailable,
  type JevAnswer,
  type JevChoiceAnswer,
  type JevNoulAnswer,
  type JevQuestion,
  type JevResponse,
  type JevScoreAnswer,
  type JevState,
} from "./jev";

// Readable error types for the LLM layer: used by the REST/MCP error-mapping layer (see lib/shared/request-errors.ts)
export {
  LLMConfigError,
  UpstreamServiceError,
  isTimeoutError,
  type UpstreamServiceErrorInfo,
} from "./errors";
