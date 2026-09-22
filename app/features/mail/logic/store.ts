/**
 * The database entry point for the mail module: every table read/write gets its client from here (stateless, built fresh each time).
 *
 * Why it's fixed to a synchronous client that "only depends on environment variables":
 * supabase_projects is the management table for "which project is active", and it must itself stay
 * in the bootstrap project (the one configured via env) or it would become self-dependent — to know
 * which project to use, this table has to be read first. Toggling is_active affects how the business
 * data layer resolves its connection (getActiveSupabaseConfig / getSupabaseServiceClientAsync in
 * lib/shared/supabase.ts), not the location of this table itself (see PHASE2_SPEC 4.2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient, isSupabaseServiceAvailable } from "@/lib/shared/supabase";
import { MailStoreUnavailableError } from "./errors";

export function isMailStoreAvailable(): boolean {
  return isSupabaseServiceAvailable();
}

export function getMailDbClient(): SupabaseClient {
  try {
    return getSupabaseServiceClient();
  } catch (err) {
    throw new MailStoreUnavailableError(
      `Mail module unavailable: ${err instanceof Error ? err.message : "Failed to initialize the Supabase server-side client"}`
    );
  }
}
