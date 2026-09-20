/**
 * results 模块（结果查询 / 统计 / 冲突对 / 导出）的类型与常量。
 *
 * 这些是"读模型"，只在本模块内部使用；对外契约（HTTP 响应 / MCP tool 返回格式）
 * 写在 SHARED_INTERFACES.md「results 模块」一节，两边改动要同步。
 * 不要从别的 feature 直接 import 这里的内部实现（见 CLAUDE.md「一切皆插件」）。
 */
import type {
  ComparisonStatus,
  EmailCategory,
  ExtractedDocumentEvidence,
  ReviewReason,
} from "@/lib/shared/types";

// 列表可排序的字段（白名单：只有这几列能进查询/排序，避免任意列名）
export const RESULT_SORT_FIELDS = [
  "email_id",
  "category",
  "comparison_status",
  "defect_count",
  "updated_at",
] as const;
export type ResultSortField = (typeof RESULT_SORT_FIELDS)[number];

// 冲突对可排序的字段
export const CONFLICT_SORT_FIELDS = ["email_id", "defect_count", "updated_at"] as const;
export type ConflictSortField = (typeof CONFLICT_SORT_FIELDS)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

// 三态：processed=结果表里有行；failed=结果表里的行 processing_status='failed'；
// pending=原始邮件还没有结果行（表里没有行不代表失败，是还没跑）
export const PROCESSING_STATES = ["processed", "pending", "failed"] as const;
export type ProcessingState = (typeof PROCESSING_STATES)[number];

// 列表可分组展示的字段（对应"自定义展示方式"）
export const GROUP_FIELDS = ["category", "comparison_status"] as const;
export type GroupField = (typeof GROUP_FIELDS)[number];

export const EXPORT_FORMATS = ["json", "md", "txt"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// 导出场景：同一份数据，不同场景导出不同内容（见 SHARED_INTERFACES.md）
export const EXPORT_SCOPES = ["results", "conflicts", "stats", "submission"] as const;
export type ExportScope = (typeof EXPORT_SCOPES)[number];

export interface ResultQuery {
  /** 只要这几类；缺省=全部（含未处理） */
  categories?: EmailCategory[];
  statuses?: ComparisonStatus[];
  /** processed / pending / failed；缺省=全部 */
  processing?: ProcessingState;
  /** 只看 MISMATCH（真正有缺陷）的 */
  hasDefect?: boolean;
  /** model_provider 的子串匹配，例如 "jev"、"rules" */
  provider?: string;
  /** 邮件ID / 发件人 / 主题 的关键词搜索 */
  q?: string;
  sortBy: ResultSortField;
  order: SortOrder;
  groupBy?: GroupField;
  limit: number;
  offset: number;
}

export interface ResultRow {
  email_id: string;
  from: string;
  subject: string;
  attachment_paths: string[];
  /** 未处理的邮件，下面这些结果字段都是 null / 空 */
  category: EmailCategory | null;
  comparison_status: ComparisonStatus | null;
  review_reason: ReviewReason | null;
  defect_fields: string[];
  defect_count: number;
  has_defect: boolean;
  processing_status: ProcessingState;
  error_message: string | null;
  model_provider: string | null;
  logic_version: string | null;
  updated_at: string | null;
  extracted_si: Record<string, string> | null;
  extracted_bl: Record<string, string> | null;
  /** 字段级出处（规则命中的行号/原句；LLM 兜底只标来源），没有就是 null */
  evidence_si: ExtractedDocumentEvidence | null;
  evidence_bl: ExtractedDocumentEvidence | null;
}

export interface ResultList {
  total: number;
  limit: number;
  offset: number;
  sortBy: ResultSortField;
  order: SortOrder;
  groupBy: GroupField | null;
  /** 只有传了 groupBy 才有值（对筛选后的全集统计，不是只统计当前页） */
  groups: { key: string; count: number }[] | null;
  items: ResultRow[];
}

export interface StatsSummary {
  /** 原始邮件总数（raw_emails） */
  total_emails: number;
  /** 结果表里有行的数量（含 failed） */
  processed: number;
  /** 还没有结果行的数量 = total_emails - processed */
  pending: number;
  /** processing_status='failed' 的数量 */
  failed: number;
  mismatch: number;
  needs_review: number;
  /** 5 个类别 + NOT_PROCESSED */
  by_category: Record<string, number>;
  /** OK / MISMATCH / NEEDS_REVIEW + NOT_PROCESSED */
  by_status: Record<string, number>;
  /** 差异字段频次排行（MISMATCH 行里的 defect_fields） */
  defect_field_frequency: { field: string; count: number }[];
  /** model_provider 值的分布 */
  providers: Record<string, number>;
  last_updated_at: string | null;
}

// 数值搜索/模糊口径可用的字段（"精确/模糊"只对数字字段有意义；权威数字字段集合在 comparison 模块的
// canonical.ts，这里是读侧子集，两边如有一方调整要同步）
export const NUMERIC_SEARCH_FIELDS = ["container_count", "gross_weight_kg"] as const;
export type NumericSearchField = (typeof NUMERIC_SEARCH_FIELDS)[number];

export const NUMERIC_MODES = ["exact", "fuzzy"] as const;
export type NumericMode = (typeof NUMERIC_MODES)[number];

export interface ConflictQuery {
  statuses: ComparisonStatus[];
  q?: string;
  sortBy: ConflictSortField;
  order: SortOrder;
  limit: number;
  offset: number;
  /** 数值口径：exact（默认，与结果表的存储判定一致）/ fuzzy（容差内的小差异不算冲突） */
  numericMode: NumericMode;
  /** 仅 fuzzy 时可用；不传时各字段用默认容差（重量 max(0.5kg, 0.1%)、箱数 0） */
  tolerance: number | null;
  /** 按值搜索的字段（和 value 成对出现；都为空 = 不做值搜索） */
  valueField: NumericSearchField | null;
  /** 按值搜索的数值（校验时已转成合法数字字符串） */
  value: string | null;
}

export interface ConflictPair {
  email_id: string;
  from: string;
  subject: string;
  /** 按附件文件名里的 _SI / _BL 区分，找不到就是 null */
  si_file: string | null;
  bl_file: string | null;
  other_files: string[];
  status: ComparisonStatus;
  review_reason: ReviewReason | null;
  defect_fields: string[];
  defect_count: number;
  si_values: Record<string, string>;
  bl_values: Record<string, string>;
  /** 字段级出处（和 values 同源；规则命中才有行号/原句） */
  si_evidence: ExtractedDocumentEvidence | null;
  bl_evidence: ExtractedDocumentEvidence | null;
  updated_at: string | null;
}

export interface ConflictList {
  total: number;
  limit: number;
  offset: number;
  sortBy: ConflictSortField;
  order: SortOrder;
  items: ConflictPair[];
}

export interface ExportRequest {
  scope: ExportScope;
  format: ExportFormat;
  /** scope=results / conflicts 时生效；stats / submission 忽略 */
  query: ResultQuery;
  conflictQuery: ConflictQuery;
}

export interface ExportDocument {
  filename: string;
  mimeType: string;
  format: ExportFormat;
  scope: ExportScope;
  itemCount: number;
  /** scope=submission 时给出"应该有多少封"的分母，用来判断提交是否完整 */
  expectedTotal: number | null;
  /**
   * scope=submission 时：分母的来源。
   * - sample = 官方样例清单（data/sample/inbox 的文件名，最可信）
   * - db-fallback = 读不到清单，降级用数据库总数（此时 incomplete 强制为 true）
   */
  expectedSource: "sample" | "db-fallback" | null;
  /** scope=submission 且 expectedSource=sample 时：清单里有、导出里没有的 email_id */
  missingIds: string[];
  /** scope=submission 时：有结果但 logic_version 与当前引擎版本不一致的 email_id */
  staleIds: string[];
  /**
   * scope=submission 时：行内字段自相矛盾（违反官方 schema，如 MISMATCH 却没有缺陷清单、
   * NEEDS_REVIEW 却带着缺陷、复核缺少原因）的 email_id。非 submission 场景恒为空数组。
   */
  invalidIds: string[];
  /**
   * submission 场景：expectedSource 非 sample、条数≠分母、有缺失/过期版本或失败行，
   * 任意一条成立就是 true（fail-closed：宁可提示不完整，也不谎报"已完整"）
   */
  incomplete: boolean;
  /** 文件内容本体：HTTP 直接作为响应体，MCP 作为 text 返回 */
  content: string;
  generatedAt: string;
}
