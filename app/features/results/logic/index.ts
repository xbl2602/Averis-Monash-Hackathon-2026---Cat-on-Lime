/**
 * External facade for the results module: both REST (api/) and MCP (mcp/) call only into here,
 * ensuring "query/stats/conflicts/export" each have exactly one implementation (no reinventing the wheel).
 */
export { listResults, listAllResults } from "./query";
export { getStats } from "./stats";
export { listConflicts, listAllConflicts } from "./conflicts";
export { exportResults } from "./export";
export {
  normalizeResultQuery,
  normalizeConflictQuery,
  normalizeExportRequest,
} from "./params";
export { ResultQueryError, DataAccessError } from "./errors";
export type {
  ConflictList,
  ConflictPair,
  ConflictQuery,
  ConflictSortField,
  ExportDocument,
  ExportFormat,
  ExportRequest,
  ExportScope,
  GroupField,
  ProcessingState,
  ResultList,
  ResultQuery,
  ResultRow,
  ResultSortField,
  SortOrder,
  StatsSummary,
} from "./types";
export {
  CONFLICT_SORT_FIELDS,
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  GROUP_FIELDS,
  NUMERIC_MODES,
  NUMERIC_SEARCH_FIELDS,
  PROCESSING_STATES,
  RESULT_SORT_FIELDS,
  SORT_ORDERS,
} from "./types";
