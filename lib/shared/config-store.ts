/**
 * Read/write access to the app_config table (phase-2 SPEC section 3).
 *
 * Layering: api/ only parses the request, the logic lives here; the LLM call layer will read
 * values through this file's resolveConfigValue in the future.
 * Concurrency convention: writes use upsert (key is unique), with an update timestamp; there's no "read then write".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClientAsync, isSupabaseServiceAvailable } from "./supabase";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";

export type ConfigCategory = "llm" | "pipeline" | "storage" | "mail" | "general";

export interface ConfigItemRow {
  key: string;
  category: ConfigCategory;
  value: unknown; // Stored as jsonb in the database (for secret items, this is the ciphertext string)
  is_secret: boolean;
  updated_at: string | null;
}

/** The shape returned for display in the UI: secret values only get a mask + has_value, plaintext is never returned */
export interface ConfigItemView {
  key: string;
  category: ConfigCategory;
  value: unknown;
  is_secret: boolean;
  has_value: boolean;
  source: "db" | "env" | "default" | "unset";
  updated_at: string | null;
}

/**
 * The environment-variable fallback mapping: key -> environment variable name.
 * Only lists items that are "allowed to be overridden by the database"; when the database has
 * no value, the UI shows the current env value.
 * Secret and plaintext items are split into two tables: is_secret only applies to the secret
 * mapping (SPEC 3.2 explicitly states that lmstudio_base_url is plaintext).
 */
const SENSITIVE_ENV_FALLBACK: Record<string, string> = {
  "llm.anthropic_api_key": "ANTHROPIC_API_KEY",
  "llm.openai_api_key": "OPENAI_API_KEY",
  "llm.deepseek_api_key": "DEEPSEEK_API_KEY",
  "llm.gemini_api_key": "GOOGLE_GENERATIVE_AI_API_KEY",
  "llm.typesafe_api_key": "TYPESAFE_API_KEY",
};

const PLAINTEXT_ENV_FALLBACK: Record<string, string> = {
  "llm.lmstudio_base_url": "LM_STUDIO_BASE_URL",
};

function envNameOf(key: string): string | undefined {
  return SENSITIVE_ENV_FALLBACK[key] ?? PLAINTEXT_ENV_FALLBACK[key];
}

/** Secret items: the value must be stored encrypted, and only a mask is ever displayed */
function isSensitiveKey(key: string): boolean {
  return Boolean(SENSITIVE_ENV_FALLBACK[key]);
}

/** Plaintext items: even if the database row was mistakenly marked is_secret, still display it as plaintext (SPEC 3.2) */
function isPlaintextKey(key: string): boolean {
  return Boolean(PLAINTEXT_ENV_FALLBACK[key]);
}

/** Code-level defaults: shown in the UI as "not configured" or the default when neither the database nor env has a value */
export const CONFIG_DEFAULTS: Record<string, unknown> = {
  "llm.provider_priority": ["rules", "jev", "gemini"],
  "llm.jev.confidence_threshold": 0.85,
  "llm.default_provider": "gemini",
  "pipeline.concurrency": 4,
  "pipeline.batch_limit": 50,
  "storage.upload_max_file_mb": 20,
  "storage.upload_max_batch_mb": 3,
  "mail.auto_sync_enabled": false,
  "mail.sync_interval_minutes": 15,
};

export function isConfigStoreAvailable(): boolean {
  return isSupabaseServiceAvailable();
}

export async function listConfigViews(category?: ConfigCategory): Promise<ConfigItemView[]> {
  const client = await getSupabaseServiceClientAsync();
  // We don't filter the database query by category here: env/default fallback items aren't in
  // the database, so we have to merge both kinds of data and compute the "effective category"
  // first, before filtering (otherwise ?category=llm would silently drop the fallback items).
  const { data, error } = await client.from("app_config").select("key, category, value, is_secret, updated_at");
  if (error) {
    throw new Error(
      `Failed to read configuration: ${error.message}. If you just switched the active project, check whether the project address is reachable, or deactivate it via mail's supabase-projects endpoint and retry`
    );
  }
  const rows = (data ?? []) as ConfigItemRow[];
  const byKey = new Map(rows.map((row) => [row.key, row]));

  const keys = Array.from(
    new Set([
      ...byKey.keys(),
      ...Object.keys(SENSITIVE_ENV_FALLBACK),
      ...Object.keys(PLAINTEXT_ENV_FALLBACK),
      ...Object.keys(CONFIG_DEFAULTS),
    ])
  );
  return keys
    .map((key) => {
      const row = byKey.get(key);
      // Effective category: for a database row, use the row's own category; for a fallback item, derive it from the key prefix
      const effectiveCategory = row?.category ?? categoryOf(key);
      const envName = envNameOf(key);
      const envValue = envName ? process.env[envName] : undefined;
      const fallback = envValue || CONFIG_DEFAULTS[key];
      // Secret status is only determined by the secret mapping; a plaintext item is treated as plaintext even if the database row has is_secret set
      const isSecret = isSensitiveKey(key) || (!isPlaintextKey(key) && Boolean(row?.is_secret));

      if (row) {
        return {
          key,
          category: effectiveCategory,
          value: isSecret && typeof row.value === "string" ? maskDecrypted(row.value) : row.value,
          is_secret: isSecret,
          has_value: row.value !== null && row.value !== "",
          source: "db" as const,
          updated_at: row.updated_at,
        };
      }
      if (fallback !== undefined && fallback !== "") {
        return {
          key,
          category: effectiveCategory,
          value: isSecret ? maskSecret(String(fallback)) : fallback,
          is_secret: isSecret,
          has_value: true,
          source: envName ? ("env" as const) : ("default" as const),
          updated_at: null,
        };
      }
      return {
        key,
        category: effectiveCategory,
        value: null,
        is_secret: isSecret,
        has_value: false,
        source: "unset" as const,
        updated_at: null,
      };
    })
    .filter((item) => !category || item.category === category);
}

// Displaying a secret item from the db: decrypt first, then mask (a decryption failure isn't thrown to the UI — a placeholder is shown, with the anomaly implied by has_value)
function maskDecrypted(cipher: string): string {
  try {
    return maskSecret(decryptSecret(cipher));
  } catch {
    return "•••";
  }
}

export interface ConfigUpdate {
  key: string;
  value: string | number | boolean | string[] | null;
  /** Optional optimistic lock: the updated_at (ISO string) the caller had when it read the value; if it doesn't match the current row, the whole batch is rejected */
  expected_updated_at?: string;
}

/** Optimistic-lock conflict: the whole batch is rejected, and the caller (the HTTP layer) turns this into a 409 */
export class ConfigConflictError extends Error {
  readonly keys: string[];

  constructor(keys: string[]) {
    super(`Save rejected: the following configuration items were modified after you read them: ${keys.join(", ")}. Please reload the latest configuration and save again`);
    this.name = "ConfigConflictError";
    this.keys = keys;
  }
}

/**
 * Validates expected_updated_at: only queries the current row for keys that carry this field,
 * comparing updated_at one by one.
 * If the current row doesn't exist -> treated as no conflict; a mismatch -> throws
 * ConfigConflictError (before the caller performs any write).
 *
 * Trade-off note: there is a small window between the query and the subsequent write (two
 * requests could both pass the check and then write one after another); CLAUDE.md explicitly
 * states that this phase only needs "basic conflict warning" — we're not adding a database
 * transaction/RPC for this.
 */
async function assertNoConflicts(client: SupabaseClient, updates: ConfigUpdate[]): Promise<void> {
  const withExpected = updates.filter((update) => update.expected_updated_at !== undefined);
  if (withExpected.length === 0) return;

  const { data, error } = await client
    .from("app_config")
    .select("key, updated_at")
    .in(
      "key",
      withExpected.map((update) => update.key)
    );
  if (error) {
    throw new Error(
      `Failed to read configuration: ${error.message}. If you just switched the active project, check whether the project address is reachable, or deactivate it via mail's supabase-projects endpoint and retry`
    );
  }
  const currentByKey = new Map(
    ((data ?? []) as { key: string; updated_at: string | null }[]).map((row) => [row.key, row.updated_at])
  );

  const conflicts: string[] = [];
  for (const update of withExpected) {
    const current = currentByKey.get(update.key);
    if (current === undefined) continue; // The current row doesn't exist -> no conflict, write normally
    const expectedTime = new Date(update.expected_updated_at as string).getTime();
    if (Number.isNaN(expectedTime)) {
      throw new Error(`The expected_updated_at for configuration ${update.key} is not a valid time string`);
    }
    const currentTime = current ? new Date(current).getTime() : 0;
    if (expectedTime !== currentTime) conflicts.push(update.key);
  }
  if (conflicts.length > 0) throw new ConfigConflictError(conflicts);
}

/**
 * Batch write. Conventions:
 * - Items carrying expected_updated_at are optimistic-lock-checked first; a conflict rejects
 *   the whole batch (no partial writes occur)
 * - Secret items (whose key is in the secret mapping) -> encrypted before writing; plaintext
 *   items (e.g. lmstudio_base_url) -> written as-is
 * - value of null -> deletes that row (reverting to the env/default value)
 * - upsert, concurrency-safe
 */
export async function upsertConfig(updates: ConfigUpdate[]): Promise<{ written: number; skipped: string[] }> {
  const client = await getSupabaseServiceClientAsync();

  // The optimistic-lock check must happen before any write/delete, to guarantee that "reject the whole batch" never leaves behind a partial write
  await assertNoConflicts(client, updates);

  const rows: ConfigItemRow[] = [];
  const skipped: string[] = [];

  for (const update of updates) {
    const category = categoryOf(update.key);
    const isSecret = isSensitiveKey(update.key);
    if (update.value === null) {
      const { error } = await client.from("app_config").delete().eq("key", update.key);
      if (error) throw new Error(`Failed to delete configuration ${update.key}: ${error.message}`);
      continue;
    }
    if (isSecret) {
      if (typeof update.value !== "string") {
        skipped.push(update.key);
        continue;
      }
      // The mask was passed back unchanged (the user didn't modify this field) -> skip it, to avoid storing the mask itself as the new "secret"
      if (update.value.includes("…") || update.value === "•••") {
        skipped.push(update.key);
        continue;
      }
      rows.push({
        key: update.key,
        category,
        value: encryptSecret(update.value.trim()),
        is_secret: true,
        updated_at: new Date().toISOString(),
      });
    } else {
      rows.push({
        key: update.key,
        category,
        value: update.value,
        is_secret: false,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await client.from("app_config").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(`Failed to save configuration: ${error.message}`);
  }
  return { written: rows.length, skipped };
}

/**
 * The value-lookup entry point for code to use (database > env > default).
 * Will be called by the lib/llm refactor in the future to fetch keys / thresholds / etc.
 */
export async function resolveConfigValue(key: string): Promise<unknown> {
  const envName = envNameOf(key);
  try {
    const client = await getSupabaseServiceClientAsync();
    const { data } = await client.from("app_config").select("value, is_secret").eq("key", key).maybeSingle();
    if (data) {
      const row = data as { value: unknown; is_secret: boolean };
      return row.is_secret && typeof row.value === "string" ? decryptSecret(row.value) : row.value;
    }
  } catch (err) {
    // If the database is unavailable, silently fall through to env/default (a failed config
    // read shouldn't crash the main flow); but still leave a log so it's possible to debug
    // "why didn't the config take effect" (per the debugging convention: never swallow errors silently)
    console.warn(
      "[config-store] Failed to read configuration from the database, falling back to env/default:",
      err instanceof Error ? err.message : err
    );
  }
  if (envName && process.env[envName]) return process.env[envName];
  return CONFIG_DEFAULTS[key] ?? null;
}

function categoryOf(key: string): ConfigCategory {
  const prefix = key.split(".")[0];
  if (prefix === "llm" || prefix === "pipeline" || prefix === "storage" || prefix === "mail") {
    return prefix;
  }
  return "general";
}
