/**
 * MCP 握手冒烟测试（本地和线上用同一个脚本，只换 URL）。
 *
 * 用法：
 *   node scripts/mcp-smoke.mjs                                  # 默认测本地 http://localhost:3000/core/mcp-server
 *   node scripts/mcp-smoke.mjs http://localhost:3000/core/mcp-server
 *   node scripts/mcp-smoke.mjs https://hackathonaveris.vercel.app/core/mcp-server
 *
 * 做四步，任何一步失败就退出码 1：
 *   1. initialize（协议版本/服务名）
 *   2. notifications/initialized（规范要求的通知，无响应体）
 *   3. tools/list（应列出 7 个 tool）
 *   4. tools/call get_stats（真实调用一个 tool，验证 handler 和数据库链路）
 *
 * 服务器是无状态 Streamable HTTP + JSON 响应模式（见 app/core/mcp-server/route.ts），
 * 所以每一步都是独立的 POST，不需要带 session id。
 */

const DEFAULT_URL = "http://localhost:3000/core/mcp-server";
const PROTOCOL_VERSION = "2025-06-18";

const url = process.argv[2] || DEFAULT_URL;

let requestId = 0;

function nextId() {
  requestId += 1;
  return requestId;
}

async function post(body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";

  // JSON 响应模式直接是 JSON；如果以后改成 SSE 模式，这里做个最小兼容
  let json = null;
  if (text) {
    if (contentType.includes("text/event-stream")) {
      const dataLines = text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      json = dataLines.length ? JSON.parse(dataLines.join("")) : null;
    } else {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`响应不是合法 JSON（HTTP ${res.status}）：${text.slice(0, 200)}`);
      }
    }
  }

  return { status: res.status, json };
}

function expectResult(response, step) {
  if (!response.json) {
    throw new Error(`${step} 没有返回内容（HTTP ${response.status}）`);
  }
  if (response.json.error) {
    throw new Error(`${step} 返回 JSON-RPC 错误：${response.json.error.message}`);
  }
  if (response.status !== 200) {
    throw new Error(`${step} HTTP ${response.status}`);
  }
  return response.json.result;
}

async function main() {
  console.log(`MCP 冒烟测试目标：${url}\n`);

  // 1. initialize
  const init = expectResult(
    await post({
      jsonrpc: "2.0",
      id: nextId(),
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "mcp-smoke", version: "1.0.0" },
      },
    }),
    "initialize"
  );
  console.log(
    `[1/4] initialize OK（协议 ${init.protocolVersion}，服务 ${init.serverInfo?.name} ${init.serverInfo?.version}）`
  );

  // 2. initialized 通知（规范要求，服务器返回 202）
  const notified = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  if (notified.status !== 202 && notified.status !== 200) {
    throw new Error(`notifications/initialized 期望 202/200，收到 HTTP ${notified.status}`);
  }
  console.log(`[2/4] notifications/initialized OK（HTTP ${notified.status}）`);

  // 3. tools/list
  const list = expectResult(
    await post({ jsonrpc: "2.0", id: nextId(), method: "tools/list", params: {} }),
    "tools/list"
  );
  const names = (list.tools || []).map((tool) => tool.name);
  console.log(`[3/4] tools/list OK（${names.length} 个：${names.join(", ")}）`);

  // 4. 真实调用一个只读 tool，验证 logic/数据库链路
  const call = expectResult(
    await post({
      jsonrpc: "2.0",
      id: nextId(),
      method: "tools/call",
      params: { name: "get_stats", arguments: {} },
    }),
    "tools/call get_stats"
  );
  const text = call.content?.find((item) => item.type === "text")?.text;
  if (call.isError) {
    throw new Error(`get_stats 执行失败：${String(text).slice(0, 200)}`);
  }
  let summary = "(无法解析返回文本)";
  try {
    const stats = JSON.parse(text);
    summary = `total_emails=${stats.total_emails} processed=${stats.processed} pending=${stats.pending} failed=${stats.failed}`;
  } catch {
    summary = String(text).slice(0, 120);
  }
  console.log(`[4/4] tools/call get_stats OK（${summary}）`);

  console.log("\n握手全部通过。");
}

main().catch((err) => {
  console.error(`\n握手失败：${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
