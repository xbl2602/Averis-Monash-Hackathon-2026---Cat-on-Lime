import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "./crypto";

/**
 * Supabase client (the anon-key version shared by browser/server, read-only).
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be configured in .env.local.
 */
export function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables: please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }

  return createClient(url, anonKey);
}

/**
 * Server-only client (service role key): used for writing to the database, calling the
 * cache, and batch jobs.
 * This key has very high privileges: it must never get a NEXT_PUBLIC_ prefix and must never
 * be used in the browser — server-side/local scripts only.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY: writing to the database/cache/batch jobs requires the service role key (see .env.example)"
    );
  }

  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// Whether the current environment has a service role key configured (if not, features like the cache automatically degrade without affecting the main flow)
export function isSupabaseServiceAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** The Supabase configuration currently in effect: an enabled project takes priority, then environment variables. serviceKey is either already decrypted or null */
export interface ActiveSupabaseConfig {
  url: string;
  /** Empty string if the project row has no anon key configured (no cross-project fallback, to avoid picking up the wrong project's key) */
  anonKey: string;
  /** null if neither the project row nor env has it configured; a decryption failure throws directly rather than falling back to some other project's credentials */
  serviceKey: string | null;
}

/**
 * Resolves the currently effective Supabase configuration (phase-2 SPEC 4.2):
 * the row in supabase_projects with is_active=true > environment variables.
 *
 * Key point: reading supabase_projects itself must use getSupabaseServiceClient(), which
 * depends only on environment variables — otherwise we'd end up with a circular dependency
 * where you need to read the database's configuration just to know which database to use
 * (PHASE2_SPEC 4.2). If the table isn't set up yet / is temporarily unreadable, fall back to
 * environment variables and leave a console log (don't swallow the failure silently).
 */
export async function getActiveSupabaseConfig(): Promise<ActiveSupabaseConfig | null> {
  const active = await readActiveProjectConfig();
  if (active) return active;
  return readEnvSupabaseConfig();
}

async function readActiveProjectConfig(): Promise<ActiveSupabaseConfig | null> {
  let client: SupabaseClient;
  try {
    client = getSupabaseServiceClient();
  } catch {
    return null; // Even the bootstrap project (env) isn't configured, so there's no question of an active project
  }
  const { data, error } = await client
    .from("supabase_projects")
    .select("project_url, anon_key, service_key")
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.warn(`[supabase] Failed to read the active project, falling back to environment variables: ${error.message}`);
    return null;
  }
  if (!data) return null;

  const row = data as { project_url: string; anon_key: string | null; service_key: string | null };
  return {
    url: row.project_url,
    anonKey: row.anon_key ?? "",
    // Throw directly on decryption failure: we must never silently swap in a different
    // project's credentials and write to the wrong database
    serviceKey: row.service_key ? decryptSecret(row.service_key) : null,
  };
}

function readEnvSupabaseConfig(): ActiveSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  return {
    url,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
  };
}

/**
 * Creates a service client using the currently active project's configuration (for
 * writing/batch jobs).
 * Difference from the synchronous getSupabaseServiceClient: this one prefers the project
 * enabled in the database.
 * Resolved fresh on every call, with no module-level caching (there may be multiple
 * serverless instances — see the "High Concurrency" section of CLAUDE.md).
 */
export async function getSupabaseServiceClientAsync(): Promise<SupabaseClient> {
  const config = await getActiveSupabaseConfig();
  // Actionable recovery guidance for errors: if you just enabled a project whose address is
  // unreachable/misconfigured, deactivate it first, then fall back to environment variables
  const deactivateHint =
    " (if you just switched the active project) you can call POST /features/mail/api/supabase-projects/deactivate to deactivate it and then fall back to environment variables";
  if (!config) {
    throw new Error(
      `No Supabase configuration is available: please configure environment variables (see .env.example), or enable a project at /features/mail/api/supabase-projects${deactivateHint}`
    );
  }
  if (!config.serviceKey) {
    throw new Error(
      `Supabase project ${config.url} has no usable service key (service_key is not configured or could not be decrypted): writing to the database/batch jobs require it — please check the supabase_projects table or the SUPABASE_SERVICE_ROLE_KEY environment variable${deactivateHint}`
    );
  }
  return createClient(config.url, config.serviceKey, { auth: { persistSession: false } });
}
