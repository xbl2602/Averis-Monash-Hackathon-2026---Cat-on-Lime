/**
 * Read/write for the supabase_projects table (PHASE2_SPEC section 4.2): adding/editing, listing, and switching the active project among multiple Supabase projects.
 *
 * Conventions (see SPEC sections 1 / 6):
 * - service_key is stored encrypted via encryptSecret, and is always echoed back masked via maskSecret, never in plaintext
 * - Writes use upsert (conflict key id), without "check existence first, then write" (concurrency-safe, see CLAUDE.md)
 * - Switching the active project uses two updates (clear others first, then set the target), with the database's unique index as the concurrency backstop
 */
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/shared/crypto";
import { MailDataError, MailNotFoundError, MailRequestError } from "./errors";
import { getMailDbClient } from "./store";

/** The project shape echoed back to the UI: service_key is masked, has_service_key indicates whether the database actually has a value */
export interface SupabaseProjectView {
  id: string;
  label: string;
  project_url: string;
  anon_key: string | null;
  service_key: string | null;
  has_service_key: boolean;
  is_active: boolean;
  updated_at: string | null;
}

interface SupabaseProjectRow {
  id: string;
  label: string;
  project_url: string;
  anon_key: string | null;
  service_key: string | null;
  is_active: boolean;
  updated_at: string | null;
}

const PROJECT_COLUMNS = "id, label, project_url, anon_key, service_key, is_active, updated_at";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listSupabaseProjects(): Promise<SupabaseProjectView[]> {
  const client = getMailDbClient();
  const { data, error } = await client
    .from("supabase_projects")
    .select(PROJECT_COLUMNS)
    .order("is_active", { ascending: false })
    .order("label", { ascending: true });
  if (error) {
    throw new MailDataError(`Failed to read the Supabase project list: ${error.message} (confirm the supabase_projects table has been created, see PHASE2_SPEC 4.1)`);
  }
  return ((data ?? []) as SupabaseProjectRow[]).map(toProjectView);
}

export interface SaveSupabaseProjectInput {
  /** Omit = create new; passed = update (upsert; if the id doesn't exist, a new row with that id is inserted) */
  id?: string;
  label: string;
  project_url: string;
  /** Public info, stored in plaintext; passing an empty string = clear it */
  anon_key?: string;
  /** Stored encrypted; omitted or empty = leave unchanged, passing the mask back = the user didn't change this field */
  service_key?: string;
}

export async function saveSupabaseProject(input: SaveSupabaseProjectInput): Promise<SupabaseProjectView> {
  const client = getMailDbClient();
  const row: Record<string, unknown> = {
    label: input.label,
    project_url: input.project_url,
    updated_at: new Date().toISOString(),
  };
  if (input.id) row.id = input.id;
  if (input.anon_key !== undefined) row.anon_key = input.anon_key === "" ? null : input.anon_key;

  // The mask being echoed back unchanged = the user didn't change this field: skip it, to avoid storing the mask itself as the new "secret" (same convention as config-store)
  if (input.service_key && !isMaskedSecret(input.service_key)) {
    row.service_key = encryptSecret(input.service_key);
  }

  const { data, error } = await client
    .from("supabase_projects")
    .upsert(row, { onConflict: "id" })
    .select(PROJECT_COLUMNS)
    .single();
  if (error) throw new MailDataError(`Failed to save the Supabase project: ${error.message}`);
  return toProjectView(data as SupabaseProjectRow);
}

export async function activateSupabaseProject(id: string): Promise<SupabaseProjectView> {
  const client = getMailDbClient();

  // Confirm the target exists first: this system has no delete-project endpoint, so this row can't be
  // deleted concurrently — this avoids the side effect of "a typo'd target id clearing the current
  // active project while activating nothing"
  const { data: existing, error: existsError } = await client
    .from("supabase_projects")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (existsError) throw new MailDataError(`Failed to query the project to activate: ${existsError.message}`);
  if (!existing) throw new MailRequestError(`The project to activate doesn't exist: ${id}`);

  const now = new Date().toISOString();

  // First set all other active projects to false (without reading who's currently active, write directly by condition)
  const { error: clearError } = await client
    .from("supabase_projects")
    .update({ is_active: false, updated_at: now })
    .eq("is_active", true)
    .neq("id", id);
  if (clearError) throw new MailDataError(`Failed to switch the active project (while clearing the old one): ${clearError.message}`);

  // Then set the target to true; the unique index guarantees at most one true at any given moment
  const { data, error } = await client
    .from("supabase_projects")
    .update({ is_active: true, updated_at: now })
    .eq("id", id)
    .select(PROJECT_COLUMNS)
    .maybeSingle();
  if (error) {
    // 23505 = unique index conflict: another activation happened to insert concurrently — report it honestly and ask for a retry, don't silently re-run
    if (error.code === "23505") {
      throw new MailRequestError("Another activation just happened, please try again shortly");
    }
    throw new MailDataError(`Failed to switch the active project: ${error.message}`);
  }
  if (!data) throw new MailRequestError(`The project to activate doesn't exist: ${id}`);
  return toProjectView(data as SupabaseProjectRow);
}

export interface DeactivateSupabaseProjectsResult {
  /** Number of projects actually switched from active to inactive this time (0 if none were active to begin with) */
  deactivated: number;
  /** The list of projects deactivated this time (same masked echo as the GET list) */
  items: SupabaseProjectView[];
}

/**
 * Deactivate the currently active Supabase project(s) (an operability recovery channel):
 * - Passing id: only deactivates that project; if it doesn't exist -> MailNotFoundError (HTTP 404)
 * - Omitting id: deactivates all currently is_active=true projects ("clear the active one, fall back to environment variables")
 *
 * Concurrency convention: the write is a conditional update (is_active=true [and id=...]), never
 * "read then write" in code; the preliminary lookup by id is only there to give a readable 404, not
 * to decide whether to write (the unique index only constrains "at most one true" — setting to false
 * never triggers a conflict).
 */
export async function deactivateSupabaseProjects(id?: string): Promise<DeactivateSupabaseProjectsResult> {
  const client = getMailDbClient();

  if (id) {
    const { data: existing, error: existsError } = await client
      .from("supabase_projects")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (existsError) throw new MailDataError(`Failed to query the project to deactivate: ${existsError.message}`);
    if (!existing) throw new MailNotFoundError(`The project to deactivate doesn't exist: ${id}`);
  }

  let query = client
    .from("supabase_projects")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("is_active", true);
  if (id) query = query.eq("id", id);

  const { data, error } = await query.select(PROJECT_COLUMNS);
  if (error) throw new MailDataError(`Failed to deactivate the project: ${error.message}`);
  const items = ((data ?? []) as SupabaseProjectRow[]).map(toProjectView);
  return { deactivated: items.length, items };
}

/** Validates and normalizes the request body for creating/updating a project (the api layer only parses JSON; format rules live here) */
export function normalizeSaveProjectInput(body: Record<string, unknown>): SaveSupabaseProjectInput {
  const id = optionalString(body.id, "id");
  if (id && !UUID_PATTERN.test(id)) {
    throw new MailRequestError("id must be a valid UUID (omit it to create a new project)");
  }
  const label = requiredString(body.label, "label");
  const projectUrl = stripTrailingSlashes(requiredString(body.project_url, "project_url"));
  assertHttpUrl(projectUrl);
  return {
    id,
    label,
    project_url: projectUrl,
    anon_key: optionalString(body.anon_key, "anon_key"),
    service_key: optionalString(body.service_key, "service_key"),
  };
}

/** Validates the request body for switching the active project */
export function normalizeActivateInput(body: Record<string, unknown>): { id: string } {
  const id = requiredString(body.id, "id");
  if (!UUID_PATTERN.test(id)) {
    throw new MailRequestError("id must be a valid UUID");
  }
  return { id };
}

/** Validates the request body for deactivating a project: id can be omitted (omit = deactivate all active projects), and if given must be a valid UUID */
export function normalizeDeactivateInput(body: Record<string, unknown>): { id?: string } {
  const raw = optionalString(body.id, "id");
  // An empty string is a common serialization result of a GUI "field present but no value selected";
  // if this were silently treated as "omitted", a small UI slip would deactivate every project —
  // so error explicitly and let the caller decide whether to omit id or pass a UUID
  if (raw !== undefined && raw === "") {
    throw new MailRequestError(
      "id cannot be an empty string: to deactivate all active projects, omit the id field; to deactivate a single project, pass a valid UUID"
    );
  }
  const id = raw || undefined;
  if (id && !UUID_PATTERN.test(id)) {
    throw new MailRequestError("id must be a valid UUID (omit it to deactivate all active projects)");
  }
  return { id };
}

function toProjectView(row: SupabaseProjectRow): SupabaseProjectView {
  return {
    id: row.id,
    label: row.label,
    project_url: row.project_url,
    anon_key: row.anon_key,
    service_key: row.service_key ? maskStoredSecret(row.service_key) : null,
    has_service_key: Boolean(row.service_key),
    is_active: row.is_active,
    updated_at: row.updated_at,
  };
}

// The service_key in the database is ciphertext: decrypt it, then mask it. If it can't be decrypted (master key rotated / corrupted ciphertext), show a placeholder instead of failing the whole list endpoint
function maskStoredSecret(cipher: string): string {
  try {
    return maskSecret(decryptSecret(cipher));
  } catch {
    return "•••";
  }
}

function isMaskedSecret(value: string): boolean {
  return value.includes("…") || value === "•••";
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new MailRequestError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new MailRequestError(`${field} must be a string`);
  return value.trim();
}

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

function assertHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new MailRequestError("project_url is not a valid URL (should look like https://xxxx.supabase.co)");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new MailRequestError("project_url must start with http:// or https://");
  }
}
