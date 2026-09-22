import { buildGmailSyncPlaceholder } from "../logic";

/**
 * The MCP tool exposed by the mail module, aggregated and registered by app/core/mcp-server/tools.ts.
 * This stage only exposes sync_gmail: real syncing isn't implemented yet, so it returns a readable explanation (PHASE2_SPEC section 7).
 * Once Gmail is actually wired up, this will trigger users.messages.list -> the classify/extract/compare pipeline.
 */
const syncGmailMcpTool = {
  name: "sync_gmail",
  description:
    "Trigger a Gmail email sync (real OAuth syncing isn't implemented at this stage; returns a readable not_implemented explanation; use REST GET /features/mail/api/gmail to check connection status)",
  inputSchema: {},
  // The sync action will write to the database once implemented — don't let an AI client mistake this for a pure query
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async () => buildGmailSyncPlaceholder(),
};

export const mailMcpTools = [syncGmailMcpTool];
