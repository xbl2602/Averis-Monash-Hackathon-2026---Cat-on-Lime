/**
 * 全量评测脚本（本地跑）：
 * 样例数据 → 引擎跑完整流水线 → 对照 ground_truth 算分 → 增量写入 verification_results。
 *
 * 用法（在项目根目录）：
 *   npm run evaluate                 # 跑全量（增量：指纹和版本没变的邮件直接跳过）
 *   npm run evaluate -- --force      # 忽略指纹强制重算
 *   npm run evaluate -- --limit=50   # 只跑前 50 封（调试）
 *   npm run evaluate -- --no-write   # 只算分，不写库
 *
 * ground_truth 仅用于自测/调参（官方 Discord 已澄清允许）；不要把它写进最终提交文件。
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeInputHash,
  PIPELINE_LOGIC_VERSION,
  runBatchPipeline,
  type PipelineEmailInput,
  type PipelineOutcome,
} from "../lib/shared/pipeline";
import { loadSamplePipelineInputs } from "../lib/shared/sample-inputs";
import { getSupabaseServiceClient, isSupabaseServiceAvailable } from "../lib/shared/supabase";
import {
  buildSuccessRow,
  loadStoredVerificationRows,
  upsertVerificationRows,
} from "../lib/shared/verification-store";
import type { EmailCategory, EmailVerificationResult } from "../lib/shared/types";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE_DIR = path.join(ROOT, "data", "sample");
const GT_PATH = path.join(
  ROOT,
  "[!] Problem Statement",
  "sdoc-hackathon-docker",
  "data_v2",
  "ground_truth.json"
);

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const NO_WRITE = args.includes("--no-write");
const LIMIT = (() => {
  const arg = args.find((item) => item.startsWith("--limit="));
  return arg ? Number(arg.split("=")[1]) : Number.POSITIVE_INFINITY;
})();

async function main() {
  await loadEnvLocal();

  const gt = JSON.parse(await readFile(GT_PATH, "utf-8")) as Record<string, EmailVerificationResult>;
  const emailFiles = (await readdir(path.join(SAMPLE_DIR, "inbox"))).filter((f) => f.endsWith(".json")).sort();
  console.log(`样例邮件：${emailFiles.length} 封`);

  const inputs = await loadSamplePipelineInputs(
    undefined,
    Number.isFinite(LIMIT) ? LIMIT : undefined
  );

  // 增量：读已有结果，指纹+版本都没变、且上次成功的直接复用
  const existing =
    !FORCE && isSupabaseServiceAvailable() ? await loadStoredVerificationRows() : new Map();

  const hashByEmail = new Map<string, string>();
  const toRun: PipelineEmailInput[] = [];
  const reused: { email_id: string; result: EmailVerificationResult; hash: string }[] = [];
  for (const input of inputs) {
    const hash = computeInputHash(input);
    hashByEmail.set(input.email.email_id, hash);
    const row = existing.get(input.email.email_id);
    if (
      row &&
      row.processing_status === "ok" &&
      row.input_hash === hash &&
      row.logic_version === PIPELINE_LOGIC_VERSION &&
      row.category &&
      row.comparison_status
    ) {
      reused.push({
        email_id: input.email.email_id,
        result: {
          category: row.category,
          status: row.comparison_status,
          review_reason: row.review_reason,
          defect_fields: row.defect_fields as EmailVerificationResult["defect_fields"],
          has_defect: row.has_defect ?? false,
        },
        hash,
      });
    } else {
      toRun.push(input);
    }
  }
  console.log(`增量跳过：${reused.length} 封；本次要跑：${toRun.length} 封；引擎版本：${PIPELINE_LOGIC_VERSION}`);

  const cacheCountBefore = await countCacheRows();
  const startedAt = Date.now();
  const outcome = await runBatchPipeline(toRun, {
    concurrency: 4,
    onProgress: (done, total, emailId) => {
      if (done % 25 === 0 || done === total) console.log(`  进度 ${done}/${total}（最近：${emailId}）`);
    },
  });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`完成：成功 ${outcome.succeeded.length}，失败 ${outcome.failed.length}，耗时 ${elapsed}s`);
  for (const failure of outcome.failed) {
    console.error(`  [失败] ${failure.input.email.email_id}: ${failure.error instanceof Error ? failure.error.message : failure.error}`);
  }

  // 汇总结果（旧结果 + 新结果）
  const ours = new Map<string, EmailVerificationResult>();
  for (const item of reused) ours.set(item.email_id, item.result);
  for (const item of outcome.succeeded) ours.set(item.input.email.email_id, item.outcome.result);

  printReport(ours, gt);
  printEngineSummary(outcome.succeeded);

  if (!NO_WRITE && isSupabaseServiceAvailable() && outcome.succeeded.length > 0) {
    await writeResults(outcome.succeeded, hashByEmail);
    const cacheCountAfter = await countCacheRows();
    if (cacheCountBefore !== null && cacheCountAfter !== null) {
      console.log(`模型调用缓存：新增 ${cacheCountAfter - cacheCountBefore} 条，累计 ${cacheCountAfter} 条`);
    }
  } else if (!NO_WRITE && !isSupabaseServiceAvailable()) {
    console.log("（没有 service key，跳过写库；缓存也没启用）");
  }
}

function resultKey(result: EmailVerificationResult) {
  return JSON.stringify({
    category: result.category,
    status: result.status,
    review_reason: result.review_reason,
    defect_fields: [...result.defect_fields].sort(),
    has_defect: result.has_defect,
  });
}

function printReport(ours: Map<string, EmailVerificationResult>, gt: Record<string, EmailVerificationResult>) {
  const categories: EmailCategory[] = ["BL_COMPARISON", "SI_REQUEST", "INVOICE_QUERY", "GENERAL", "SPAM"];
  // 只统计"这次真正有结果"的邮件（--limit 调试时不会拿全量当分母）
  const ids = Object.keys(gt).filter((id) => ours.has(id));

  // 阶段一：分类 macro-F1
  const perCategory = categories.map((category) => {
    let tp = 0, fp = 0, fn = 0;
    for (const id of ids) {
      const mine = ours.get(id)?.category;
      const truth = gt[id].category;
      if (mine === category && truth === category) tp += 1;
      else if (mine === category && truth !== category) fp += 1;
      else if (mine !== category && truth === category) fn += 1;
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { category, tp, fp, fn, precision, recall, f1 };
  });
  const macroF1 = perCategory.reduce((sum, item) => sum + item.f1, 0) / categories.length;

  // 端到端（五个字段全对）
  let endToEnd = 0;
  let statusHit = 0;
  let reviewHit = 0;
  let reviewTotal = 0;
  let tpDefect = 0, fpDefect = 0, fnDefect = 0;
  const trapProblems: string[] = [];

  for (const id of ids) {
    const mine = ours.get(id);
    const truth = gt[id];
    if (!mine) continue;
    if (resultKey(mine) === resultKey(truth)) endToEnd += 1;
    if (mine.status === truth.status) statusHit += 1;
    if (truth.status === "NEEDS_REVIEW") {
      reviewTotal += 1;
      if (mine.review_reason === truth.review_reason) reviewHit += 1;
      else trapProblems.push(`${id} 原因：实际=${truth.review_reason} 我方=${mine.review_reason ?? "(没判review)"}`);
    }
    const mineDefects = new Set(mine.defect_fields);
    const truthDefects = new Set(truth.defect_fields);
    for (const field of truthDefects) if (mineDefects.has(field)) tpDefect += 1; else fnDefect += 1;
    for (const field of mineDefects) if (!truthDefects.has(field)) fpDefect += 1;

    if (Number(id.slice(6)) >= 501 && resultKey(mine) !== resultKey(truth)) {
      trapProblems.push(`${id} 整条：实际=${truth.status}/${truth.review_reason ?? "-"}/${JSON.stringify(truth.defect_fields)} 我方=${mine.status}/${mine.review_reason ?? "-"}/${JSON.stringify(mine.defect_fields)}`);
    } else if (resultKey(mine) !== resultKey(truth)) {
      trapProblems.push(`${id} 整条：实际=${truth.category}/${truth.status}/${truth.review_reason ?? "-"}/${JSON.stringify(truth.defect_fields)} 我方=${mine.category}/${mine.status}/${mine.review_reason ?? "-"}/${JSON.stringify(mine.defect_fields)}`);
    }
  }

  const precise = (n: number, d: number) => (d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}%`);
  const defectPrecision = tpDefect + fpDefect === 0 ? 0 : tpDefect / (tpDefect + fpDefect);
  const defectRecall = tpDefect + fnDefect === 0 ? 0 : tpDefect / (tpDefect + fnDefect);
  const defectF1 = defectPrecision + defectRecall === 0 ? 0 : (2 * defectPrecision * defectRecall) / (defectPrecision + defectRecall);

  console.log("\n================ 评测报告 ================");
  console.log(`阶段一 分类 macro-F1: ${(macroF1 * 100).toFixed(2)}%`);
  for (const item of perCategory) {
    console.log(`  ${item.category.padEnd(14)} P=${precise(item.precision, 1)} R=${precise(item.recall, 1)} F1=${precise(item.f1, 1)} (tp=${item.tp} fp=${item.fp} fn=${item.fn})`);
  }
  console.log(`\n端到端 完全一致: ${endToEnd}/${ids.length} (${precise(endToEnd, ids.length)})`);
  console.log(`status 命中: ${statusHit}/${ids.length} (${precise(statusHit, ids.length)})`);
  console.log(`NEEDS_REVIEW 原因命中: ${reviewHit}/${reviewTotal} (${precise(reviewHit, reviewTotal)})`);
  console.log(`缺陷字段: TP=${tpDefect} FP=${fpDefect} FN=${fnDefect} | P=${precise(defectPrecision, 1)} R=${precise(defectRecall, 1)} F1=${precise(defectF1, 1)}`);

  if (trapProblems.length) {
    console.log("\n--- 陷阱/不一致明细 ---");
    for (const line of trapProblems) console.log(`  ${line}`);
  }
}

function printEngineSummary(succeeded: { outcome: PipelineOutcome }[]) {
  const count = (label: string, get: (outcome: PipelineOutcome) => string) => {
    const stats = new Map<string, number>();
    for (const item of succeeded) {
      const key = get(item.outcome);
      stats.set(key, (stats.get(key) ?? 0) + 1);
    }
    console.log(`  ${label}: ${[...stats.entries()].map(([k, v]) => `${k}=${v}`).join(" ")}`);
  };
  console.log("\n--- 引擎使用统计（本次新跑的） ---");
  count("分类", (outcome) => outcome.meta.classifier);
  count("比对", (outcome) => outcome.meta.comparer ?? "-");
  count("抽取(SI)", (outcome) => outcome.meta.extractor.si ?? "-");
}

async function writeResults(
  succeeded: { input: PipelineEmailInput; outcome: PipelineOutcome }[],
  hashByEmail: Map<string, string>
) {
  const rows = succeeded.map(({ input, outcome }) =>
    buildSuccessRow(input, outcome, hashByEmail.get(input.email.email_id) ?? computeInputHash(input))
  );
  await upsertVerificationRows(rows);
  console.log(`已写入 verification_results：${rows.length} 行（upsert，含 input_hash / logic_version）`);
}

async function countCacheRows(): Promise<number | null> {
  if (!isSupabaseServiceAvailable()) return null;
  const supabase = getSupabaseServiceClient();
  const { count, error } = await supabase.from("llm_call_cache").select("cache_key", { count: "exact", head: true });
  if (error) return null;
  return count ?? null;
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
  console.error("\n评测失败：", err);
  process.exit(1);
});
