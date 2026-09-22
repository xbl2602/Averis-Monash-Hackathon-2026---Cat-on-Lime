import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { safeErrorMessage } from "@/lib/shared/request-errors";
import { getWriteAccess, type WriteAccess } from "@/lib/shared/write-policy";
import { mcpTools, type McpToolDefinition } from "./tools";

/**
 * MCP Server entry point: Streamable HTTP (standard Web Request/Response).
 *
 * Uses a **stateless + JSON response** model, because:
 * - Deployed on Vercel (serverless), where instances can be swapped at any time, so it can't rely on an in-process session
 * - Each request creates a new server/transport and closes it once handled, which is inherently concurrency-safe (see CLAUDE.md's high-concurrency requirement)
 *
 * Write protection: each request parses x-admin-token once (no process-level state is kept). A write
 * tool (`annotations.readOnlyHint !== true`, fail-closed) returns a readable isError when unauthorized;
 * `run_batch`'s dry_run=true preview is an allowed anonymous exception (anonymousWriteWhen).
 *
 * Connect at: POST /core/mcp-server
 * GET/DELETE are not supported in stateless mode (standard behavior, returns 405).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Tools like run_batch may run for tens of seconds: the Vercel Hobby plan's function limit is 60s (no impact locally/in Docker)
export const maxDuration = 60;

const SERVER_INFO = { name: "shipping-doc-verifier", version: "0.3.0" };

export async function POST(req: Request) {
  const writeAccess = getWriteAccess(req.headers);
  const server = createMcpServer(writeAccess);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // No session id generated = stateless mode (each request is independent)
    sessionIdGenerator: undefined,
    // Returns JSON-RPC JSON directly, no long-lived SSE connection (serverless-friendly)
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
  return methodNotAllowedResponse("The stateless MCP endpoint only accepts POST (Streamable HTTP / JSON mode)");
}

export async function DELETE() {
  return methodNotAllowedResponse("Stateless mode has no sessions, so DELETE is not needed");
}

function createMcpServer(writeAccess: WriteAccess): McpServer {
  const server = new McpServer(SERVER_INFO);

  for (const tool of mcpTools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        // Annotations are only for client display; the write-protection gate judges independently, fail-closed (defaults to displaying as "writes to the database")
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
    // fail-closed: any tool that doesn't explicitly declare readOnlyHint: true is treated as "requires a token"
    const needsAdmin = tool.annotations?.readOnlyHint !== true;
    if (needsAdmin) {
      const allowedAnonymous = tool.anonymousWriteWhen?.(args) === true;
      if (!writeAccess.authorized && !allowedAnonymous) {
        return {
          content: [
            {
              type: "text",
              text: `Tool ${tool.name} execution denied: ${writeAccess.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    const result = await tool.handler(args, { anonymous: !writeAccess.authorized });

    // A feature's tool may return an MCP result directly (with a content array, e.g. export_results);
    // otherwise, uniformly serialize the result into a block of JSON text
    if (isMcpContentResult(result)) return result;
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    // The raw error only goes into server-side logs; what's returned to the caller is a readable,
    // allowlist-filtered message (never leaking the upstream raw text/paths)
    console.error(`[mcp-server] tool ${tool.name} execution failed`, err);
    return {
      content: [
        { type: "text", text: `Tool ${tool.name} execution failed: ${safeErrorMessage(err)}` },
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
