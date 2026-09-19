/**
 * results 模块（结果查询 / 统计 / 冲突对 / 导出）的类型与常量。
 *
 * 这些是"读模型"，只在本模块内部使用；对外契约（HTTP 响应 / MCP tool 返回格式）
 * 写在 SHARED_INTERFACES.md「results 模块」一节，两边改动要同步。
 * 不要从别的 feature 直接 import 这里的内部实现（见 CLAUDE.md「一切皆插件」）。
 */
import type { ComparisonStatus, EmailCategory, ReviewReason } from "@/lib/shared/types";

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

export interface ConflictQuery {
  statuses: ComparisonStatus[];
  q?: string;
  sortBy: ConflictSortField;
  order: SortOrder;
  limit: number;
  offset: number;
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
  /** scope=submission 时给出原始邮件总数，用来判断提交是否完整 */
  expectedTotal: number | null;
  /** submission 场景下：导出条数少于原始邮件数（或含失败行）时为 true */
  incomplete: boolean;
  /** 文件内容本体：HTTP 直接作为响应体，MCP 作为 text 返回 */
  content: string;
  generatedAt: string;
}
