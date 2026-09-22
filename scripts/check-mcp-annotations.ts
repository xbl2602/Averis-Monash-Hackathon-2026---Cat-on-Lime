/**
 * MCP tool annotation self-check (safe to run repeatedly).
 *
 * Usage: npm run test:mcp-annotations
 *
 * Conventions (see the hard rules in app/core/mcp-server/tools.ts):
 * - Every tool must explicitly declare readOnlyHint (true = read-only / false = writes to the database); undeclared always fails
 * - At least 8 read-only tools and at least 3 write tools
 * - The set of write-tool names must exactly match the fixed list below (update this file in lockstep whenever a write tool is added or removed, to prevent a new write entry point from sneaking in unnoticed)
 *
 * Note: the assertions don't treat total === 11 as the sole criterion (a legitimate new read-only tool added later shouldn't be falsely blocked).
 */
import { mcpTools } from "../app/core/mcp-server/tools";

// P1-1 manual review loop added 8 write tools (apply/undo x classification/extraction/comparison/pipeline)
const EXPECTED_WRITE_TOOLS = [
  "run_batch",
  "sync_gmail",
  "classify_uploaded_document",
  "apply_classification_review_action",
  "undo_classification_review_action",
  "apply_extraction_review_action",
  "undo_extraction_review_action",
  "apply_comparison_review_action",
  "undo_comparison_review_action",
  "apply_pipeline_review_action",
  "undo_pipeline_review_action",
].sort();

const total = mcpTools.length;
const unknown = mcpTools
  .filter((tool) => tool.annotations?.readOnlyHint === undefined)
  .map((tool) => tool.name);
const readOnlyCount = mcpTools.filter((tool) => tool.annotations?.readOnlyHint === true).length;
const writeTools = mcpTools
  .filter((tool) => tool.annotations?.readOnlyHint === false)
  .map((tool) => tool.name)
  .sort();

console.log(
  JSON.stringify({ total, readOnly: readOnlyCount, write: writeTools, unknown }, null, 2)
);

const problems: string[] = [];
if (unknown.length > 0) {
  problems.push(`${unknown.length} tool(s) did not explicitly declare readOnlyHint: ${unknown.join(", ")}`);
}
if (readOnlyCount < 8) {
  problems.push(`Not enough read-only tools (expected at least 8, got ${readOnlyCount})`);
}
if (writeTools.length < 3) {
  problems.push(`Not enough write tools (expected at least 3, got ${writeTools.length})`);
}
if (JSON.stringify(writeTools) !== JSON.stringify(EXPECTED_WRITE_TOOLS)) {
  problems.push(
    `Write-tool name set doesn't match the fixed list: actual [${writeTools.join(", ")}], expected [${EXPECTED_WRITE_TOOLS.join(", ")}]`
  );
}

if (problems.length > 0) {
  console.error("\nAnnotation self-check failed:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log("\nMCP tool annotation self-check passed.");
