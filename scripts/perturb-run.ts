/**
 * 扰动集执行器（P1-10）
 *
 * 读 data/perturb 的全部扰动邮件 → 跑完整流水线 → 写入 Supabase 同一张
 * verification_results 表（与正式 520 封混在一张表里，靠 email_id 前缀 "ptN_" 隔离）
 * → 按 manifest 里每个变体的"期望结果"逐条断言（不再一律"与原结果一致"）。
 *
 * 期望类型：
 *   same         与原 520 封结果完全一致（结构变形类）
 *   needs_review 必须为 NEEDS_REVIEW 且原因匹配（如扫描件 → unreadable）
 *   not_ok       不允许静默 OK（单文档内冲突值这类应升级或报缺陷）
 *
 * 用法（项目根目录）：
 *   npm run perturb:run              # 全量
 *   npm run perturb:run -- --limit=40   # 只跑前 40 封（调试）
 *   npm run perturb:run -- --no-write   # 只算不写库
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAttachmentText } from "../lib/shared/attachment-text";
import {
  computeInputHash,
  runBatchPipeline,
  type PipelineAttachment,
  type PipelineEmailInput,
  type PipelineOutcome,
} from "../lib/shared/pipeline";
import { getSupabaseServiceClient, isSupabaseServiceAvailable } from "../lib/shared/supabase";
import {
  buildFailureRow,
  buildSuccessRow,
  loadStoredVerificationRows,
  upsertVerificationRows,
  type StoredVerificationRow,
} from "../lib/shared/verification-store";
import type { EmailVerificationResult, InboxEmail } from "../lib/shared/types";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PERTURB_DIR = path.join(ROOT, "data", "perturb");
const REPORT_ROOT = path.join(ROOT, "private", "perturb-runs");

const args = process.argv.slice(2);
const NO_WRITE = args.includes("--no-write");
const LIMIT = (() => {
  const arg = args.find((item) => item.startsWith("--limit="));
  return arg ? Number(arg.split("=")[1]) : Number.POSITIVE_INFINITY;
})();

type Expectation =
  | { kind: "same" }
  | { kind: "needs_review"; reason: string }
  | { kind: "not_ok" };

interface ManifestEntry {
  origin: string;
  variant: string;
  expectation: Expectation;
}

interface PerturbReport {
  generatedAt: string;
  engineExpectations: string;
  total: number;
  failedRequests: number;
  perVariant: Record<
    string,
    { description: string; expectation: string; total: number; pass: number; fail: number; failed: number }
  >;
  mismatches: { id: string; origin: string; variant: string; expected: string; actual: string }[];
}

let manifest: { variants: Record<string, { description: string }>; mapping: Record<string, ManifestEntry> } = {
  variants: {},
  mapping: {},
};

async function main() {
  await loadEnvLocal();
  manifest = JSON.parse(await readFile(path.join(PERTURB_DIR, "manifest.json"), "utf-8"));

  const inputs = await loadPerturbInputs();
  console.log(`加载扰动邮件：${inputs.length} 封（共 ${Object.keys(manifest.variants).length} 个变体）`);

  const startedAt = Date.now();
  const outcome = await runBatchPipeline(inputs, {
    concurrency: 4,
    onProgress: (done, total, emailId) => {
      if (done % 200 === 0 || done === total) console.log(`  进度 ${done}/${total}（最近：${emailId}）`);
    },
  });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`完成：成功 ${outcome.succeeded.length}，失败 ${outcome.failed.length}，耗时 ${elapsed}s`);

  if (!NO_WRITE && isSupabaseServiceAvailable()) {
    const rows = [
      ...outcome.succeeded.map(({ input, outcome: result }) =>
        buildSuccessRow(input, result, computeInputHash(input))
      ),
      ...outcome.failed.map(({ input, error }) =>
        buildFailureRow(input, error, computeInputHash(input))
      ),
    ];
    await upsertVerificationRows(rows);
    console.log(`已写入 verification_results：${rows.length} 行（upsert，前缀隔离）`);
  } else if (!NO_WRITE) {
    console.log("（没有 service key，跳过写库）");
  }

  const originals = await loadStoredVerificationRows();
  const report = buildReport(outcome.succeeded, outcome.failed, originals);
  await saveReport(report);
  printReport(report);
}

function describeExpectation(expectation: Expectation): string {
  if (expectation.kind === "same") return "与原结果一致";
  if (expectation.kind === "needs_review") return `NEEDS_REVIEW/${expectation.reason}`;
  return "不允许静默 OK";
}

function evaluateExpectation(
  result: EmailVerificationResult,
  original: StoredVerificationRow | undefined,
  expectation: Expectation
): string[] {
  if (expectation.kind === "same") {
    if (!original || original.processing_status !== "ok") return ["缺少原结果，无法对比"];
    return diffResult(result, original);
  }
  if (expectation.kind === "needs_review") {
    if (result.status === "NEEDS_REVIEW" && result.review_reason === expectation.reason) return [];
    return [
      `期望 NEEDS_REVIEW/${expectation.reason}，实际 ${result.status}/${result.review_reason ?? "-"}`,
    ];
  }
  if (result.status !== "OK") return [];
  return [`期望非 OK（应升级或报缺陷），实际 OK（defect_fields=${JSON.stringify(result.defect_fields)}）`];
}

function buildReport(
  succeeded: { input: PipelineEmailInput; outcome: PipelineOutcome }[],
  failed: { input: PipelineEmailInput; error: unknown }[],
  originals: Map<string, StoredVerificationRow>
): PerturbReport {
  const perVariant: PerturbReport["perVariant"] = {};
  const mismatches: PerturbReport["mismatches"] = [];

  const ensure = (variant: string) => {
    perVariant[variant] ??= {
      description: manifest.variants[variant]?.description ?? "",
      expectation: "与原结果一致",
      total: 0,
      pass: 0,
      fail: 0,
      failed: 0,
    };
    return perVariant[variant];
  };

  for (const { input, outcome } of succeeded) {
    const id = input.email.email_id;
    const variant = id.split("_")[0];
    const entry = manifest.mapping[id] ?? { origin: id.replace(/^pt\d+_/, ""), variant, expectation: { kind: "same" as const } };
    const stats = ensure(variant);
    stats.expectation = describeExpectation(entry.expectation);
    stats.total += 1;

    const differences = evaluateExpectation(outcome.result, originals.get(entry.origin), entry.expectation);
    if (differences.length === 0) {
      stats.pass += 1;
    } else {
      stats.fail += 1;
      mismatches.push({
        id,
        origin: entry.origin,
        variant,
        expected: describeExpectation(entry.expectation),
        actual: `${outcome.result.status}/${outcome.result.review_reason ?? "-"}/[${outcome.result.defect_fields.join(",")}]`,
      });
      if (differences[0]) mismatches[mismatches.length - 1].expected += `（${differences.join("；")}）`;
    }
  }

  for (const { input, error } of failed) {
    const id = input.email.email_id;
    const variant = id.split("_")[0];
    const stats = ensure(variant);
    stats.total += 1;
    stats.failed += 1;
    mismatches.push({
      id,
      origin: id.replace(/^pt\d+_/, ""),
      variant,
      expected: "处理成功",
      actual: `处理失败：${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    engineExpectations: "same=与原结果一致；needs_review=必须升级且原因匹配；not_ok=不允许静默 OK",
    total: succeeded.length + failed.length,
    failedRequests: failed.length,
    perVariant,
    mismatches,
  };
}

function diffResult(result: EmailVerificationResult, original: StoredVerificationRow): string[] {
  const differences: string[] = [];
  if (result.category !== original.category) {
    differences.push(`category: ${original.category} → ${result.category}`);
  }
  if (result.status !== original.comparison_status) {
    differences.push(`status: ${original.comparison_status} → ${result.status}`);
  }
  if ((result.review_reason ?? null) !== (original.review_reason ?? null)) {
    differences.push(`review_reason: ${original.review_reason} → ${result.review_reason}`);
  }
  const mine = [...result.defect_fields].sort().join(",");
  const theirs = [...(original.defect_fields ?? [])].sort().join(",");
  if (mine !== theirs) differences.push(`defect_fields: [${theirs}] → [${mine}]`);
  if (Boolean(result.has_defect) !== Boolean(original.has_defect)) {
    differences.push(`has_defect: ${original.has_defect} → ${result.has_defect}`);
  }
  return differences;
}

async function saveReport(report: PerturbReport) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(REPORT_ROOT, stamp);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "report.json"), JSON.stringify(report, null, 2), "utf-8");

  const lines = [
    `# 扰动测试报告（${report.generatedAt}）`,
    "",
    `总计 ${report.total} 封，请求失败 ${report.failedRequests} 封。判定口径：${report.engineExpectations}`,
    "",
    "| 变体 | 期望 | 含义 | 总数 | 通过 | 不通过 | 失败 |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const [variant, stats] of Object.entries(report.perVariant)) {
    lines.push(
      `| ${variant} | ${stats.expectation} | ${stats.description} | ${stats.total} | ${stats.pass} | ${stats.fail} | ${stats.failed} |`
    );
  }
  if (report.mismatches.length > 0) {
    lines.push("", `## 不通过明细（前 100 条，共 ${report.mismatches.length}）`, "");
    for (const item of report.mismatches.slice(0, 100)) {
      lines.push(`- ${item.id}（原 ${item.origin}）期望 ${item.expected}；实际 ${item.actual}`);
    }
  }
  await writeFile(path.join(dir, "summary.md"), lines.join("\n"), "utf-8");
  console.log(`报告已保存：${path.relative(ROOT, dir)}`);
}

function printReport(report: PerturbReport) {
  console.log("\n================ 扰动期望断言报告 ================");
  for (const [variant, stats] of Object.entries(report.perVariant)) {
    const rate = stats.total === 0 ? "n/a" : `${((stats.pass / stats.total) * 100).toFixed(1)}%`;
    console.log(
      `  ${variant} [${stats.expectation}]: 通过 ${stats.pass}/${stats.total} (${rate})  不通过 ${stats.fail}  失败 ${stats.failed}`
    );
  }
  console.log(`  总计: ${report.total} 封，不通过 ${report.mismatches.length} 条`);
  for (const item of report.mismatches.slice(0, 25)) {
    console.log(`  [不通过] ${item.id}: 期望 ${item.expected}；实际 ${item.actual}`);
  }
  if (report.mismatches.length > 25) {
    console.log(`  ...（其余 ${report.mismatches.length - 25} 条见报告文件）`);
  }
}

async function loadPerturbInputs(): Promise<PipelineEmailInput[]> {
  const inboxDir = path.join(PERTURB_DIR, "inbox");
  const files = (await readdir(inboxDir)).filter((f) => f.endsWith(".json")).sort();
  const selected = Number.isFinite(LIMIT) ? files.slice(0, LIMIT) : files;
  const inputs: PipelineEmailInput[] = [];

  for (const file of selected) {
    const email = JSON.parse(await readFile(path.join(inboxDir, file), "utf-8")) as InboxEmail;
    const attachments: PipelineAttachment[] = [];
    for (const rel of email.attachments ?? []) {
      const abs = path.resolve(PERTURB_DIR, rel);
      if (!abs.startsWith(PERTURB_DIR + path.sep)) {
        throw new Error(`扰动附件路径越界：${rel}`);
      }
      try {
        const buffer = await readFile(abs);
        const parsed = await extractAttachmentText(path.basename(abs), buffer);
        attachments.push({ path: rel, parseStatus: parsed.status, text: parsed.text });
      } catch {
        attachments.push({ path: rel, parseStatus: "unreadable", text: "" });
      }
    }
    inputs.push({ email, attachments });
  }
  return inputs;
}

async function loadEnvLocal() {
  let raw = "";
  try {
    raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

main().catch((err) => {
  console.error("\n扰动测试失败：", err);
  process.exit(1);
});
