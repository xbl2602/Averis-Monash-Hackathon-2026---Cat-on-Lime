/**
 * 按内容识别文档类型的"规则 + LLM 兜底"版本（2026-09-21 新增，P0-3）。
 *
 * 分层（和分类引擎同一个思路：确定性优先，模型只碰中间地带）：
 * 1. 关键词规则（document-identify.ts，纯函数、import 上传模块已在用）能判就直接返回；
 * 2. 规则判不出来（UNKNOWN）才问文本模型链，且模型只允许在 SI / BL / OTHER / UNKNOWN 里选一个；
 * 3. 模型也失败：按 UNKNOWN 处理（上层走"缺附件/读不了"的既有分支，不会崩）。
 *
 * 模型输入只有文档文本片段（不含文件名/路径/邮件元数据，见 DECISION_SPEC 的模型输入契约）。
 */
import type { LLMProvider } from "@/lib/llm";
import { identifyDocumentType } from "./document-identify";
import { callTextLLMChain } from "./llm-chain";
import type { DocumentType } from "./types";

// 只看开头这段就够判断（标题/关键词都在最前面几个段落），避免整篇进模型
const SNIPPET_LENGTH = 2000;

const ALLOWED_TYPES: readonly string[] = ["SI", "BL", "OTHER", "UNKNOWN"];

export async function identifyDocumentTypeSmart(
  text: string,
  preferred?: LLMProvider
): Promise<DocumentType> {
  const ruled = identifyDocumentType(text);
  if (ruled !== "UNKNOWN") return ruled;

  const snippet = text.slice(0, SNIPPET_LENGTH);
  const prompt = `你是航运单证分类助手。只根据下面的文档文本判断它属于哪一种，只回答一个词，不要解释：
SI（装运指示 Shipping Instruction）
BL（提单或提单草稿 Bill of Lading）
OTHER（商业发票/装箱单/产地证等其他文档）
UNKNOWN（无法判断）

文档文本：
${snippet}`;

  try {
    const { text: answer } = await callTextLLMChain({
      purpose: "document_identify",
      prompt,
      preferred,
    });
    return parseDocumentTypeAnswer(answer);
  } catch (err) {
    console.warn(
      `[document-identify] 规则判不出且模型兜底失败，按 UNKNOWN 处理：${err instanceof Error ? err.message : err}`
    );
    return "UNKNOWN";
  }
}

/** 模型回答只认第一个独立的合法词；答非所问一律当 UNKNOWN（不硬猜） */
function parseDocumentTypeAnswer(answer: string): DocumentType {
  const tokens = answer.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  const hit = tokens.find((token) => ALLOWED_TYPES.includes(token));
  return (hit as DocumentType | undefined) ?? "UNKNOWN";
}
