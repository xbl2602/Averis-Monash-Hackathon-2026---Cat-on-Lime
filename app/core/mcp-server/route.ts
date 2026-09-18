import { NextRequest, NextResponse } from "next/server";
import { mcpTools } from "./tools";

/**
 * MCP Server 入口——目前只是一个"能看到有哪些 tool"的占位端点，
 * 还没有接上真正的 MCP 协议握手（StreamableHTTPServerTransport）。
 *
 * TODO(负责这块的人): 用 @modelcontextprotocol/sdk 的 McpServer +
 * StreamableHTTPServerTransport，把 mcpTools 里每个 tool 的
 * {name, description, inputSchema, handler} 注册成真正的 MCP tool，
 * 让 Claude Desktop / 其他 MCP client 能连上来调用。
 * 官方文档：https://modelcontextprotocol.io ，重点看 "Streamable HTTP transport"
 * 这一节，不要用 stdio transport（原因见 CLAUDE.md "产品形态要求"）。
 *
 * 这个占位端点现在只是把 tool 列表用 JSON 的方式列出来，方便先确认"汇总注册"
 * 这一步的 wiring 是通的——从各个 feature 模块的 mcp 文件夹导出、被这里 import 进来。
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    status: "not_implemented",
    message: "MCP 协议握手还没接上，这里先列出已注册的 tool 定义作为占位",
    tools: mcpTools.map((t) => ({ name: t.name, description: t.description })),
  });
}
