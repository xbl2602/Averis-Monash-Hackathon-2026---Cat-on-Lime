/**
 * MCP handshake smoke test (the same script is used locally and in production, only the URL changes).
 *
 * Usage:
 *   node scripts/mcp-smoke.mjs                                  # defaults to testing local http://localhost:3000/core/mcp-server
 *   node scripts/mcp-smoke.mjs http://localhost:3000/core/mcp-server
 *   node scripts/mcp-smoke.mjs https://hackathonaveris.vercel.app/core/mcp-server
 *
 * Runs four steps, exiting with code 1 if any step fails:
 *   1. initialize (protocol version/server name)
 *   2. notifications/initialized (the notification required by the spec, no response body)
 *   3. tools/list (should list 11 tools)
 *   4. tools/call get_stats (a real call to a tool, to verify the handler and the database path)
 *
 * The server is a stateless Streamable HTTP + JSON response mode (see app/core/mcp-server/route.ts),
 * so every step is an independent POST and doesn't need a session id.
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

  // JSON response mode returns plain JSON directly; if this is switched to SSE mode later, this is a minimal compatibility shim
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
        throw new Error(`Response is not valid JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
      }
    }
  }

  return { status: res.status, json };
}

function expectResult(response, step) {
  if (!response.json) {
    throw new Error(`${step} returned no content (HTTP ${response.status})`);
  }
  if (response.json.error) {
    throw new Error(`${step} returned a JSON-RPC error: ${response.json.error.message}`);
  }
  if (response.status !== 200) {
    throw new Error(`${step} HTTP ${response.status}`);
  }
  return response.json.result;
}

async function main() {
  console.log(`MCP smoke test target: ${url}\n`);

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
    `[1/4] initialize OK (protocol ${init.protocolVersion}, server ${init.serverInfo?.name} ${init.serverInfo?.version})`
  );

  // 2. initialized notification (required by the spec; the server returns 202)
  const notified = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  if (notified.status !== 202 && notified.status !== 200) {
    throw new Error(`notifications/initialized expected 202/200, got HTTP ${notified.status}`);
  }
  console.log(`[2/4] notifications/initialized OK (HTTP ${notified.status})`);

  // 3. tools/list
  const list = expectResult(
    await post({ jsonrpc: "2.0", id: nextId(), method: "tools/list", params: {} }),
    "tools/list"
  );
  const names = (list.tools || []).map((tool) => tool.name);
  console.log(`[3/4] tools/list OK (${names.length} total: ${names.join(", ")})`);

  // 4. a real call to a read-only tool, to verify the logic/database path
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
    throw new Error(`get_stats execution failed: ${String(text).slice(0, 200)}`);
  }
  let summary = "(could not parse returned text)";
  try {
    const stats = JSON.parse(text);
    summary = `total_emails=${stats.total_emails} processed=${stats.processed} pending=${stats.pending} failed=${stats.failed}`;
  } catch {
    summary = String(text).slice(0, 120);
  }
  console.log(`[4/4] tools/call get_stats OK (${summary})`);

  console.log("\nAll handshake steps passed.");
}

main().catch((err) => {
  console.error(`\nHandshake failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
