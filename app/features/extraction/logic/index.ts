/**
 * 字段抽取（混合）：标签规则优先，缺字段时才调 LLM 兜底。
 * - 规则覆盖样例里全部正常文档（242 个可读文档中 237 个完整抽出、5 个是"类型不对"陷阱）
 * - LLM 兜底只在规则缺字段时触发；prompt 明确要求"找不到填 null、占位符填 null"，防止编造
 * - 明显不是 SI/BL 的文档直接返回 document_type=OTHER（上层据此判 wrong_doc_type），不浪费调用
 */
import { callLLM, type LLMProvider } from "@/lib/llm";
import { callTextLLMChain } from "@/lib/shared/llm-chain";
import { callWithCache } from "@/lib/shared/llm-cache";
import {
  COMPARED_FIELDS,
  type ComparedField,
  type ExtractedDocumentEvidence,
  type ExtractedDocumentFields,
  type ExtractDocumentResult,
} from "@/lib/shared/types";
import {
  isLikelyOtherDocument,
  parseDocumentFieldsWithEvidence,
  PLACEHOLDER_VALUE,
} from "./label-parser";

export interface ExtractFieldsInput {
  documentText: string;
  documentType: "SI" | "BL";
  /**
   * 显式指定：规则缺字段时**只用这一个**模型兜底，失败就只用规则结果（选谁就只试谁，不偷偷换模型）。
   * REST/MCP 的单文档接口传了 provider 时用这个。
   */
  provider?: LLMProvider;
  /**
   * 首选：规则缺字段时走文本模型回退链，这个排最前，失败自动换下一个配了 key 的（流水线用这个）。
   * provider 和 preferredProvider 都不传 = 走回退链、按默认顺序（gemini → deepseek → …）。
   */
  preferredProvider?: LLMProvider;
}

export async function extractFields(input: ExtractFieldsInput): Promise<ExtractDocumentResult> {
  if (isLikelyOtherDocument(input.documentText)) {
    return { document_type: "OTHER", fields: {}, extracted_by: "rules", evidence: {} };
  }

  const parsed = parseDocumentFieldsWithEvidence(input.documentText);
  const ruleFields = parsed.fields;
  const missing = COMPARED_FIELDS.filter((field) => !ruleFields[field]);
  if (missing.length === 0) {
    return {
      document_type: input.documentType,
      fields: ruleFields,
      extracted_by: "rules",
      evidence: parsed.evidence,
    };
  }

  const llmFields = await tryLlmExtraction(input);
  // 规则抽到的值经过校验、更可靠：规则优先，LLM 只补缺
  const merged: ExtractedDocumentFields = { ...(llmFields ?? {}), ...ruleFields };
  const usedLlm = (Object.keys(llmFields ?? {}) as ComparedField[]).some(
    (field) => !ruleFields[field]
  );
  // 出处：规则字段带行号+原句；LLM 补上的字段只标来源（没有行证据，不给假出处）
  const evidence: ExtractedDocumentEvidence = { ...parsed.evidence };
  if (llmFields) {
    for (const field of Object.keys(llmFields) as ComparedField[]) {
      if (!ruleFields[field]) evidence[field] = { source: "llm" };
    }
  }
  return {
    document_type: input.documentType,
    fields: merged,
    extracted_by: usedLlm ? "llm" : "rules",
    evidence,
  };
}

/**
 * 模型输入的扁平化契约（见 docs/DECISION_SPEC.md §3.3/§6）：
 * 只发 documentType（SI/BL）+ 单一纯文本文档内容；
 * 文件名、附件路径、解析元数据一律不进模型输入。
 */
async function tryLlmExtraction(
  input: ExtractFieldsInput
): Promise<ExtractedDocumentFields | null> {
  const prompt = buildExtractionPrompt(input);
  // 2026-09-22：以前是 `provider ?? "gemini"`，只试一个模型——Gemini 一出问题，抽取就没有备用模型，
  // 和分类的"失败自动换下一个"不一致（流水线页的说明也因此不准确）。现在只有显式指定时才只试一个。
  const route = input.provider ? `只用 ${input.provider}` : `回退链（首选 ${input.preferredProvider ?? "默认顺序"}）`;

  try {
    const raw = input.provider ? await callOneProvider(input.provider, prompt) : await callFallbackChain(input.preferredProvider, prompt);
    const parsed = parseJsonObject(raw);
    if (!parsed) {
      console.warn(`[extraction] LLM 兜底返回的不是合法 JSON，本次只用规则结果：${raw.slice(0, 200)}`);
      return null;
    }
    return sanitizeLlmFields(parsed);
  } catch (err) {
    // LLM 兜底失败（例如没配 key）时降级为"只用规则结果"：缺的字段会在上层被判 missing_value，
    // 不会因为一次兜底失败把整批拖垮；这里打印原因，方便排查（不是静默吞掉）
    console.warn(
      `[extraction] LLM 兜底调用失败（${route}），本次只用规则结果：`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

async function callOneProvider(provider: LLMProvider, prompt: string): Promise<string> {
  const { value } = await callWithCache({
    purpose: "extraction_llm",
    provider,
    model: provider,
    request: { prompt },
    execute: () => callLLM(provider, prompt),
  });
  return value;
}

// 缓存键和单模型路径一致（purpose/provider/model/request 相同），切换路径不会让已缓存的结果失效
async function callFallbackChain(preferred: LLMProvider | undefined, prompt: string): Promise<string> {
  const { text } = await callTextLLMChain({ purpose: "extraction_llm", prompt, preferred });
  return text;
}

function buildExtractionPrompt(input: ExtractFieldsInput): string {
  return `你是航运单证助手。请从下面的 ${input.documentType} 文档文本中抽取 7 个字段（按"含义"对齐，不要按原文字段名对齐）。

字段列表：${COMPARED_FIELDS.join(", ")}

规则：
- 只抽取文档里真实存在的值，绝对不要猜测
- 找不到的字段填 null；占位符（如 TBA / N/A / ____MT / 空白）也填 null
- 只输出一个 JSON 对象，不要解释、不要代码块

文档文本：
${input.documentText}`;
}

// 容忍模型把 JSON 包在代码块或多余文字里的情况
function parseJsonObject(text: string): Record<string, unknown> | null {
  const withoutFence = text.replace(/```(?:json)?/gi, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(withoutFence.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function sanitizeLlmFields(parsed: Record<string, unknown>): ExtractedDocumentFields {
  const fields: ExtractedDocumentFields = {};
  for (const field of COMPARED_FIELDS) {
    const raw = parsed[field];
    if (typeof raw !== "string") continue;
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned || PLACEHOLDER_VALUE.test(cleaned)) continue;
    fields[field] = cleaned;
  }
  return fields;
}
