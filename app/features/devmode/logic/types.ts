/**
 * 开发者模式（devmode）：⚠️ 不是正式产品功能。
 *
 * 用途：给团队/评委在验证阶段快速清空或恢复数据库，不是航运单证核验业务的一部分。
 * 硬性边界（操作者与团队约定，2026-09-21）：
 * - 不注册 MCP tool——这类破坏性操作绝不能被 AI agent 自动调用，只能是人手动点按钮。
 * - 不进 SHARED_INTERFACES.md 的正常端点表，单独放一节并标注"仅限开发者模式使用"。
 * - 每个写操作都要 x-admin-token（见 write-policy.ts）+ 请求体里精确匹配的 confirm 短语
 *   两道门槛，防止误触和被脚本无意间连坐调用。
 * - GUI（队友A负责）必须有明显、持续可见的警示——这条不是文档层面的建议，是产品要求。
 */

// 删除顺序即依赖顺序：子表在前、raw_emails 最后（parsed_attachments/verification_results
// 都有外键指向 raw_emails.email_id，其余表互不依赖，谁先谁后无所谓）
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

// 每张表用来"删全部"的过滤列——必须是 not null 列，配合 .not(col, 'is', null) 匹配所有行
// （PostgREST 的 delete 要求带过滤条件，不能裸 delete）
export const DELETE_ALL_FILTER_COLUMN: Record<DevModeDataTable, string> = {
  parsed_attachments: "email_id",
  verification_results: "email_id",
  review_overrides: "id",
  review_actions: "id",
  uploaded_documents: "id",
  llm_call_cache: "cache_key",
  raw_emails: "email_id",
};

// 刻意不包含在"开发者模式"清空范围内的表——这些是连接/身份配置，不是核验数据本身，
// 清掉会破坏 LLM/Supabase 的连接设置，跟"重置测试数据"是两件事
export const DEVMODE_EXCLUDED_TABLES = ["app_config", "mail_accounts", "supabase_projects"] as const;

export const DEVMODE_WARNING =
  "⚠️ 开发者模式：仅供内部/评委验证阶段使用，不是本产品的正式功能。这里的操作会直接、不可逆地" +
  "修改共享数据库，请勿在不清楚后果的情况下调用。";

// 两个写操作各自要求的确认短语（必须在请求体里逐字符匹配，光靠 admin token 不够）
export const WIPE_CONFIRM_PHRASE = "WIPE ALL DATA";
export const RESTORE_CONFIRM_PHRASE = "RESTORE SAMPLE DATA";

export interface TableStatus {
  table: DevModeDataTable;
  /** 读取行数失败时为 null（不影响其它表的状态展示） */
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
