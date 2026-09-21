import { getSupabaseServiceClient } from "@/lib/shared/supabase";
import { DEVMODE_DATA_TABLES, DEVMODE_EXCLUDED_TABLES, DEVMODE_WARNING } from "./types";
import type { DevModeStatusResponse, TableStatus } from "./types";

/** 只读：给开发者模式页面展示"现在每张表有多少行"，不改任何数据 */
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
