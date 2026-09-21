/**
 * MCP tool 注解自检（可反复执行）。
 *
 * 用法：npm run test:mcp-annotations
 *
 * 约定（见 app/core/mcp-server/tools.ts 的硬约定）：
 * - 每个 tool 必须显式声明 readOnlyHint（true=只读 / false=会写库），未声明的一律 fail
 * - 只读 tool 至少 8 个、写 tool 至少 3 个
 * - 写 tool 的名字集合必须与既定清单完全一致（增删写 tool 时必须同步改这里，防止悄悄多出写入口）
 *
 * 说明：断言不把 total === 11 当唯一判据（以后合法新增只读 tool 不应误报阻断）。
 */
import { mcpTools } from "../app/core/mcp-server/tools";

// P1-1 人工复核闭环新增 8 个写 tool（apply/undo × classification/extraction/comparison/pipeline）
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
  problems.push(`有 ${unknown.length} 个 tool 没显式声明 readOnlyHint：${unknown.join(", ")}`);
}
if (readOnlyCount < 8) {
  problems.push(`只读 tool 数量不足（期望至少 8，实际 ${readOnlyCount}）`);
}
if (writeTools.length < 3) {
  problems.push(`写 tool 数量不足（期望至少 3，实际 ${writeTools.length}）`);
}
if (JSON.stringify(writeTools) !== JSON.stringify(EXPECTED_WRITE_TOOLS)) {
  problems.push(
    `写 tool 名字集合与既定清单不一致：实际 [${writeTools.join(", ")}]，期望 [${EXPECTED_WRITE_TOOLS.join(", ")}]`
  );
}

if (problems.length > 0) {
  console.error("\n注解自检失败：");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log("\nMCP tool 注解自检通过。");
