/**
 * Perturbation-set correctness verification (P1-10, round 2)
 *
 * Difference from perturb:run: run verifies "invariance" (output is unchanged before/after perturbation), while this
 * script verifies "correctness" (scored against ground truth using the official scorer), answering "is the
 * classification actually right".
 *
 * Approach:
 *   1. Read all ptN_ perturbation results from Supabase;
 *   2. For semantics-preserving variants (pt1-pt5, pt7-pt11, pt13, pt14), construct a derived GT:
 *      the expectation for ptN_email_xxx = the label for email_xxx in the official GT (perturbation doesn't change semantics, so the expectation stays the same);
 *   3. pt6 (scanned documents) uses an explicit expected GT (NEEDS_REVIEW/unreadable);
 *   4. pt12 (injected conflicting values) doesn't participate in GT scoring — it's covered by the "must not silently return OK" assertion in the run report;
 *   5. Score both overall and per-variant using the official score_cli.py (same implementation as scoring.py),
 *      and list every email with a category misclassification (category != derived GT).
 *
 * Usage: npm run perturb:score
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

/** pt12 is the "injected conflicting values" scenario; the expectation is "must not silently return OK", so it isn't suited to GT scoring */
const EXCLUDED_FROM_GT_SCORING = new Set(["pt12"]);

async function main() {
  await loadEnvLocal();
  if (!isSupabaseServiceAvailable()) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY, cannot read perturbation results");

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
    if (error) throw new Error(`Failed to read perturbation results: ${error.message}`);
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
    throw new Error(`Official scorer execution failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout);
}

function buildSummary(results: VariantScore[], overall: Record<string, any>): string {
  const lines = [
    `# Perturbation-set correctness verification (official scorer, derived GT) — ${new Date().toISOString()}`,
    "",
    "Judging criteria: for semantics-preserving variants (pt1-pt5, pt7-pt11, pt13, pt14), derived GT = the original label from the official GT;",
    "pt6 uses an explicit expectation (NEEDS_REVIEW/unreadable); pt12 is the conflict-injection scenario and doesn't participate in GT scoring.",
    "",
    "| Variant | Scored count | Category accuracy | Category macro-F1 | Defect F1 | End-to-end | Escalation recall | Category errors | Status errors |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const item of results) {
    const macro = item.macroF1Suppressed ? "n/a" : item.macroF1.toFixed(3);
    lines.push(
      `| ${item.variant} | ${item.scored} | ${item.accuracy.toFixed(3)} | ${macro} | ${item.defectF1.toFixed(3)} | ${item.e2eSuccess}/${item.e2eTotal} | ${item.reliabilityRecall.toFixed(3)} | ${item.categoryErrors.length} | ${item.statusErrors.length} |`
    );
  }
  lines.push("", "## Summary (all perturbation emails included in scoring)", "");
  lines.push(
    `- Category accuracy=${overall.stage1.accuracy.toFixed(3)}, macro-F1=${overall.stage1.macro_f1.toFixed(3)}`,
    `- Defect F1=${overall.stage3.defect_f1.toFixed(3)}`,
    `- End-to-end=${overall.end_to_end.success}/${overall.end_to_end.total} (${overall.end_to_end.rate.toFixed(3)})`,
    `- Escalation recall=${overall.reliability.escalation_recall.toFixed(3)}, precision=${overall.reliability.escalation_precision.toFixed(3)}`,
    `- Official weighted score (same formula)=${overall.final_score.toFixed(4)}`
  );
  const categoryErrorLines: string[] = [];
  for (const item of results) {
    for (const err of item.categoryErrors) {
      categoryErrorLines.push(`- ${err.id} (origin ${err.origin}): GT=${err.truth}, actual=${err.predicted}`);
    }
  }
  lines.push("", `## Category misclassification details (${categoryErrorLines.length} total)`, "");
  lines.push(...(categoryErrorLines.length ? categoryErrorLines : ["(none)"]));
  return lines.join("\n");
}

function printSummary(results: VariantScore[], overall: Record<string, any>, outDir: string) {
  console.log("\n============ Perturbation-set correctness verification (official scorer + derived GT) ============");
  console.log("Variant  Scored  accuracy  macroF1  defectF1   e2e        statusErr  categoryErr");
  for (const item of results) {
    const macro = item.macroF1Suppressed ? "n/a" : item.macroF1.toFixed(3);
    console.log(
      `${item.variant.padEnd(7)}${String(item.scored).padStart(5)}   ${item.accuracy.toFixed(3).padStart(7)}  ${macro.padStart(7)}  ${item.defectF1.toFixed(3).padStart(7)}   ${(item.e2eSuccess + "/" + item.e2eTotal).padStart(8)}  ${String(item.statusErrors.length).padStart(9)}  ${String(item.categoryErrors.length).padStart(7)}`
    );
  }
  console.log("(macroF1 marked n/a = this subset is missing some categories, so a 5-category macro doesn't make sense on the subset; see the summary row)");
  console.log("");
  console.log(`Total (${overall.n_emails} emails): accuracy=${overall.stage1.accuracy.toFixed(3)} macroF1=${overall.stage1.macro_f1.toFixed(3)} defectF1=${overall.stage3.defect_f1.toFixed(3)} e2e=${overall.end_to_end.success}/${overall.end_to_end.total} official weighted score=${overall.final_score.toFixed(4)}`);
  const totalCategoryErrors = results.reduce((sum, item) => sum + item.categoryErrors.length, 0);
  console.log(`Total category misclassifications: ${totalCategoryErrors} (see summary.md for details)`);
  console.log(`Output directory: ${path.relative(ROOT, outDir)} (scores.json / summary.md / per-variant submission+derived-gt)`);
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
  console.error("\nCorrectness verification failed:", err);
  process.exit(1);
});
