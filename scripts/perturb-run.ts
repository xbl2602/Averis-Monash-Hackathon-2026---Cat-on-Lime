/**
 * Perturbation-set runner (P1-10)
 *
 * Reads all perturbation emails from data/perturb -> runs the full pipeline -> writes into the same Supabase
 * verification_results table (mixed in with the official 520 emails in one table, isolated by the "ptN_" email_id prefix)
 * -> asserts against each variant's "expected result" from the manifest, one by one (no longer uniformly "must match the original result").
 *
 * Expectation types:
 *   same         Exactly matches the original result from the 520 emails (structural-transform variants)
 *   needs_review Must be NEEDS_REVIEW with a matching reason (e.g. scanned document -> unreadable)
 *   not_ok       Must not silently return OK (e.g. conflicting values within a single document should escalate or report a defect)
 *
 * Usage (from the project root):
 *   npm run perturb:run              # full run
 *   npm run perturb:run -- --limit=40   # only run the first 40 emails (debugging)
 *   npm run perturb:run -- --no-write   # compute only, don't write to the database
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
  console.log(`Loaded perturbation emails: ${inputs.length} (across ${Object.keys(manifest.variants).length} variants)`);

  const startedAt = Date.now();
  const outcome = await runBatchPipeline(inputs, {
    concurrency: 4,
    onProgress: (done, total, emailId) => {
      if (done % 200 === 0 || done === total) console.log(`  Progress ${done}/${total} (most recent: ${emailId})`);
    },
  });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`Done: succeeded ${outcome.succeeded.length}, failed ${outcome.failed.length}, elapsed ${elapsed}s`);

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
    console.log(`Written to verification_results: ${rows.length} rows (upsert, isolated by prefix)`);
  } else if (!NO_WRITE) {
    console.log("(no service key, skipping database write)");
  }

  const originals = await loadStoredVerificationRows();
  const report = buildReport(outcome.succeeded, outcome.failed, originals);
  await saveReport(report);
  printReport(report);
}

function describeExpectation(expectation: Expectation): string {
  if (expectation.kind === "same") return "matches original result";
  if (expectation.kind === "needs_review") return `NEEDS_REVIEW/${expectation.reason}`;
  return "must not silently return OK";
}

function evaluateExpectation(
  result: EmailVerificationResult,
  original: StoredVerificationRow | undefined,
  expectation: Expectation
): string[] {
  if (expectation.kind === "same") {
    if (!original || original.processing_status !== "ok") return ["Missing original result, cannot compare"];
    return diffResult(result, original);
  }
  if (expectation.kind === "needs_review") {
    if (result.status === "NEEDS_REVIEW" && result.review_reason === expectation.reason) return [];
    return [
      `Expected NEEDS_REVIEW/${expectation.reason}, actual ${result.status}/${result.review_reason ?? "-"}`,
    ];
  }
  if (result.status !== "OK") return [];
  return [`Expected non-OK (should escalate or report a defect), actual OK (defect_fields=${JSON.stringify(result.defect_fields)})`];
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
      expectation: "matches original result",
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
      if (differences[0]) mismatches[mismatches.length - 1].expected += ` (${differences.join("; ")})`;
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
      expected: "processed successfully",
      actual: `processing failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    engineExpectations: "same=matches original result; needs_review=must escalate with a matching reason; not_ok=must not silently return OK",
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
    `# Perturbation test report (${report.generatedAt})`,
    "",
    `Total ${report.total} emails, ${report.failedRequests} request failures. Judging criteria: ${report.engineExpectations}`,
    "",
    "| Variant | Expectation | Description | Total | Pass | Fail | Errored |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const [variant, stats] of Object.entries(report.perVariant)) {
    lines.push(
      `| ${variant} | ${stats.expectation} | ${stats.description} | ${stats.total} | ${stats.pass} | ${stats.fail} | ${stats.failed} |`
    );
  }
  if (report.mismatches.length > 0) {
    lines.push("", `## Failure details (first 100 of ${report.mismatches.length} total)`, "");
    for (const item of report.mismatches.slice(0, 100)) {
      lines.push(`- ${item.id} (origin ${item.origin}) expected ${item.expected}; actual ${item.actual}`);
    }
  }
  await writeFile(path.join(dir, "summary.md"), lines.join("\n"), "utf-8");
  console.log(`Report saved: ${path.relative(ROOT, dir)}`);
}

function printReport(report: PerturbReport) {
  console.log("\n================ Perturbation expectation assertion report ================");
  for (const [variant, stats] of Object.entries(report.perVariant)) {
    const rate = stats.total === 0 ? "n/a" : `${((stats.pass / stats.total) * 100).toFixed(1)}%`;
    console.log(
      `  ${variant} [${stats.expectation}]: pass ${stats.pass}/${stats.total} (${rate})  fail ${stats.fail}  errored ${stats.failed}`
    );
  }
  console.log(`  Total: ${report.total} emails, ${report.mismatches.length} failures`);
  for (const item of report.mismatches.slice(0, 25)) {
    console.log(`  [FAIL] ${item.id}: expected ${item.expected}; actual ${item.actual}`);
  }
  if (report.mismatches.length > 25) {
    console.log(`  ...(${report.mismatches.length - 25} more in the report file)`);
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
        throw new Error(`Perturbation attachment path escapes base dir: ${rel}`);
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
  console.error("\nPerturbation test failed:", err);
  process.exit(1);
});
