import { getSupabaseServiceClient } from "@/lib/shared/supabase";
import { DEVMODE_DATA_TABLES, DEVMODE_EXCLUDED_TABLES, DEVMODE_WARNING } from "./types";
import type { DevModeStatusResponse, TableStatus } from "./types";

/** Read-only: shows the developer-mode page "how many rows each table currently has," without changing any data */
export async function getDevModeStatus(): Promise<DevModeStatusResponse> {
  const supabase = getSupabaseServiceClient();

  const tables: TableStatus[] = await Promise.all(
    DEVMODE_DATA_TABLES.map(async (table) => {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      return { table, rowCount: error ? null : (count ?? 0) };
    })
  );

  return { warning: DEVMODE_WARNING, tables, excludedTables: DEVMODE_EXCLUDED_TABLES };
}
