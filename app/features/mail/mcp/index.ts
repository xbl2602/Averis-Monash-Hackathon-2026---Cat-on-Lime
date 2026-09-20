import { buildGmailSyncPlaceholder } from "../logic";

/**
 * mail 模块暴露的 MCP tool，被 app/core/mcp-server/tools.ts 汇总注册。
 * 本阶段只暴露 sync_gmail：真实同步未实现，返回可读说明（PHASE2_SPEC 第 7 节）。
 * 将来接上 Gmail 后由它触发 users.messages.list → 分类/抽取/比对流水线。
 */
const syncGmailMcpTool = {
  name: "sync_gmail",
  description:
    "触发 Gmail 邮件同步（本阶段未实现真实 OAuth 同步，返回 not_implemented 的可读说明；连接状态查询请用 REST GET /features/mail/api/gmail）",
  inputSchema: {},
  // 同步动作将来会写库，别让 AI client 误以为它只是查询
  annotations: { readOnlyHint: false, idempotentHint: true },
  handler: async () => buildGmailSyncPlaceholder(),
};

export const mailMcpTools = [syncGmailMcpTool];
