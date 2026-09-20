/**
 * results 模块的对外门面：REST（api/）和 MCP（mcp/）都只调用这里，
 * 保证"查询/统计/冲突/导出"四件事只有这一套实现（不重复造轮子）。
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
