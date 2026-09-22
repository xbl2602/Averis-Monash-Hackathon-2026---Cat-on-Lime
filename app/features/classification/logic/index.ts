import {
  callJev,
  callLLM,
  isJevAvailable,
  type JevQuestion,
  type LLMProvider,
} from "@/lib/llm";
import { CHAIN_BUDGET_MS, callTextLLMChain } from "@/lib/shared/llm-chain";
import { callWithCache } from "@/lib/shared/llm-cache";
import { EMAIL_CATEGORIES, type InboxEmail, type EmailCategory } from "@/lib/shared/types";
import { classifyByRules, classifyByRulesBestEffort } from "./rules";

export interface ClassifyEmailInput {
  email: InboxEmail;
  /**
   * 显式指定用哪个模型；**不传时走混合引擎**（规则优先 → Jev → 文本模型回退链：gemini → deepseek → …），
   * 这样本地没配任何 key 也能靠规则给出结果（demo 兜底，见 CLAUDE.md）。
   */
  provider?: LLMProvider;
}

export interface ClassifyEmailResult {
  category: EmailCategory;
  /** 0~1 的置信度；只有 Jev 这种结构化模型能给，文本 LLM / 规则路径为 null */
  confidence: number | null;
  /** 置信度低于阈值时为 true，提示这封邮件需要人工确认（对应题目第④条） */
  needs_review: boolean;
}

export interface HybridClassificationResult extends ClassifyEmailResult {
  /** 这次结果是谁给出的：规则 / Jev / 文本LLM链 / 全部失败后的尽力兜底（degraded） */
  engine: "rules" | "jev" | "llm" | "degraded";
}

// 类别清单的唯一来源是 lib/shared/types.ts 的 EMAIL_CATEGORIES，这里只是本地别名
const CATEGORIES: readonly EmailCategory[] = EMAIL_CATEGORIES;

// 每个类别的含义——既给 Jev 当 choice 的判据，也给文本 LLM 当 prompt 说明
const CATEGORY_DEFINITIONS: Record<EmailCategory, string> = {
  BL_COMPARISON: "发来提单(BL)草稿并要求核对/确认其与装运指示(SI)是否一致",
  SI_REQUEST: "发来或索取装运指示(SI / Shipping Instruction)",
  INVOICE_QUERY: "询问发票、费用、付款相关的事宜",
  GENERAL: "其他正常航运业务往来，不属于上面几类，也不是垃圾邮件",
  SPAM: "广告、钓鱼或与航运业务无关的垃圾邮件",
};

// 低于这个置信度就标记为需要人工介入（0.85 是操作者定的保守值：宁可多提示人工复核，也不放过去）
const JEV_CONFIDENCE_THRESHOLD = 0.85;

/**
 * 混合分类里"Jev + 文本模型链"两步合计最多花多久（2026-09-22）：分类接口的平台上限是 30s，
 * 留出规则、读邮件、返回响应的余量。Jev 卡满 10s 时，文本模型链还剩 14s（首选卡住也能换到下一个）。
 */
const MODEL_STEPS_BUDGET_MS = 24_000;

/**
 * 单一入口：显式按 provider 调用（给 REST/MCP/界面用）。
 * 不传 provider 时走混合引擎（规则优先，本地没 key 也能出结果），但对外只保留
 * `category/confidence/needs_review` 三个字段，响应契约与显式 provider 时完全一致。
 */
export async function classifyEmail(
  input: ClassifyEmailInput
): Promise<ClassifyEmailResult> {
  if (input.provider === undefined) {
    const hybrid = await classifyEmailHybrid(input);
    return {
      category: hybrid.category,
      confidence: hybrid.confidence,
      needs_review: hybrid.needs_review,
    };
  }
  if (input.provider === "jev") {
    return classifyWithJev(input.email);
  }
  return classifyWithTextLLM(input.provider, input.email);
}

/**
 * 混合分类（流水线默认）：高精度规则 → 拿不准交给 Jev → Jev 不可用/失败走文本模型链兜底 →
 * 全部失败用"尽力规则"降级（engine=degraded、needs_review=true，绝不整封抛错）。
 * 2026-09-20 全量强制重跑实测：520 封样例全部由规则直接判定（rules=520），模型只兜底规则判不了的新邮件。
 * 2026-09-21（P0-2）：每个环节单独 try/catch，前一级失败不影响后一级；失败原因只进服务端日志。
 */
export async function classifyEmailHybrid(
  input: ClassifyEmailInput
): Promise<HybridClassificationResult> {
  const ruled = classifyByRules({ subject: input.email.subject, body: input.email.body });
  if (ruled) {
    return { category: ruled.category, confidence: null, needs_review: false, engine: "rules" };
  }

  const modelStepsStartedAt = Date.now();
  if (isJevAvailable()) {
    try {
      const jev = await classifyWithJev(input.email);
      return { ...jev, engine: "jev" };
    } catch (err) {
      console.warn(
        `[classification] Jev 失败，降级到文本模型链：${err instanceof Error ? err.message : err}`
      );
    }
  }

  try {
    // Jev 用掉的时间从模型步骤的总预算里扣掉，保证整步守得住接口的 30s 上限（见 lib/shared/llm-chain.ts）
    const budgetMs = Math.min(CHAIN_BUDGET_MS, MODEL_STEPS_BUDGET_MS - (Date.now() - modelStepsStartedAt));
    const llm = await classifyWithTextChain(input.email, input.provider, budgetMs);
    return { ...llm, engine: "llm" };
  } catch (err) {
    console.warn(
      `[classification] 所有模型都失败，使用尽力规则兜底：${err instanceof Error ? err.message : err}`
    );
  }

  // 降级兜底：放宽门槛的规则再试一次；仍无信号就暂记 GENERAL（内部已标 degraded，可一键重试）
  const bestEffort = classifyByRulesBestEffort({
    subject: input.email.subject,
    body: input.email.body,
  });
  return {
    category: bestEffort?.category ?? "GENERAL",
    confidence: null,
    needs_review: true,
    engine: "degraded",
  };
}

/**
 * 模型输入的扁平化契约（见 docs/DECISION_SPEC.md §2.3/§2.4/§6）：
 * 发给 Jev / 文本 LLM 的只有这 3 个单层字符串字段；
 * 整个邮件对象、附件清单、元数据一律不出现在模型输入里。
 */
type FlatEmailInput = {
  from: string;
  subject: string;
  body: string;
};

function buildFlatEmailInput(email: InboxEmail): FlatEmailInput {
  return { from: email.from, subject: email.subject, body: email.body };
}

async function classifyWithJev(email: InboxEmail): Promise<ClassifyEmailResult> {
  const questions: Record<string, JevQuestion> = {
    category: {
      type: "choice",
      instructions: "这封邮件属于哪一类？",
      criteria: CATEGORY_DEFINITIONS,
    },
  };
  const state = buildFlatEmailInput(email);

  const { value } = await callWithCache({
    purpose: "classification",
    provider: "jev",
    model: process.env.JEV_MODEL || "jev-latest",
    request: { state, questions },
    execute: () => callJev(state, questions),
  });

  const answer = value.answers.category;
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
  const prompt = buildClassificationPrompt(email);

  const { value: text } = await callWithCache({
    purpose: "classification_llm",
    provider,
    model: provider,
    request: { prompt },
    execute: () => callLLM(provider, prompt),
  });

  return toTextLlmClassification(text);
}

/**
 * 混合引擎的文本兜底：显式选择的 provider 排最前，其余按固定顺序逐个尝试（只试配了 key 的）。
 * 显式指定 provider 的单独接口不走这条链（选谁就只试谁，不会悄悄换模型冒充成功）。
 */
async function classifyWithTextChain(
  email: InboxEmail,
  preferred: LLMProvider | undefined,
  budgetMs: number
): Promise<ClassifyEmailResult> {
  const prompt = buildClassificationPrompt(email);
  const { text } = await callTextLLMChain({
    purpose: "classification_llm",
    prompt,
    preferred,
    budgetMs,
  });
  return toTextLlmClassification(text);
}

function buildClassificationPrompt(email: InboxEmail): string {
  const definitions = CATEGORIES.map(
    (c) => `- ${c}: ${CATEGORY_DEFINITIONS[c]}`
  ).join("\n");
  const flat = buildFlatEmailInput(email);

  return `请判断下面这封航运邮件属于哪一类，只回答类别代号本身，不要解释、不要加标点或其它文字。

可选类别：
${definitions}

邮件：
From: ${flat.from}
Subject: ${flat.subject}
Body:
${flat.body}`;
}

function toTextLlmClassification(text: string): ClassifyEmailResult {
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
