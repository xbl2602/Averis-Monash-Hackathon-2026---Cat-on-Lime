/**
 * mail 模块（PHASE2_SPEC 第 4 节）的唯一实现：Gmail 连接状态占位 + 多 Supabase 项目管理。
 * REST（api/）和 MCP（mcp/）都只调用这里的函数，不重复实现逻辑。
 */
export {
  buildGmailConnectPlaceholder,
  buildGmailSyncPlaceholder,
  disconnectGmail,
  getGmailConnection,
} from "./gmail";
export type {
  GmailConnectPlaceholder,
  GmailConnectionStatus,
  GmailConnectionView,
} from "./gmail";
export {
  activateSupabaseProject,
  deactivateSupabaseProjects,
  listSupabaseProjects,
  normalizeActivateInput,
  normalizeDeactivateInput,
  normalizeSaveProjectInput,
  saveSupabaseProject,
} from "./projects";
export type {
  DeactivateSupabaseProjectsResult,
  SaveSupabaseProjectInput,
  SupabaseProjectView,
} from "./projects";
export { isMailStoreAvailable } from "./store";
export { MailDataError, MailNotFoundError, MailRequestError, MailStoreUnavailableError } from "./errors";
