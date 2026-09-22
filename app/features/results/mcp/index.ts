import { z } from "zod";
import { COMPARISON_STATUSES, EMAIL_CATEGORIES } from "@/lib/shared/types";
import {
  exportResults,
  getStats,
  listConflicts,
  listResults,
  normalizeConflictQuery,
  normalizeExportRequest,
  normalizeResultQuery,
} from "../logic";
import {
  CONFLICT_SORT_FIELDS,
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  GROUP_FIELDS,
  NUMERIC_MODES,
  NUMERIC_SEARCH_FIELDS,
  PROCESSING_STATES,
  RESULT_SORT_FIELDS,
  SORT_ORDERS,
} from "../logic";

/**
 * The 4 MCP tools (read-only) exposed by the results module, aggregated and registered by /app/core/mcp-server.
 * Handlers only forward "schema -> logic"; filtering/validation/export all live in logic, shared with REST.
 */

const resultFilterShape = {
  category: z
    .array(z.enum(EMAIL_CATEGORIES))
    .optional()
    .describe("Only return these categories (BL_COMPARISON / SI_REQUEST / INVOICE_QUERY / GENERAL / SPAM)"),
  status: z
    .array(z.enum(COMPARISON_STATUSES))
    .optional()
    .describe("Only return these comparison statuses (OK / MISMATCH / NEEDS_REVIEW)"),
  processing: z
    .enum(PROCESSING_STATES)
    .optional()
    .describe("processed=already processed; pending=no result yet; failed=processing failed"),
  has_defect: z.boolean().optional().describe("true = only show emails with a discrepancy (MISMATCH)"),
  provider: z.string().optional().describe('Substring match on model provider, e.g. "jev", "rules"'),
  q: z.string().optional().describe("Keyword search by email ID / sender / subject"),
};

const listResultsMcpTool = {
  name: "list_results",
  description:
    "Query verification results for the 520 sample emails (including unprocessed ones), with filtering by category/status/processing state, plus sorting, grouping, and pagination. Returns basic email info + category + comparison result + extracted fields",
  inputSchema: {
    ...resultFilterShape,
    sort_by: z.enum(RESULT_SORT_FIELDS).optional().describe("Sort field, defaults to email_id"),
    order: z.enum(SORT_ORDERS).optional().describe("Sort direction; defaults to asc for email_id, desc otherwise"),
    group_by: z
      .enum(GROUP_FIELDS)
      .optional()
      .describe("Include group counts (by category or comparison_status)"),
    limit: z.number().int().min(1).max(200).optional().describe("Items per page, default 50, max 200"),
    offset: z.number().int().min(0).optional().describe("Number of items to skip, default 0"),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) => listResults(normalizeResultQuery(args)),
};

const getStatsMcpTool = {
  name: "get_stats",
  description:
    "Get verification result statistics: total emails, processed/pending/failed counts, category distribution, status distribution, defect field frequency, model distribution",
  inputSchema: {},
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async () => getStats(),
};

const listConflictsMcpTool = {
  name: "list_conflicts",
  description:
    "List conflicting file pairs: emails where SI and BL disagree (MISMATCH) or need manual confirmation (NEEDS_REVIEW), including SI/BL attachment paths, the differing fields, and both sides' values",
  inputSchema: {
    status: z
      .array(z.enum(COMPARISON_STATUSES))
      .optional()
      .describe("Defaults to MISMATCH + NEEDS_REVIEW"),
    q: z.string().optional().describe("Keyword search by email ID / sender / subject"),
    sort_by: z.enum(CONFLICT_SORT_FIELDS).optional().describe("Sort field, defaults to defect_count"),
    order: z.enum(SORT_ORDERS).optional().describe("Sort direction, defaults to desc"),
    limit: z.number().int().min(1).max(200).optional().describe("Items per page, default 50"),
    offset: z.number().int().min(0).optional().describe("Number of items to skip, default 0"),
    numeric_mode: z
      .enum(NUMERIC_MODES)
      .optional()
      .describe(
        "Numeric comparison mode (affects querying only, not the official submission): exact=default, matches what's stored in the results table; fuzzy=small differences within tolerance don't count as a conflict"
      ),
    tolerance: z
      .number()
      .min(0)
      .optional()
      .describe("Only usable with numeric_mode=fuzzy; omit to use the default (weight max(0.5kg, 0.1%), container count 0)"),
    value_field: z
      .enum(NUMERIC_SEARCH_FIELDS)
      .optional()
      .describe("Field to search by value (container_count / gross_weight_kg); must be paired with value"),
    value: z
      .string()
      .optional()
      .describe('Numeric value to search for (e.g. "12000"); matches either the SI or BL side; must be paired with value_field'),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) => listConflicts(normalizeConflictQuery(args)),
};

const exportResultsMcpTool = {
  name: "export_results",
  description:
    "Export results as file content (Save as). scope=results result list / conflicts conflicting file pairs / stats summary statistics / submission official submission format (json only); format=json|md|txt|csv (csv is suited to conflicts: one row = one field to correct, listing email_id/si_value/bl_value/why it was judged a mismatch). The returned text is the file content itself; the filename is in _meta.filename",
  inputSchema: {
    scope: z.enum(EXPORT_SCOPES).optional().describe("Export scenario, defaults to results"),
    format: z.enum(EXPORT_FORMATS).optional().describe("File format, defaults to json"),
    ...resultFilterShape,
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) => {
    const doc = await exportResults(normalizeExportRequest(args));
    return {
      content: [{ type: "text" as const, text: doc.content }],
      _meta: {
        filename: doc.filename,
        mime_type: doc.mimeType,
        format: doc.format,
        scope: doc.scope,
        item_count: doc.itemCount,
        expected_total: doc.expectedTotal,
        incomplete: doc.incomplete,
        expected_source: doc.expectedSource,
        missing: doc.missingIds.length,
        missing_ids: doc.missingIds.slice(0, 50),
        stale: doc.staleIds.length,
        stale_ids: doc.staleIds.slice(0, 50),
        invalid: doc.invalidIds.length,
        invalid_ids: doc.invalidIds.slice(0, 50),
        review_pending: doc.reviewPending,
        review_deferred: doc.reviewDeferred,
        generated_at: doc.generatedAt,
      },
    };
  },
};

export const resultsMcpTools = [
  listResultsMcpTool,
  getStatsMcpTool,
  listConflictsMcpTool,
  exportResultsMcpTool,
];
