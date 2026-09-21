/**
 * sandbox feature 的类型与常量。
 *
 * 背景（P2，2026-09-21）：分类/抽取的单文档接口原本只能对着仓库自带的样例数据用
 * （传 email_id / attachment_path，指向 data/sample/ 里的文件）——裁判自己带一份新的
 * SI/BL 文档、或临时换一封邮件测试时，没有任何接口能接住。这个模块就是补这个缺口：
 * 直接接收上传的文件内容（不落库、不用 Supabase），跑一次分类+抽取+比对，返回结果。
 */
import type { ComparedField, ComparisonStatus, EmailCategory, ExtractDocumentResult, ReviewReason } from "@/lib/shared/types";

// 和 lib/shared/attachment-text.ts 能解析的格式对齐（txt/md 都按纯文本读）
export const SANDBOX_ALLOWED_EXTENSIONS = ["txt", "md", "pdf", "docx", "xlsx"] as const;
export type SandboxAllowedExtension = (typeof SANDBOX_ALLOWED_EXTENSIONS)[number];

export const MAX_FILE_NAME_LENGTH = 120;
// 两份文件要一起塞进一次 JSON 请求体：Vercel 请求体上限约 4.5MB，base64 比原文大 ~33%，
// 单份原文上限定 1.5MB（两份 + JSON 开销留够余量），比 import 模块单文件 20MB 的上限保守很多，
// 这里的场景是"贴一份单证测试"，不是"批量归档"，没必要对齐那个上限。
export const MAX_FILE_BYTES = 1_500_000;

export interface SandboxFileInput {
  name: string;
  data_base64: string;
}

export interface RunAdhocTestRequest {
  /** 邮件正文/主题都可选：不给就跳过分类，只测抽取+比对 */
  from?: string;
  subject?: string;
  body?: string;
  si: SandboxFileInput;
  bl: SandboxFileInput;
  provider?: string;
}

export interface RunAdhocTestResult {
  classification: { category: EmailCategory; confidence: number | null; needs_review: boolean } | null;
  extraction: { si: ExtractDocumentResult; bl: ExtractDocumentResult };
  comparison: {
    status: ComparisonStatus;
    defect_fields: ComparedField[];
    has_defect: boolean;
    review_reason: ReviewReason | null;
  };
}
