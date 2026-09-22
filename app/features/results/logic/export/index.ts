/**
 * The single orchestration entry point for export: fetch data by scope -> serialize by format ->
 * return file content. The HTTP layer is only responsible for turning an ExportDocument into a
 * response with download headers; the MCP layer is only responsible for returning content as text
 * (filename/completeness metadata goes in _meta) — neither layer re-assembles the content.
 *
 * Completeness determination (fail-closed approach from the 2026-09-20 security review):
 * - The denominator is anchored first to the "official sample list" (listSampleEmailIds, which only
 *   does readdir, never parses JSON); if the list can't be read, fall back to the database total and
 *   force incomplete=true (expectedSource=db-fallback)
 * - Compute the missing set key by key; result rows whose logic_version doesn't match the current
 *   engine version count as stale
 * - Note: this fetches data **directly** from @/lib/shared/inbox / versions, bypassing sample-inputs,
 *   to avoid dragging attachment-parsing dependencies (mammoth/pdf-parse etc.) into the export function
 *   bundle (next.config only carries the filename list)
 */
import { listSampleEmailIds } from "@/lib/shared/inbox";
import { applyOverridesToSubmission } from "@/lib/shared/review/merge";
import { PIPELINE_LOGIC_VERSION } from "@/lib/shared/versions";
import type { ComparedField, EmailVerificationResult } from "@/lib/shared/types";
import { listAllConflicts } from "../conflicts";
import { listAllResults } from "../query";
import { getStats } from "../stats";
import type { ExportDocument, ExportFormat, ExportRequest, ResultQuery, StatsSummary } from "../types";
import { buildCsvReport } from "./csv";
import { toJson } from "./json";
import { buildMarkdownReport } from "./markdown";
import {
  buildStatsLines,
  describeConflictFilters,
  describeResultFilters,
  scopeLabel,
  type ReportData,
} from "./report-data";
import { buildTextReport } from "./text";

const MIME_TYPES: Record<ExportFormat, string> = {
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
};

// The official submission file needs "all processed emails" with no filtering; limit/offset are ignored by listAllResults
const ALL_RESULTS_QUERY: ResultQuery = { sortBy: "email_id", order: "asc", limit: 1, offset: 0 };

export async function exportResults(request: ExportRequest): Promise<ExportDocument> {
  const generatedAt = new Date().toISOString();
  const stats = await getStats();

  if (request.scope === "submission") {
    return buildSubmissionDocument(stats, stats.failed, generatedAt);
  }

  const results = request.scope === "results" ? await listAllResults(request.query) : [];
  const conflicts =
    request.scope === "conflicts" ? await listAllConflicts(request.conflictQuery) : [];

  const data: ReportData = {
    scope: request.scope,
    generatedAt,
    filterDescription:
      request.scope === "conflicts"
        ? describeConflictFilters(request.conflictQuery)
        : request.scope === "results"
          ? describeResultFilters(request.query)
          : "(full set, no filters)",
    stats,
    results,
    conflicts,
  };

  const itemCount =
    request.scope === "results" ? results.length : request.scope === "conflicts" ? conflicts.length : 0;

  return {
    filename: `shipping-${request.scope}_${timestampForFilename(generatedAt)}.${request.format}`,
    mimeType: MIME_TYPES[request.format],
    format: request.format,
    scope: request.scope,
    itemCount,
    expectedTotal: null,
    expectedSource: null,
    missingIds: [],
    staleIds: [],
    invalidIds: [],
    incomplete: false,
    reviewPending: 0,
    reviewDeferred: 0,
    content: serialize(request.format, data),
    generatedAt,
  };
}

/** Official submission format: { email_id: EmailVerificationResult }, with no wrapper fields */
async function buildSubmissionDocument(
  stats: StatsSummary,
  failedCount: number,
  generatedAt: string
): Promise<ExportDocument> {
  const rows = await listAllResults(ALL_RESULTS_QUERY);
  const systemPayload: Record<string, EmailVerificationResult> = {};

  for (const row of rows) {
    if (!row.category || !row.comparison_status) continue; // Failed rows have no valid result, skip them
    systemPayload[row.email_id] = {
      category: row.category,
      status: row.comparison_status,
      review_reason: row.review_reason,
      defect_fields: row.defect_fields as ComparedField[],
      has_defect: row.has_defect,
    };
  }

  // Manual review overrides are applied only to the submission export (§5.3); results/conflicts still show the system's original values
  const { payload, reviewPending, reviewDeferred } = await applyOverridesToSubmission(systemPayload);

  const itemCount = Object.keys(payload).length;
  const expected = await resolveExpectedSampleIds(stats);
  const invalidIds = findInvalidSubmissionIds(payload);

  const present = new Set(Object.keys(payload));
  const missingIds =
    expected.source === "sample" ? expected.ids.filter((id) => !present.has(id)) : [];
  // Only rows with a valid result count as stale: pending rows (no result) count as missing, and failed rows are covered by failedCount
  const staleIds = rows
    .filter(
      (row) =>
        row.category !== null &&
        row.comparison_status !== null &&
        row.logic_version !== PIPELINE_LOGIC_VERSION
    )
    .map((row) => row.email_id);

  const incomplete =
    expected.source !== "sample" ||
    itemCount !== expected.total ||
    missingIds.length > 0 ||
    staleIds.length > 0 ||
    failedCount > 0 ||
    invalidIds.length > 0;

  return {
    filename: "submission.json",
    mimeType: MIME_TYPES.json,
    format: "json",
    scope: "submission",
    itemCount,
    expectedTotal: expected.total,
    expectedSource: expected.source,
    missingIds,
    staleIds,
    invalidIds,
    incomplete,
    reviewPending,
    reviewDeferred,
    content: toJson(payload),
    generatedAt,
  };
}

/**
 * Validity checks for the submission file (2026-09-21 P0-4, rules from the official data/sample/README.md):
 * - MISMATCH: defect_fields non-empty, has_defect true, review_reason null
 * - NEEDS_REVIEW: review_reason set (one of the four official reasons), defect_fields empty (uncertainty must not be exported as a defect)
 * - OK: defect_fields empty, has_defect false, review_reason null
 * Rows violating any of these go into invalidIds: the export isn't blocked, but incomplete is forced
 * true plus a dedicated response header — never let it slip through silently.
 */
function findInvalidSubmissionIds(payload: Record<string, EmailVerificationResult>): string[] {
  const invalid: string[] = [];
  for (const [emailId, result] of Object.entries(payload)) {
    const hasDefects = result.defect_fields.length > 0;
    const consistent =
      result.has_defect === hasDefects &&
      (result.status === "MISMATCH"
        ? hasDefects && result.review_reason === null
        : result.status === "NEEDS_REVIEW"
          ? !hasDefects && result.review_reason !== null
          : !hasDefects && result.review_reason === null);
    if (!consistent) invalid.push(emailId);
  }
  return invalid;
}

interface ExpectedSampleIds {
  source: "sample" | "db-fallback";
  total: number;
  ids: string[];
}

/** The denominator is anchored to the official sample list; falls back to the database total if the list can't be read/is empty (fail-closed, see file header comment) */
async function resolveExpectedSampleIds(stats: StatsSummary): Promise<ExpectedSampleIds> {
  try {
    const ids = await listSampleEmailIds();
    if (ids.length > 0) {
      return { source: "sample", total: ids.length, ids };
    }
    console.warn("[results/export] Sample list is empty, falling back to the database total (incomplete forced to true)");
  } catch (err) {
    console.warn(
      "[results/export] Failed to read the sample list, falling back to the database total (incomplete forced to true):",
      err instanceof Error ? err.message : err
    );
  }
  return { source: "db-fallback", total: stats.total_emails, ids: [] };
}

function serialize(format: ExportFormat, data: ReportData): string {
  if (format === "json") return toJson(buildJsonPayload(data));
  if (format === "md") return buildMarkdownReport(data);
  if (format === "csv") return buildCsvReport(data);
  return buildTextReport(data);
}

function buildJsonPayload(data: ReportData): unknown {
  const payload: Record<string, unknown> = {
    generated_at: data.generatedAt,
    scope: data.scope,
    scope_label: scopeLabel(data.scope),
    filters: data.filterDescription,
    stats: data.stats,
  };

  if (data.scope === "results") {
    payload.item_count = data.results.length;
    payload.items = data.results;
  } else if (data.scope === "conflicts") {
    payload.item_count = data.conflicts.length;
    payload.items = data.conflicts;
  } else {
    payload.stats_lines = buildStatsLines(data.stats);
  }

  return payload;
}

// 2026-09-20T00:30:00.000Z -> 20260920-0030
function timestampForFilename(iso: string): string {
  const compact = iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "");
  return `${compact.slice(0, 8)}-${compact.slice(9, 13)}`;
}
