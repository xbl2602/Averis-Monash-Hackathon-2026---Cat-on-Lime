/**
 * 编排层（pipeline）：把"分类 → 抽取 → 比对"串成唯一的一条线（见 DATA_FLOW.md）。
 * 网页、REST API、MCP、评测脚本要"跑一封/一整箱"都应该走这里，不要在别处重新拼顺序。
 *
 * 这里同时负责 5 种"拿不准"的判定（对应官方的 review_reason）：
 * - missing_attachment：邮件里说"请核对 SI 和 draft BL"，但附件缺失
 *   （注意："请把 draft BL 发来检查"只是索取文件，没有可核对内容，基准算 OK）
 * - wrong_doc_type：附件不是 SI/BL（如商业发票/装箱单/产地证）
 * - unreadable：附件读不出文字（扫描件/损坏文件）
 * - missing_value：关键字段缺失（如占位符 TBA / N/A / ____MT）
 * - low_confidence_classification：Jev 给了分类结果但置信度 < 0.85（见 applyClassificationConfidence）
 */
import { createHash } from "node:crypto";
import { classifyEmailHybrid, type HybridClassificationResult } from "@/app/features/classification/logic";
import { compareDocumentsHybrid } from "@/app/features/comparison/logic";
import { extractFields } from "@/app/features/extraction/logic";
import type { LLMProvider } from "@/lib/llm";
import { mapWithConcurrencyLimit } from "@/lib/shared/concurrency";
import { identifyDocumentTypeSmart } from "@/lib/shared/document-identify-llm";
import {
  COMPARED_FIELDS,
  type EmailVerificationResult,
  type ExtractedDocumentEvidence,
  type ExtractedDocumentFields,
  type InboxEmail,
  type ReviewReason,
} from "@/lib/shared/types";

// 引擎版本号挪到叶子模块 lib/shared/versions.ts（导出函数只用版本号，不为此打包整个 pipeline）；
// 这里 re-export，原有 import 路径（pipeline/logic、verification-store 等）全部不变。
export { PIPELINE_LOGIC_VERSION } from "./versions";

export interface PipelineAttachment {
  path: string;
  parseStatus: "ok" | "unreadable";
  text: string;
}

export interface PipelineEmailInput {
  email: InboxEmail;
  attachments: PipelineAttachment[];
}

export interface PipelineOptions {
  /** 抽取兜底 / 分类兜底用的文本模型（默认 gemini） */
  textProvider?: LLMProvider;
}

export interface PipelineMeta {
  classifier: "rules" | "jev" | "llm" | "degraded";
  extractor: { si: "rules" | "llm" | null; bl: "rules" | "llm" | null };
  comparer: "rules" | "rules+jev" | "rules-degraded" | null;
}

export interface PipelineOutcome {
  result: EmailVerificationResult;
  meta: PipelineMeta;
  /** 抽取到的字段（给结果层存 extracted_si / extracted_bl 用） */
  extracted: { si: ExtractedDocumentFields | null; bl: ExtractedDocumentFields | null };
  /** 字段级出处（P1-7）：规则命中的行号/原句；LLM 兜底只标来源 */
  evidence: { si: ExtractedDocumentEvidence | null; bl: ExtractedDocumentEvidence | null };
}

export async function runEmailPipeline(
  input: PipelineEmailInput,
  options: PipelineOptions = {}
): Promise<PipelineOutcome> {
  const classification = await classifyEmailHybrid({
    email: input.email,
    provider: options.textProvider,
  });
  const meta: PipelineMeta = {
    classifier: classification.engine,
    extractor: { si: null, bl: null },
    comparer: null,
  };
  const extracted: PipelineOutcome["extracted"] = { si: null, bl: null };
  const evidence: PipelineOutcome["evidence"] = { si: null, bl: null };

  if (classification.category !== "BL_COMPARISON") {
    return {
      result: applyClassificationConfidence(classification, buildOk(classification.category)),
      meta,
      extracted,
      evidence,
    };
  }

  const { siDoc, blDoc, leftoverOtherType, leftoverUnreadable } = await resolveDocumentPair(
    input.attachments,
    options.textProvider
  );

  if (!siDoc || !blDoc) {
    // 配不上对，不等于"没有附件"：附件在、但读不出来或明显不是 SI/BL 时，要照实报给人看，
    // 不能落到"没要求比对就判 OK"那条路上（2026-09-22 扰动测试 pt1 暴露：附件名去掉 _SI/_BL
    // 标记后，读不出的 BL 和冒充 BL 的发票都被静默判成了 OK，10 封全错）。
    // 优先级和下面文件名配对路径保持一致：先 wrong_doc_type，再 unreadable。
    const reason: ReviewReason | null = leftoverOtherType
      ? "wrong_doc_type"
      : leftoverUnreadable
        ? "unreadable"
        : emailAsksForComparison(input.email.body)
          ? "missing_attachment"
          : null;
    const result = applyClassificationConfidence(
      classification,
      reason ? buildReview(classification.category, reason) : buildOk(classification.category)
    );
    return { result, meta, extracted, evidence };
  }

  const si =
    siDoc.parseStatus === "ok"
      ? await extractFields({
          documentText: siDoc.text,
          documentType: "SI",
          provider: options.textProvider,
        })
      : null;
  const bl =
    blDoc.parseStatus === "ok"
      ? await extractFields({
          documentText: blDoc.text,
          documentType: "BL",
          provider: options.textProvider,
        })
      : null;
  meta.extractor = { si: si?.extracted_by ?? null, bl: bl?.extracted_by ?? null };

  if (si?.document_type === "OTHER" || bl?.document_type === "OTHER") {
    return { result: buildReview(classification.category, "wrong_doc_type"), meta, extracted, evidence };
  }
  if (siDoc.parseStatus !== "ok" || blDoc.parseStatus !== "ok" || !si || !bl) {
    return { result: buildReview(classification.category, "unreadable"), meta, extracted, evidence };
  }

  extracted.si = si.fields;
  extracted.bl = bl.fields;
  evidence.si = si.evidence;
  evidence.bl = bl.evidence;

  const missingField = COMPARED_FIELDS.some(
    (field) => !si.fields[field] || !bl.fields[field]
  );
  if (missingField) {
    return { result: buildReview(classification.category, "missing_value"), meta, extracted, evidence };
  }

  const comparison = await compareDocumentsHybrid({ si: si.fields, bl: bl.fields });
  meta.comparer = comparison.engine;
  return {
    result: applyClassificationConfidence(classification, {
      category: classification.category,
      status: comparison.status,
      review_reason: null,
      defect_fields: comparison.defect_fields,
      has_defect: comparison.has_defect,
    }),
    meta,
    extracted,
    evidence,
  };
}

export interface BatchPipelineOptions extends PipelineOptions {
  /** 同时最多处理几封，默认 4（见 CLAUDE.md「高并发」的限量并发要求） */
  concurrency?: number;
  onProgress?: (done: number, total: number, emailId: string) => void;
}

export interface BatchPipelineOutcome {
  succeeded: { input: PipelineEmailInput; outcome: PipelineOutcome }[];
  failed: { input: PipelineEmailInput; error: unknown }[];
}

/** 批量跑：限量并发 + 单封失败不拖垮整批 */
export async function runBatchPipeline(
  inputs: PipelineEmailInput[],
  options: BatchPipelineOptions = {}
): Promise<BatchPipelineOutcome> {
  let done = 0; // 本次调用内的局部变量，天然并发安全

  const outcome = await mapWithConcurrencyLimit(
    inputs,
    async (input) => {
      const result = await runEmailPipeline(input, options);
      done += 1;
      options.onProgress?.(done, inputs.length, input.email.email_id);
      return result;
    },
    { concurrency: options.concurrency ?? 4 }
  );

  return {
    succeeded: outcome.succeeded.map((entry) => ({ input: entry.item, outcome: entry.result })),
    failed: outcome.failed.map((entry) => ({ input: entry.item, error: entry.error })),
  };
}

/**
 * 邮件级输入指纹（含附件解析结果）：内容没变、引擎版本没变，重跑时可以整封跳过。
 */
export function computeInputHash(input: PipelineEmailInput): string {
  const payload = {
    email: {
      email_id: input.email.email_id,
      from: input.email.from,
      subject: input.email.subject,
      body: input.email.body,
      attachments: input.email.attachments,
    },
    documents: input.attachments.map((attachment) => ({
      path: attachment.path,
      parseStatus: attachment.parseStatus,
      text: attachment.text,
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// "请把 SI 和 draft BL 对比/核对一下"——承诺了要核对，附件却缺失 → missing_attachment；
// 而"请把 draft BL 发来检查"只是索取文件 → 不触发
const ASKS_COMPARISON = /(compare|check)[^.\n]{0,60}(si\b|draft\s*bl|bill\s+of\s+lading)/i;

export function emailAsksForComparison(body: string): boolean {
  return ASKS_COMPARISON.test(body);
}

function findDocument(
  attachments: PipelineAttachment[],
  marker: "_SI" | "_BL"
): PipelineAttachment | undefined {
  const pattern = marker === "_SI" ? /_SI[._]/i : /_BL[._]/i;
  return attachments.find((attachment) => pattern.test(attachment.path));
}

/**
 * 配对 SI / BL 附件（2026-09-21 P0-3，见 DECISION_LOG 决策 26）：
 * 1. 先按文件名的 _SI / _BL 标记配对（历史行为，样例数据走这条）；
 * 2. 有缺位时，对没被占用、且能读出文字的附件按内容识别（关键词规则为准，规则判不出才问模型链），
 *    只补缺的那一侧，同一份附件不会被 SI 和 BL 抢两次；
 * 3. 内容也认不出就维持缺位，同时如实报告"为什么缺"——有读不出的附件（leftoverUnreadable），
 *    或者有能读但明显不是 SI/BL 的附件（leftoverOtherType），调用方据此判 unreadable / wrong_doc_type，
 *    而不是把"附件在但用不了"当成"根本没附件"。
 * 识别规则本身只在 lib/shared/document-identify.ts / document-identify-llm.ts，这里不重写。
 */
interface DocumentPairResolution {
  siDoc?: PipelineAttachment;
  blDoc?: PipelineAttachment;
  leftoverOtherType: boolean;
  leftoverUnreadable: boolean;
}

async function resolveDocumentPair(
  attachments: PipelineAttachment[],
  preferred?: LLMProvider
): Promise<DocumentPairResolution> {
  let siDoc = findDocument(attachments, "_SI");
  let blDoc = findDocument(attachments, "_BL");
  if (siDoc && blDoc) return { siDoc, blDoc, leftoverOtherType: false, leftoverUnreadable: false };

  const claimed = new Set(
    [siDoc, blDoc].filter((doc): doc is PipelineAttachment => Boolean(doc))
  );
  const unclaimed = attachments.filter((attachment) => !claimed.has(attachment));
  let leftoverOtherType = false;
  for (const candidate of unclaimed) {
    if (siDoc && blDoc) break;
    if (candidate.parseStatus !== "ok") continue;
    const type = await identifyDocumentTypeSmart(candidate.text, preferred);
    if (type === "SI" && !siDoc) siDoc = candidate;
    else if (type === "BL" && !blDoc) blDoc = candidate;
    else if (type === "OTHER") leftoverOtherType = true;
  }
  const leftoverUnreadable = unclaimed.some(
    (attachment) => attachment.parseStatus !== "ok" && attachment !== siDoc && attachment !== blDoc
  );
  return { siDoc, blDoc, leftoverOtherType, leftoverUnreadable };
}

function buildOk(category: EmailVerificationResult["category"]): EmailVerificationResult {
  return {
    category,
    status: "OK",
    review_reason: null,
    defect_fields: [],
    has_defect: false,
  };
}

function buildReview(
  category: EmailVerificationResult["category"],
  reason: ReviewReason
): EmailVerificationResult {
  return {
    category,
    status: "NEEDS_REVIEW",
    review_reason: reason,
    defect_fields: [],
    has_defect: false,
  };
}

/**
 * Jev 分类给了结果但置信度低于阈值时（engine==="jev" && needs_review），
 * 如果流程本来判定 OK，改成 NEEDS_REVIEW，让"系统对邮件分类没把握"这件事在复核队列里有入口
 * ——这个信号 classifyEmailHybrid 早就算出来了（见 classification/logic/index.ts），
 * 之前一直被这里丢掉没用上（DECISION_LOG 决策31②记录的已知缺口）。
 * "全部模型失败"（engine==="degraded"）不在这里处理：那种情况已经靠 model_provider
 * 前缀 "degraded/" 单独进复核队列（见 lib/shared/review/store.ts），不需要再改 status。
 * 已经是 MISMATCH / 其它原因的 NEEDS_REVIEW 不覆盖，保留更具体的原因。
 */
function applyClassificationConfidence(
  classification: HybridClassificationResult,
  result: EmailVerificationResult
): EmailVerificationResult {
  if (classification.engine === "jev" && classification.needs_review && result.status === "OK") {
    return { ...result, status: "NEEDS_REVIEW", review_reason: "low_confidence_classification" };
  }
  return result;
}
