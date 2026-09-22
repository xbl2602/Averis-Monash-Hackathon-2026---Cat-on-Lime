import { getSupabaseServiceClient } from "@/lib/shared/supabase";
import { DELETE_ALL_FILTER_COLUMN, DEVMODE_DATA_TABLES } from "./types";
import type { TableWipeOutcome } from "./types";

/**
 * Wipes every verification data table in dependency order (leaves connection-config tables like
 * app_config/mail_accounts/supabase_projects untouched — see DEVMODE_EXCLUDED_TABLES in types.ts).
 * Deletes sequentially and stops at the first error — continuing to delete later tables wouldn't fix
 * the one that already failed, and stopping makes it clear exactly which table failed and why, instead
 * of a pile of tables erroring out all at once.
 */
export async function wipeAllData(): Promise<TableWipeOutcome[]> {
  const supabase = getSupabaseServiceClient();
  const outcomes: TableWipeOutcome[] = [];

  for (const table of DEVMODE_DATA_TABLES) {
    const filterColumn = DELETE_ALL_FILTER_COLUMN[table];
    const { error } = await supabase.from(table).delete().not(filterColumn, "is", null);
    outcomes.push({ table, ok: !error, error: error ? error.message : null });
    if (error) break;
  }

  return outcomes;
}
