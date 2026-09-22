/**
 * Model-call-level caching (see the "cache design" in DECISION_LOG / the engine design docs):
 * - Key = sha256(purpose + version + provider + model + the actual content sent)
 *   "The actual content sent" means the complete input actually sent to the model (if
 *   truncation is ever added, the truncated version becomes part of the fingerprint — any
 *   change in content changes the fingerprint, so an old result is never mismatched against
 *   new content) — this avoids "cache truncation" style bugs
 * - The cache stores the complete response, never a partial one; different
 *   emails/documents can never collide on the key (their input fingerprints differ) — this
 *   avoids cross-context contamination
 * - Writes use upsert, which is concurrency-safe
 * - When SUPABASE_SERVICE_ROLE_KEY isn't configured, this automatically degrades to "call
 *   directly, no caching", without affecting the main flow
 */
import { createHash } from "node:crypto";
import { getSupabaseServiceClient, isSupabaseServiceAvailable } from "./supabase";

// Bump this by hand whenever the engine logic (prompt/rules/thresholds/model) changes substantively, to auto-invalidate old cache entries
export const LLM_CACHE_VERSION = "v1";

export interface CallWithCacheOptions<T> {
  /** Purpose label, e.g. "classification" / "extraction_llm" / "field_equivalence" */
  purpose: string;
  provider: string;
  model: string;
  /** The complete content actually sent to the model this time (used for fingerprinting and reconciliation during debugging) */
  request: unknown;
  /** Invoked to actually make the call on a cache miss */
  execute: () => Promise<T>;
}

export interface CallWithCacheResult<T> {
  value: T;
  cached: boolean;
}

export async function callWithCache<T>(
  options: CallWithCacheOptions<T>
): Promise<CallWithCacheResult<T>> {
  if (!isSupabaseServiceAvailable()) {
    // No service key: don't cache, call directly (so the main flow still works locally without a configured key)
    return { value: await options.execute(), cached: false };
  }

  const cacheKey = computeCacheKey(options);
  const supabase = getSupabaseServiceClient();

  try {
    const { data, error } = await supabase
      .from("llm_call_cache")
      .select("response_payload")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      await supabase
        .from("llm_call_cache")
        .update({ last_used_at: new Date().toISOString() })
        .eq("cache_key", cacheKey)
        .then(({ error: touchError }) => {
          if (touchError) console.warn("[llm-cache] Failed to update last_used_at:", touchError.message);
        });
      return { value: data.response_payload as T, cached: true };
    }
  } catch (err) {
    console.warn("[llm-cache] Failed to read from cache, falling back to a direct call:", err instanceof Error ? err.message : err);
  }

  const value = await options.execute();

  try {
    const { error } = await supabase.from("llm_call_cache").upsert(
      {
        cache_key: cacheKey,
        purpose: options.purpose,
        provider: options.provider,
        model: options.model,
        request_payload: options.request,
        response_payload: value,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" }
    );
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn("[llm-cache] Failed to write to cache (result is unaffected):", err instanceof Error ? err.message : err);
  }

  return { value, cached: false };
}

function computeCacheKey<T>(options: CallWithCacheOptions<T>): string {
  const payload = [
    options.purpose,
    LLM_CACHE_VERSION,
    options.provider,
    options.model,
    JSON.stringify(options.request),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}
