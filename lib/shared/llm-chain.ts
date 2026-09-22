/**
 * The unified call chain for "fall through text models one by one" (added 2026-09-21, the
 * shared layer for P0-2).
 *
 * Why we need it: the hybrid engine allows "if the preferred model fails, switch to the next
 * one", but caching, timeouts, and error wrapping all need to stay exactly consistent with
 * the single-model path — this layer collects those details in one place so feature modules
 * don't each have to write their own copy of the loop.
 *
 * Conventions:
 * - The order comes from lib/llm's orderedTextProviders() (preferred first, the rest in a
 *   fixed order, only including ones with a configured key)
 * - Every attempt goes through callWithCache (cached separately per provider; failures are
 *   never cached)
 * - A single failed attempt is only logged server-side before moving on to the next one; only
 *   once every provider has failed do we throw a readable summary error
 * - This is only for the "hybrid engine" path; the dedicated endpoints where the user
 *   explicitly picks a provider must keep "whichever one you pick is the only one that's
 *   tried" — they must never silently swap in a different model just to make it look like it
 *   succeeded (that's the "faking success" red line mentioned elsewhere)
 */
import { callLLM, orderedTextProviders, type LLMProvider, type TextLLMProvider } from "@/lib/llm";
import { callWithCache } from "./llm-cache";

export interface TextChainResult {
  text: string;
  /** The provider that actually produced the result (may not be the preferred one) */
  provider: TextLLMProvider;
}

export interface TextChainOptions {
  /** Purpose label, used in the cache key and for debugging logs, e.g. "classification_llm" / "document_identify" */
  purpose: string;
  prompt: string;
  /** The preferred provider (an explicitly passed-in one is tried first); if omitted, the default order is used (starting with gemini) */
  preferred?: LLMProvider;
  system?: string;
}

export async function callTextLLMChain(options: TextChainOptions): Promise<TextChainResult> {
  const providers = orderedTextProviders(options.preferred);
  if (providers.length === 0) {
    throw new Error(
      "No text model is available: no provider has an API key configured (configure at least one, e.g. GOOGLE_GENERATIVE_AI_API_KEY — see .env.example)"
    );
  }

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const { value } = await callWithCache({
        purpose: options.purpose,
        provider,
        model: provider,
        request: { prompt: options.prompt, system: options.system },
        execute: () =>
          callLLM(provider, options.prompt, options.system ? { system: options.system } : undefined),
      });
      return { text: value, provider };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[llm-chain] ${options.purpose}: ${provider} failed, trying the next one: ${message}`);
      failures.push(`${provider} (${message})`);
    }
  }

  throw new Error(`Every available text model failed: ${failures.join("; ")}`);
}
