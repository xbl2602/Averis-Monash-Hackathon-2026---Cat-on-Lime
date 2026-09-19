import {
  callJev,
  callLLM,
  type JevQuestion,
  type LLMProvider,
} from "@/lib/llm";
import type { InboxEmail, EmailCategory } from "@/lib/shared/types";

export interface ClassifyEmailInput {
  email: InboxEmail;
  /** 用哪个模型分类。默认 claude（demo 兜底）；传 "jev" 时走结构化决策，带置信度 */
  provider?: LLMProvider;
}

export interface ClassifyEmailResult {
  category: EmailCategory;
  /** 0~1 的置信度；只有 Jev 这种结构化模型能给，文本 LLM 路径为 null */
  confidence: number | null;
  /** 置信度低于阈值时为 true，提示这封邮件需要人工确认（对应题目第④条） */
  needs_review: boolean;
}

const CATEGORIES: EmailCategory[] = [
  "BL_COMPARISON",
  "SI_REQUEST",
  "INVOICE_QUERY",
  "GENERAL",
  "SPAM",
];

// 每个类别的含义——既给 Jev 当 choice 的判据，也给文本 LLM 当 prompt 说明
const CATEGORY_DEFINITIONS: Record<EmailCategory, string> = {
  BL_COMPARISON: "发来提单(BL)草稿并要求核对/确认其与装运指示(SI)是否一致",
  SI_REQUEST: "发来或索取装运指示(SI / Shipping Instruction)",
  INVOICE_QUERY: "询问发票、费用、付款相关的事宜",
  GENERAL: "其他正常航运业务往来，不属于上面几类，也不是垃圾邮件",
  SPAM: "广告、钓鱼或与航运业务无关的垃圾邮件",
};

// 低于这个置信度就标记为需要人工介入，不再盲目相信自动分类结果
const JEV_CONFIDENCE_THRESHOLD = 0.6;

export async function classifyEmail(
  input: ClassifyEmailInput
): Promise<ClassifyEmailResult> {
  const provider = input.provider ?? "claude";
  if (provider === "jev") {
    return classifyWithJev(input.email);
  }
  return classifyWithTextLLM(provider, input.email);
}

async function classifyWithJev(email: InboxEmail): Promise<ClassifyEmailResult> {
  const questions: Record<string, JevQuestion> = {
    category: {
      type: "choice",
      instructions: "这封邮件属于哪一类？",
      criteria: CATEGORY_DEFINITIONS,
    },
  };

  const { answers } = await callJev(
    { from: email.from, subject: email.subject, body: email.body },
    questions
  );

  const answer = answers.category;
  if (!answer || answer.type !== "choice") {
    throw new Error("Jev 返回的分类结果格式异常：缺少 category choice 答案");
  }

  return {
    category: asCategory(answer.choice),
    confidence: answer.confidence,
    needs_review: answer.confidence < JEV_CONFIDENCE_THRESHOLD,
  };
}

async function classifyWithTextLLM(
  provider: LLMProvider,
  email: InboxEmail
): Promise<ClassifyEmailResult> {
  const definitions = CATEGORIES.map(
    (c) => `- ${c}: ${CATEGORY_DEFINITIONS[c]}`
  ).join("\n");

  const text = await callLLM(
    provider,
    `请判断下面这封航运邮件属于哪一类，只回答类别代号本身，不要解释、不要加标点或其它文字。

可选类别：
${definitions}

邮件：
From: ${email.from}
Subject: ${email.subject}
Body:
${email.body}`
  );

  const category = CATEGORIES.find((c) => text.toUpperCase().includes(c));
  if (!category) {
    throw new Error(
      `分类失败：模型没有返回合法的类别代号（可选值：${CATEGORIES.join(" / ")}），实际返回：${text.slice(0, 200)}`
    );
  }

  return { category, confidence: null, needs_review: false };
}

// 防御 Jev 返回了 criteria 之外的字符串（理论上不会，因为只让它在给定选项里选）
function asCategory(value: string): EmailCategory {
  const found = CATEGORIES.find((c) => c === value);
  if (!found) {
    throw new Error(`分类失败：Jev 返回了未知类别 "${value}"`);
  }
  return found;
}
