/**
 * Developer mode (devmode): ⚠️ not an official product feature.
 *
 * Purpose: lets the team/judges quickly wipe or restore the database during verification —
 * this is not part of the shipping-document verification business logic.
 * Hard boundaries (agreed between the operator and the team, 2026-09-21):
 * - Not registered as an MCP tool — this kind of destructive operation must never be callable
 *   automatically by an AI agent, only by a human manually clicking a button.
 * - Not listed in SHARED_INTERFACES.md's normal endpoint table — kept in its own section marked
 *   "developer mode only."
 * - Every write operation requires two gates: x-admin-token (see write-policy.ts) + a confirm
 *   phrase that must match exactly in the request body, to prevent accidental triggers and
 *   scripts calling it inadvertently.
 * - The GUI (owned by teammate A) must show an obvious, persistently visible warning — this is
 *   not just documentation-level advice, it's a product requirement.
 */

// Deletion order is dependency order: child tables first, raw_emails last (parsed_attachments/
// verification_results both have foreign keys pointing to raw_emails.email_id; the rest of the
// tables don't depend on each other, so their relative order doesn't matter)
export const DEVMODE_DATA_TABLES = [
  "parsed_attachments",
  "verification_results",
  "review_overrides",
  "review_actions",
  "uploaded_documents",
  "llm_call_cache",
  "raw_emails",
] as const;
export type DevModeDataTable = (typeof DEVMODE_DATA_TABLES)[number];

// The filter column each table uses to "delete all" — must be a not-null column, paired with
// .not(col, 'is', null) to match every row (PostgREST's delete requires a filter condition; a
// bare delete isn't allowed)
export const DELETE_ALL_FILTER_COLUMN: Record<DevModeDataTable, string> = {
  parsed_attachments: "email_id",
  verification_results: "email_id",
  review_overrides: "id",
  review_actions: "id",
  uploaded_documents: "id",
  llm_call_cache: "cache_key",
  raw_emails: "email_id",
};

// Tables deliberately excluded from "developer mode" wiping — these are connection/identity
// configuration, not verification data itself; wiping them would break the LLM/Supabase connection
// settings, which is a different concern from "resetting test data"
export const DEVMODE_EXCLUDED_TABLES = ["app_config", "mail_accounts", "supabase_projects"] as const;

export const DEVMODE_WARNING =
  "⚠️ Developer mode: for internal/judge verification use only, not an official feature of this product. " +
  "Actions here directly and irreversibly modify the shared database — do not invoke this without understanding the consequences.";

// The confirmation phrase each write operation requires (must match character-for-character in the request body; the admin token alone isn't enough)
export const WIPE_CONFIRM_PHRASE = "WIPE ALL DATA";
export const RESTORE_CONFIRM_PHRASE = "RESTORE SAMPLE DATA";

export interface TableStatus {
  table: DevModeDataTable;
  /** null when reading the row count fails (doesn't affect the status display of other tables) */
  rowCount: number | null;
}

export interface DevModeStatusResponse {
  warning: string;
  tables: TableStatus[];
  excludedTables: readonly string[];
}

export interface TableWipeOutcome {
  table: DevModeDataTable;
  ok: boolean;
  error: string | null;
}

export interface DevModeWipeResponse {
  warning: string;
  wiped: TableWipeOutcome[];
}
