/**
 * Conflicting file pairs: organizes emails where "SI and BL disagree (MISMATCH)" or where it's
 * "uncertain and needs a human look (NEEDS_REVIEW)" into file pairs, with the extracted field values
 * from both sides attached, for manual review and export.
 * Reads from the verification_overview view (only processed rows, fields are flat columns).
 */
import type {
  ComparisonStatus,
  ExtractedDocumentEvidence,
  ReviewReason,
} from "@/lib/shared/types";
import { fetchAllRows, getReadClient, ilikeFragment, sanitizeSearchTerm } from "./db";
import { DataAccessError } from "./errors";
import { applyNumericQuery, usesNumericFeatures } from "./numeric-query";
import { OVERVIEW_VIEW } from "./query";
import type { ConflictList, ConflictPair, ConflictQuery } from "./types";

const CONFLICT_SELECT = [
  "email_id",
  "from_address",
  "subject",
  "attachment_paths",
  "comparison_status",
  "review_reason",
  "defect_fields",
  "defect_count",
  "extracted_si",
  "extracted_bl",
  "evidence_si",
  "evidence_bl",
  "updated_at",
].join(",");

function buildBaseQuery(options?: { withCount?: boolean }) {
  const client = getReadClient();
  return client
    .from(OVERVIEW_VIEW)
    .select(CONFLICT_SELECT, options?.withCount ? { count: "exact" } : undefined)
    .eq("processed", true);
}

type ConflictQueryBuilder = ReturnType<typeof buildBaseQuery>;

interface ConflictRow {
  email_id: string;
  from_address: string | null;
  subject: string | null;
  attachment_paths: string[] | null;
  comparison_status: string | null;
  review_reason: string | null;
  defect_fields: string[] | null;
  defect_count: number | null;
  extracted_si: Record<string, string> | null;
  extracted_bl: Record<string, string> | null;
  evidence_si: ExtractedDocumentEvidence | null;
  evidence_bl: ExtractedDocumentEvidence | null;
  updated_at: string | null;
}

export async function listConflicts(query: ConflictQuery): Promise<ConflictList> {
  // When using numeric mode / search-by-value, it must be applied in memory (see numeric-query.ts): fetch everything first, then paginate
  if (usesNumericFeatures(query)) {
    const all = await fetchAllConflictsMatching(query);
    return {
      total: all.length,
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      order: query.order,
      items: all.slice(query.offset, query.offset + query.limit),
    };
  }

  const builder = applyConflictFilters(buildBaseQuery({ withCount: true }), query);
  const { data, error, count } = await applyConflictOrder(builder, query)
    .range(query.offset, query.offset + query.limit - 1);

  if (error) throw new DataAccessError(`Failed to query conflicting file pairs: ${error.message}`);

  return {
    total: count ?? 0,
    limit: query.limit,
    offset: query.offset,
    sortBy: query.sortBy,
    order: query.order,
    items: ((data ?? []) as unknown as ConflictRow[]).map(toConflictPair),
  };
}

/** For export: fetch back all conflict pairs under the same filters */
export async function listAllConflicts(query: ConflictQuery): Promise<ConflictPair[]> {
  if (usesNumericFeatures(query)) return fetchAllConflictsMatching(query);

  const rows = await fetchAllRows<ConflictRow>((from, to) => {
    const builder = applyConflictFilters(buildBaseQuery(), query);
    return applyConflictOrder(builder, query).range(from, to);
  });
  return rows.map(toConflictPair);
}

/** Numeric mode / search-by-value: SQL only does status + keyword filtering; the numeric comparison is applied in memory according to the query mode */
async function fetchAllConflictsMatching(query: ConflictQuery): Promise<ConflictPair[]> {
  const rows = await fetchAllRows<ConflictRow>((from, to) => {
    const builder = applyConflictFilters(buildBaseQuery(), query);
    return applyConflictOrder(builder, query).range(from, to);
  });
  return rows
    .map(toConflictPair)
    .map((pair) => applyNumericQuery(pair, query))
    .filter((pair): pair is ConflictPair => pair !== null);
}

function applyConflictFilters<T extends ConflictQueryBuilder>(
  builder: T,
  query: ConflictQuery
): T {
  let q = builder.in("comparison_status", query.statuses);

  if (query.q) {
    const term = sanitizeSearchTerm(query.q);
    if (term) {
      q = q.or(
        [
          ilikeFragment("email_id", term),
          ilikeFragment("subject", term),
          ilikeFragment("from_address", term),
        ].join(",")
      );
    }
  }

  return q;
}

function applyConflictOrder<T extends ConflictQueryBuilder>(
  builder: T,
  query: ConflictQuery
): T {
  return builder.order(query.sortBy, {
    ascending: query.order === "asc",
    nullsFirst: false,
  });
}

function toConflictPair(row: ConflictRow): ConflictPair {
  const attachments = row.attachment_paths ?? [];
  const siFile = attachments.find((path) => /_SI[._]/i.test(path)) ?? null;
  const blFile = attachments.find((path) => /_BL[._]/i.test(path)) ?? null;

  return {
    email_id: row.email_id,
    from: row.from_address ?? "",
    subject: row.subject ?? "",
    si_file: siFile,
    bl_file: blFile,
    other_files: attachments.filter((path) => path !== siFile && path !== blFile),
    status: (row.comparison_status ?? "NEEDS_REVIEW") as ComparisonStatus,
    review_reason: (row.review_reason as ReviewReason | null) ?? null,
    defect_fields: row.defect_fields ?? [],
    defect_count: row.defect_count ?? 0,
    si_values: row.extracted_si ?? {},
    bl_values: row.extracted_bl ?? {},
    si_evidence: row.evidence_si,
    bl_evidence: row.evidence_bl,
    updated_at: row.updated_at,
  };
}
