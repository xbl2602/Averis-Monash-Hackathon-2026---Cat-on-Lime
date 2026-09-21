import { getSupabaseServiceClient } from "@/lib/shared/supabase";
import { DELETE_ALL_FILTER_COLUMN, DEVMODE_DATA_TABLES } from "./types";
import type { TableWipeOutcome } from "./types";

/**
 * 按依赖顺序清空全部核验数据表（不动 app_config/mail_accounts/supabase_projects
 * 这类连接配置表，见 types.ts 的 DEVMODE_EXCLUDED_TABLES）。
 * 顺序删除、遇错即停——继续删后面的表不会让已经出错的这张表变好，
 * 停下来能让人看清楚具体是哪张表、什么原因失败，而不是一堆表同时报错混在一起。
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
