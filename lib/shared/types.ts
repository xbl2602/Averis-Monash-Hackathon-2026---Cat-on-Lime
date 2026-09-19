/**
 * 三个 feature 模块（classification / extraction / comparison）之间传递数据用的类型。
 * 这些类型直接对应官方要求的提交格式（见 SHARED_INTERFACES.md 和
 * data/sample/README.md），改动前先跟操作者确认，因为三人都依赖这里。
 */

// 官方题目里的邮箱数据长这样（见 data/sample/inbox/email_*.json）
export interface InboxEmail {
  email_id: string;
  from: string;
  subject: string;
  body: string;
  attachments: string[]; // 例如 "attachments/email_004_SI.txt"
}

// classification 模块的输出
export type EmailCategory =
  | "BL_COMPARISON"
  | "SI_REQUEST"
  | "INVOICE_QUERY"
  | "GENERAL"
  | "SPAM";

// comparison 模块的输出状态
export type ComparisonStatus = "OK" | "MISMATCH" | "NEEDS_REVIEW";

// 拿不准的原因（status 是 NEEDS_REVIEW 时必须给一个）
export type ReviewReason =
  | "wrong_doc_type"
  | "missing_attachment"
  | "unreadable"
  | "missing_value";

// 官方要求比对的 7 个字段，SI 和 BL 上这几个字段的叫法可能不一样，
// extraction 模块要负责"按含义对齐"，不是按原文字段名对齐
export const COMPARED_FIELDS = [
  "shipper",
  "consignee",
  "notify_party",
  "port_of_loading",
  "port_of_discharge",
  "container_count",
  "gross_weight_kg",
] as const;
export type ComparedField = (typeof COMPARED_FIELDS)[number];

// extraction 模块的输出：从一份文档（SI 或 BL）里抽出来的字段
export type ExtractedDocumentFields = Partial<Record<ComparedField, string>>;

// extraction 模块对"这份文档实际是什么"的判断（OTHER = 明显不是 SI/BL，如商业发票/装箱单/产地证）
export type DocumentType = "SI" | "BL" | "OTHER" | "UNKNOWN";

// extraction 模块的完整输出
export interface ExtractDocumentResult {
  document_type: DocumentType;
  fields: ExtractedDocumentFields;
  /** 字段主要靠"规则解析"还是"LLM 兜底"得出，用于排查与统计 */
  extracted_by: "rules" | "llm";
}

// comparison 模块的输出，同时也是最终要交给官方评分系统的那份结果的"单条"格式
// （最终提交文件是 { [email_id]: EmailVerificationResult } 这样一个大对象，
//  见 data/sample/sample_submission.json）
export interface EmailVerificationResult {
  category: EmailCategory;
  status: ComparisonStatus;
  review_reason: ReviewReason | null;
  defect_fields: ComparedField[];
  has_defect: boolean;
}

// 最终要提交给官方评分系统的完整文件格式
export type SubmissionFile = Record<string, EmailVerificationResult>;
