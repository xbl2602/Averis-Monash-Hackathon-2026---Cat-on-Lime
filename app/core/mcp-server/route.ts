import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { safeErrorMessage } from "@/lib/shared/request-errors";
import { getWriteAccess, type WriteAccess } from "@/lib/shared/write-policy";
import { mcpTools, type McpToolDefinition } from "./tools";

/**
 * MCP Server 入口：Streamable HTTP（Web 标准 Request/Response）。
 *
 * 采用**无状态 + JSON 响应**模式，原因：
 * - 部署在 Vercel（serverless）上，实例随时可能换，不能依赖进程内 session
 * - 每个请求新建 server/transport，处理完即关，天然并发安全（见 CLAUDE.md 高并发要求）
 *
 * 写保护：每个请求解析一次 x-admin-token（不落任何进程级状态）。写 tool
 * （`annotations.readOnlyHint !== true`，fail-closed）未授权时返回可读 isError；
 * `run_batch` 的 dry_run=true 预览是可匿名例外（anonymousWriteWhen）。
 *
 * 连接地址：POST /core/mcp-server
 * GET/DELETE 在无状态模式下不支持（标准行为，返回 405）。
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// run_batch 这类工具可能跑几十秒：Vercel Hobby 函数上限 60s（本地/Docker 无影响）
export const maxDuration = 60;

const SERVER_INFO = { name: "shipping-doc-verifier", version: "0.3.0" };

export async function POST(req: Request) {
  const writeAccess = getWriteAccess(req.headers);
  const server = createMcpServer(writeAccess);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // 不生成 session id = 无状态模式（每个请求独立）
    sessionIdGenerator: undefined,
    // 直接返回 JSON-RPC JSON，不挂 SSE 长连接（serverless 友好）
    enableJsonResponse: true,
  });

  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    await server.close().catch(() => undefined);
  }
}

export async function GET() {
  return methodNotAllowedResponse("无状态 MCP 端点只接受 POST（Streamable HTTP / JSON 模式）");
}

export async function DELETE() {
  return methodNotAllowedResponse("无状态模式没有会话，不需要 DELETE");
}

function createMcpServer(writeAccess: WriteAccess): McpServer {
  const server = new McpServer(SERVER_INFO);

  for (const tool of mcpTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        // 注解只用于 client 展示；写保护 gate 按 fail-closed 自行判定（缺省展示为"会写库"）
        annotations: tool.annotations ?? { readOnlyHint: false, openWorldHint: false },
      },
      async (args) => runTool(tool, args, writeAccess)
    );
  }

  return server;
}

async function runTool(
  tool: McpToolDefinition,
  args: unknown,
  writeAccess: WriteAccess
): Promise<CallToolResult> {
  try {
    // fail-closed：没显式声明 readOnlyHint: true 的 tool 都按"需要口令"处理
    const needsAdmin = tool.annotations?.readOnlyHint !== true;
    if (needsAdmin) {
      const allowedAnonymous = tool.anonymousWriteWhen?.(args) === true;
      if (!writeAccess.authorized && !allowedAnonymous) {
        return {
          content: [
            {
              type: "text",
              text: `工具 ${tool.name} 执行被拒绝：${writeAccess.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    const result = await tool.handler(args, { anonymous: !writeAccess.authorized });

    // feature 的 tool 可以直接返回 MCP 结果（含 content 数组，例如 export_results），
    // 其余情况统一序列化成一段 JSON 文本
    if (isMcpContentResult(result)) return result;
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    // 原始错误只进服务端日志；回给调用方的是白名单过滤后的可读文案（不泄上游原文/路径）
    console.error(`[mcp-server] tool ${tool.name} 执行失败`, err);
    return {
      content: [
        { type: "text", text: `工具 ${tool.name} 执行失败：${safeErrorMessage(err)}` },
      ],
      isError: true,
    };
  }
}

function isMcpContentResult(value: unknown): value is CallToolResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { content?: unknown }).content)
  );
}

function methodNotAllowedResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message },
      id: null,
    }),
    { status: 405, headers: { "Content-Type": "application/json", Allow: "POST" } }
  );
}
