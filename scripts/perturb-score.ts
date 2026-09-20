/**
 * 扰动集正确性验证（P1-10 第二轮）
 *
 * 与 perturb:run 的区别：run 验证"不变性"（扰动前后输出一致），本脚本验证"正确性"
 * （对着 ground truth 用官方评分器打分），回答"分类到底对不对"。
 *
 * 做法：
 *   1. 从 Supabase 读全部 ptN_ 扰动结果；
 *   2. 对语义不变类变体（pt1~pt5、pt7~pt11、pt13、pt14）构造派生 GT：
 *      ptN_email_xxx 的期望 = 官方 GT 里 email_xxx 的标签（扰动不改语义 ⇒ 期望相同）；
 *   3. pt6（扫描件）用显式期望 GT（NEEDS_REVIEW/unreadable）；
 *   4. pt12（注入冲突值）不参与 GT 打分，由 run 报告的"不允许静默 OK"断言负责；
 *   5. 用官方 score_cli.py（scoring.py 同一实现）分别对整体和每个变体打分，
 *      并列出所有分类错判（category ≠ 派生 GT）的邮件。
 *
 * 用法：npm run perturb:score
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSupabaseServiceClient, isSupabaseServiceAvailable } from "../lib/shared/supabase";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GT_PATH = path.join(ROOT, "[!] Problem Statement", "sdoc-hackathon-docker", "data_v2", "ground_truth.json");
const MANIFEST_PATH = path.join(ROOT, "data", "perturb", "manifest.json");
const SCORE_CLI = path.join(ROOT, "[!] Problem Statement", "sdoc-hackathon-docker", "server", "score_cli.py");
const OUT_ROOT = path.join(ROOT, "private", "perturb-runs");

interface GtEntry {
  category: string;
  status: string;
  review_reason: string | null;
  has_defect: boolean;
  defect_fields: string[];
}

interface StoredRow {
  email_id: string;
  category: string | null;
  comparison_status: string | null;
  review_reason: string | null;
  defect_fields: string[] | null;
  has_defect: boolean | null;
  processing_status: string;
}

interface ManifestEntry {
  origin: string;
  variant: string;
  expectation: { kind: "same" } | { kind: "needs_review"; reason: string } | { kind: "not_ok" };
}

interface VariantScore {
  variant: string;
  scored: number;
  macroF1: number;
  macroF1Suppressed: boolean;
  accuracy: number;
  defectF1: number;
  e2eRate: number;
  e2eSuccess: number;
  e2eTotal: number;
  reliabilityRecall: number;
  categoryErrors: { id: string; origin: string; predicted: string; truth: string }[];
  statusErrors: { id: string; origin: string; predicted: string; truth: string }[];
}

/** pt12 是"注入冲突值"场景，期望是"不允许静默 OK"，不适合 GT 打分 */
const EXCLUDED_FROM_GT_SCORING = new Set(["pt12"]);

async function main() {
  await loadEnvLocal();
  if (!isSupabaseServiceAvailable()) throw new Error("缺少 SUPABASE_SERVICE_ROLE_KEY，无法读取扰动结果");

  const gt = JSON.parse(await readFile(GT_PATH, "utf-8")) as Record<string, GtEntry>;
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf-8")) as {
    mapping: Record<string, ManifestEntry>;
  };

  const supabase = getSupabaseServiceClient();
  const variants = [...new Set(Object.values(manifest.mapping).map((entry) => entry.variant))].sort();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(OUT_ROOT, `${stamp}-official`);
  await mkdir(outDir, { recursive: true });

  const results: VariantScore[] = [];
  const allSubmission: Record<string, unknown> = {};
  const allDerivedGt: Record<string, GtEntry> = {};

  const allRows: StoredRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("verification_results")
      .select("email_id,category,comparison_status,review_reason,defect_fields,has_defect,processing_status")
      .like("email_id", "pt%")
      .range(from, from + 999);
    if (error) throw new Error(`读取扰动结果失败：${error.message}`);
    allRows.push(...((data ?? []) as StoredRow[]));
    if (!data || data.length < 1000) break;
  }
  const rowsByVariant = new Map<string, StoredRow[]>();
  for (const row of allRows) {
    const variant = row.email_id.split("_")[0];
    const list = rowsByVariant.get(variant) ?? [];
    list.push(row);
    rowsByVariant.set(variant, list);
  }

  for (const variant of variants) {
    const rows = rowsByVariant.get(variant) ?? [];
    if (rows.length === 0) continue;

    const submission: Record<string, unknown> = {};
    const derivedGt: Record<string, GtEntry> = {};
    for (const row of rows) {
      const entry = manifest.mapping[row.email_id];
      if (!entry) continue;
      submission[row.email_id] = {
        category: row.category ?? "GENERAL",
        status: row.comparison_status ?? "OK",
        review_reason: row.review_reason,
        has_defect: Boolean(row.has_defect),
        defect_fields: row.defect_fields ?? [],
      };
      if (EXCLUDED_FROM_GT_SCORING.has(variant)) continue;

      const originGt = gt[entry.origin];
      if (!originGt) continue;
      if (entry.expectation.kind === "needs_review") {
        derivedGt[row.email_id] = {
          category: originGt.category,
          status: "NEEDS_REVIEW",
          review_reason: entry.expectation.reason,
          has_defect: false,
          defect_fields: [],
        };
      } else {
        derivedGt[row.email_id] = originGt;
      }
    }

    await writeFile(
      path.join(outDir, `${variant}-submission.json`),
      JSON.stringify(submission, null, 2)
    );
    await writeFile(
      path.join(outDir, `${variant}-derived-gt.json`),
      JSON.stringify(derivedGt, null, 2)
    );

    const scoredIds = Object.keys(derivedGt);
    const score = runOfficialScorer(
      path.join(outDir, `${variant}-submission.json`),
      path.join(outDir, `${variant}-derived-gt.json`)
    );

    const categoryErrors: VariantScore["categoryErrors"] = [];
    const statusErrors: VariantScore["statusErrors"] = [];
    const categoriesInGt = new Set(Object.values(derivedGt).map((entry) => entry.category));
    for (const id of scoredIds) {
      const predicted = submission[id] as { category: string; status: string };
      const truth = derivedGt[id];
      if (predicted.category !== truth.category) {
        categoryErrors.push({ id, origin: manifest.mapping[id].origin, predicted: predicted.category, truth: truth.category });
      }
      if (predicted.status !== truth.status) {
        statusErrors.push({ id, origin: manifest.mapping[id].origin, predicted: predicted.status, truth: truth.status });
      }
    }

    results.push({
      variant,
      scored: scoredIds.length,
      macroF1: score.stage1.macro_f1,
      macroF1Suppressed: categoriesInGt.size < 5,
      accuracy: score.stage1.accuracy,
      defectF1: score.stage3.defect_f1,
      e2eRate: score.end_to_end.rate,
      e2eSuccess: score.end_to_end.success,
      e2eTotal: score.end_to_end.total,
      reliabilityRecall: score.reliability.escalation_recall,
      categoryErrors,
      statusErrors,
    });

    Object.assign(allSubmission, submission);
    Object.assign(allDerivedGt, derivedGt);
  }

  await writeFile(path.join(outDir, "all-submission.json"), JSON.stringify(allSubmission, null, 2));
  await writeFile(path.join(outDir, "all-derived-gt.json"), JSON.stringify(allDerivedGt, null, 2));
  const overall = runOfficialScorer(
    path.join(outDir, "all-submission.json"),
    path.join(outDir, "all-derived-gt.json")
  );

  await writeFile(path.join(outDir, "scores.json"), JSON.stringify({ generatedAt: new Date().toISOString(), perVariant: results, overall }, null, 2));
  await writeFile(path.join(outDir, "summary.md"), buildSummary(results, overall));
  printSummary(results, overall, outDir);
}

function runOfficialScorer(submissionPath: string, gtPath: string) {
  const result = spawnSync("python", [SCORE_CLI, submissionPath, "--ground-truth", gtPath, "--json"], {
    encoding: "utf-8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`官方评分器执行失败：${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function buildSummary(results: VariantScore[], overall: Record<string, any>): string {
  const lines = [
    `# 扰动集正确性验证（官方评分器，派生 GT）— ${new Date().toISOString()}`,
    "",
    "判定口径：语义不变变体（pt1~pt5、pt7~pt11、pt13、pt14）的派生 GT = 官方 GT 原标签；",
    "pt6 用显式期望（NEEDS_REVIEW/unreadable）；pt12 为冲突注入场景，不参与 GT 打分。",
    "",
    "| 变体 | 计分条数 | 分类 accuracy | 分类 macro-F1 | 缺陷 F1 | 端到端 | 升级 recall | 分类错判 | status 错判 |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const item of results) {
    const macro = item.macroF1Suppressed ? "n/a" : item.macroF1.toFixed(3);
    lines.push(
      `| ${item.variant} | ${item.scored} | ${item.accuracy.toFixed(3)} | ${macro} | ${item.defectF1.toFixed(3)} | ${item.e2eSuccess}/${item.e2eTotal} | ${item.reliabilityRecall.toFixed(3)} | ${item.categoryErrors.length} | ${item.statusErrors.length} |`
    );
  }
  lines.push("", "## 汇总（全部参与打分的扰动邮件）", "");
  lines.push(
    `- 分类 accuracy=${overall.stage1.accuracy.toFixed(3)}，macro-F1=${overall.stage1.macro_f1.toFixed(3)}`,
    `- 缺陷 F1=${overall.stage3.defect_f1.toFixed(3)}`,
    `- 端到端=${overall.end_to_end.success}/${overall.end_to_end.total}（${overall.end_to_end.rate.toFixed(3)}）`,
    `- 升级 recall=${overall.reliability.escalation_recall.toFixed(3)}，precision=${overall.reliability.escalation_precision.toFixed(3)}`,
    `- 官方加权分（同一公式）=${overall.final_score.toFixed(4)}`
  );
  const categoryErrorLines: string[] = [];
  for (const item of results) {
    for (const err of item.categoryErrors) {
      categoryErrorLines.push(`- ${err.id}（原 ${err.origin}）：GT=${err.truth}，实际=${err.predicted}`);
    }
  }
  lines.push("", `## 分类错判明细（共 ${categoryErrorLines.length} 条）`, "");
  lines.push(...(categoryErrorLines.length ? categoryErrorLines : ["（无）"]));
  return lines.join("\n");
}

function printSummary(results: VariantScore[], overall: Record<string, any>, outDir: string) {
  console.log("\n============ 扰动集正确性验证（官方评分器 + 派生 GT）============");
  console.log("变体    计分   accuracy  macroF1  defectF1   e2e        statusErr  分类Err");
  for (const item of results) {
    const macro = item.macroF1Suppressed ? "n/a" : item.macroF1.toFixed(3);
    console.log(
      `${item.variant.padEnd(7)}${String(item.scored).padStart(5)}   ${item.accuracy.toFixed(3).padStart(7)}  ${macro.padStart(7)}  ${item.defectF1.toFixed(3).padStart(7)}   ${(item.e2eSuccess + "/" + item.e2eTotal).padStart(8)}  ${String(item.statusErrors.length).padStart(9)}  ${String(item.categoryErrors.length).padStart(7)}`
    );
  }
  console.log("（macroF1 标 n/a = 该子集缺少部分类别，5 类 macro 在子集上没有意义；看汇总行）");
  console.log("");
  console.log(`总计（${overall.n_emails} 封）：accuracy=${overall.stage1.accuracy.toFixed(3)} macroF1=${overall.stage1.macro_f1.toFixed(3)} defectF1=${overall.stage3.defect_f1.toFixed(3)} e2e=${overall.end_to_end.success}/${overall.end_to_end.total} 官方加权分=${overall.final_score.toFixed(4)}`);
  const totalCategoryErrors = results.reduce((sum, item) => sum + item.categoryErrors.length, 0);
  console.log(`分类错判合计：${totalCategoryErrors} 条（明细见 summary.md）`);
  console.log(`产物目录：${path.relative(ROOT, outDir)}（scores.json / summary.md / 各变体 submission+derived-gt）`);
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

main().catch((err) => {
  console.error("\n正确性验证失败：", err);
  process.exit(1);
});
