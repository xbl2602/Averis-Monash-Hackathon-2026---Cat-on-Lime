/**
 * Config test connection (Phase 2 SPEC section 3.3).
 * The server decrypts and makes one real call to the target service, returning only ok/detail — never leaking the key.
 */
import { resolveConfigValue } from "@/lib/shared/config-store";
import { getActiveSupabaseConfig } from "@/lib/shared/supabase";
import { isLocalLLMAvailable } from "@/lib/llm";

export type TestTarget = "claude" | "openai" | "deepseek" | "gemini" | "typesafe" | "supabase" | "lmstudio";

const KEY_BY_TARGET: Record<"claude" | "openai" | "deepseek" | "gemini", string> = {
  claude: "llm.anthropic_api_key",
  openai: "llm.openai_api_key",
  deepseek: "llm.deepseek_api_key",
  gemini: "llm.gemini_api_key",
};

export interface TestResult {
  ok: boolean;
  detail: string;
}

export async function testConnection(target: TestTarget): Promise<TestResult> {
  try {
    switch (target) {
      case "claude":
      case "openai":
      case "deepseek":
      case "gemini":
        return await testLlmKey(target);
      case "typesafe":
        return await testTypesafe();
      case "supabase":
        return await testSupabase();
      case "lmstudio":
        return testLmStudio();
    }
  } catch (err) {
    return { ok: false, detail: describeError(err) };
  }
}

// The "fetch failed" thrown by fetch carries no readable info by itself; include the underlying cause's code/message too (contains no secrets)
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: { code?: string; message?: string } }).cause;
  const suffix = cause?.code ?? cause?.message;
  return suffix ? `${err.message} (${suffix})` : err.message;
}

async function testLlmKey(target: "claude" | "openai" | "deepseek" | "gemini"): Promise<TestResult> {
  const key = (await resolveConfigValue(KEY_BY_TARGET[target])) as string | null;
  if (!key) {
    return { ok: false, detail: `No API key configured for ${target}; please fill it in before testing` };
  }

  // Use the "list models" endpoint for a minimal real call: no token cost, and it verifies the key is valid
  const endpoints: Record<"claude" | "openai" | "deepseek" | "gemini", { url: string; headers: Record<string, string> }> = {
    claude: {
      url: "https://api.anthropic.com/v1/models?limit=1",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    },
    openai: {
      url: "https://api.openai.com/v1/models?limit=1",
      headers: { Authorization: `Bearer ${key}` },
    },
    deepseek: {
      url: "https://api.deepseek.com/v1/models",
      headers: { Authorization: `Bearer ${key}` },
    },
    gemini: {
      url: `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`,
      headers: {},
    },
  };

  const { url, headers } = endpoints[target];
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (response.ok) return { ok: true, detail: `${target} key is valid, service is reachable` };
  if (response.status === 401 || response.status === 403) {
    return { ok: false, detail: `${target} rejected this key (HTTP ${response.status}); check whether it was mistyped or has expired` };
  }
  return { ok: false, detail: `${target} returned HTTP ${response.status}; please try again later` };
}

async function testTypesafe(): Promise<TestResult> {
  const key = (await resolveConfigValue("llm.typesafe_api_key")) as string | null;
  if (!key) return { ok: false, detail: "No API key configured for TypeSafe Jev" };
  // Send one real request with a minimal state+question to verify the key and endpoint
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      state: { probe: true },
      questions: { ok: { type: "noul", instructions: "This is a test request; answer yes." } },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (response.ok) return { ok: true, detail: "TypeSafe Jev key is valid, service is reachable" };
  if (response.status === 401) return { ok: false, detail: "TypeSafe rejected this key (401); check whether it was mistyped" };
  return { ok: false, detail: `TypeSafe returned HTTP ${response.status}; please try again later` };
}

async function testSupabase(): Promise<TestResult> {
  // Uses the config that's "currently actually in effect" (enabled project > environment variables),
  // matching the semantics of getSupabaseServiceClientAsync used for writes.
  // Does not go through resolveConfigValue("supabase.service_key"): that key isn't in config-store's
  // environment-variable mapping, so it would never resolve.
  const config = await getActiveSupabaseConfig();
  if (!config || !config.serviceKey) {
    return {
      ok: false,
      detail: "No usable Supabase service key configured: enable a project with a service key via the mail module's supabase-projects endpoint, or configure it via environment variables",
    };
  }
  const { url, serviceKey: key } = config;
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  return response.ok
    ? { ok: true, detail: "Supabase project is reachable, key is valid" }
    : { ok: false, detail: `Supabase returned HTTP ${response.status}; check the URL and key` };
}

function testLmStudio(): TestResult {
  if (!isLocalLLMAvailable()) {
    return { ok: false, detail: "Currently running in the Vercel cloud environment; local LM Studio is unavailable (architectural constraint, not a configuration error)" };
  }
  return { ok: true, detail: "The local environment allows using LM Studio; make sure LM Studio is running (default http://localhost:1234/v1)" };
}
