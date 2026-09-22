/**
 * The single implementation of the mail module (PHASE2_SPEC section 4): Gmail connection status placeholder + multi-Supabase-project management.
 * Both REST (api/) and MCP (mcp/) call only the functions here, without reimplementing the logic.
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
