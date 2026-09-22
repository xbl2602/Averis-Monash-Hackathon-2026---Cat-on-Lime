/**
 * 多 LLM 统一调用层（见 CLAUDE.md "多LLM支持"）。
 * 所有 feature 模块的 logic/ 只应该 import 这个文件里的 callLLM，
 * 不要在 feature 模块内部直接 import 某个具体 LLM 的 SDK。
 *
 * 公共区文件，改动前先跟操作者确认。
 */
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { generateText, type LanguageModel } from "ai";
import { isJevAvailable } from "./jev";
import { isTimeoutError, LLMConfigError, UpstreamServiceError } from "./errors";

// provider 的唯一权威清单，类型和运行时校验都从这里派生，不要另起一份
export const LLM_PROVIDER_IDS = [
  "claude",
  "openai",
  "deepseek",
  "gemini",
  "lmstudio",
  "jev",
] as const;

export type LLMProvider = (typeof LLM_PROVIDER_IDS)[number];

/**
 * 文本生成类 provider（extraction 这种"写出一段文字"的场景用）。
 * jev 是结构化决策模型、不生成文本，不在其中；`as const satisfies` 保证它一定是
 * LLM_PROVIDER_IDS 的子集，且保留字面量类型（z.enum(TEXT_PROVIDER_IDS) 需要）。
 */
export const TEXT_PROVIDER_IDS = [
  "claude",
  "openai",
  "deepseek",
  "gemini",
  "lmstudio",
] as const satisfies readonly LLMProvider[];

export type TextLLMProvider = (typeof TEXT_PROVIDER_IDS)[number];

// 校验任意输入是不是合法的 provider（API/MCP 路由解析请求时用）
export function isLLMProvider(value: unknown): value is LLMProvider {
  return typeof value === "string" && (LLM_PROVIDER_IDS as readonly string[]).includes(value);
}

// 校验任意输入是不是"能写文字的 provider"（extraction 的 REST/MCP 用）
export function isTextProvider(value: unknown): value is TextLLMProvider {
  return typeof value === "string" && (TEXT_PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * 单次尝试的超时上限（毫秒）。按线上实测校准（2026-09-22）：Gemini 分类约 2s，但**字段抽取要 8~10s、偶尔 16s**；
 * 试过 10s，结果把正常但偏慢的 Gemini 抽取当成卡住切断了。所以单次上限保持 20s——这主要给"显式指定、没有备用模型"
 * 的调用用；回退链里每个模型另有 15s 的上限（见 lib/shared/llm-chain.ts），首选卡住时不会把时间耗光。
 * 真正治"一个卡住的模型拖 42s"的是下面两条：超时不再原地重试、SDK 自带重试关掉。
 */
const LLM_CALL_TIMEOUT_MS = 20_000;

/** 一次 callLLM（含那一次重试）默认最多花多久；回退链会传一个更小的值进来（见 lib/shared/llm-chain.ts） */
const LLM_PROVIDER_BUDGET_MS = 22_000;

/** 剩余时间不够一次像样的尝试就不再重试（避免发出一个注定超时的请求） */
const MIN_ATTEMPT_MS = 3_000;

/**
 * 暂时性错误的自动重试延迟（毫秒）。只重试一次，且只对"很快就失败、大概率是临时抖动"的错误重试
 * （限流/上游5xx/网络错误）；401/403/402/400/422 这类"重试也没用"的错误不重试。
 *
 * 2026-09-22 两处改动：
 * - **超时不再原地重试**：卡住的服务再等一次多半还是卡，直接交给回退链换下一个 provider 更划算。
 * - **关掉 SDK 自带的重试**（generateText 的 maxRetries 默认是 2）：以前 SDK 内部重试 2 次、这里再重试 1 次，
 *   实测一个持续 500 的模型会被请求 6 次、拖 14s，和"只重试一次"的设计不符。现在重试只发生在这一处。
 * 这一层重试只发生在单个 provider 内部；"换下一家"由 lib/shared/llm-chain.ts 负责，两者是叠加关系。
 */
const RETRY_DELAY_MS = 2_000;

function isRetryableUpstreamError(err: UpstreamServiceError): boolean {
  return err.code === "rate_limited" || err.code === "upstream_error" || err.code === "network_error";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const LLM_PROVIDERS: { id: LLMProvider; label: string; cloudOnly: boolean }[] = [
  { id: "claude", label: "Claude (Anthropic)", cloudOnly: false },
  { id: "openai", label: "ChatGPT (OpenAI)", cloudOnly: false },
  { id: "deepseek", label: "DeepSeek", cloudOnly: false },
  { id: "gemini", label: "Gemini (Google)", cloudOnly: false },
  { id: "lmstudio", label: "本地 LM Studio", cloudOnly: true }, // cloudOnly=true 这个命名有点反直觉：意思是"只能在非云端环境用"，见下面 isLocalLLMAvailable
  { id: "jev", label: "Jev (TypeSafe 结构化决策)", cloudOnly: false }, // 只能做结构化判断，不支持文本生成，见 lib/llm/jev.ts
];

// 判断当前是不是跑在 Vercel 云端——Vercel 会自动设置这个环境变量
function isRunningOnVercel(): boolean {
  return process.env.VERCEL === "1";
}

// 本地 LM Studio 只有在不是 Vercel 云端部署时才可用（见 CLAUDE.md 的说明：
// Vercel 服务器访问不到操作者自己电脑上的 LM Studio）
export function isLocalLLMAvailable(): boolean {
  return !isRunningOnVercel();
}

/**
 * 各 provider 对应的环境变量名（写死一份，和 .env.example 保持一致）。
 * LM Studio 不需要 key（靠“是不是 Vercel 云端”判断），Jev 用 TYPESAFE_API_KEY，单独处理。
 */
const PROVIDER_KEY_ENV_VARS: Record<Exclude<LLMProvider, "lmstudio" | "jev">, string> = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  gemini: "GOOGLE_GENERATIVE_AI_API_KEY",
};

/**
 * 这个 provider 现在能不能用（key 配没配齐）。
 *
 * 环境变量在进程启动后不会变，所以这里直接读、不做缓存（规范禁止模块级可变状态）。
 * 说明：LM Studio 不需要 apiKey，只要在本地/Docker 环境就算就绪；
 *       Jev 用 isJevAvailable()（TYPESAFE_API_KEY），避免两处各写一份判断。
 */
export function isProviderConfigured(provider: LLMProvider): boolean {
  if (provider === "lmstudio") return isLocalLLMAvailable();
  if (provider === "jev") return isJevAvailable();
  return Boolean(process.env[PROVIDER_KEY_ENV_VARS[provider]]);
}

/**
 * 文本模型的安全兜底顺序（2026-09-21 新增，P0-2，见 DECISION_LOG 决策 25）：
 * 首选（显式传入的 provider）排最前，其余按固定顺序补齐；只保留当前配了 key 的。
 * gemini 放第一是因为它是本项目的 demo 兜底（见 CLAUDE.md）；lmstudio 只有本地可用。
 * 现算现用，不做模块级缓存（规范禁止模块级可变状态；环境变量本身进程内不变）。
 */
const TEXT_FALLBACK_ORDER: readonly TextLLMProvider[] = [
  "gemini",
  "deepseek",
  "openai",
  "claude",
  "lmstudio",
];

export function orderedTextProviders(preferred?: LLMProvider): TextLLMProvider[] {
  const ordered = [...TEXT_FALLBACK_ORDER];
  if (preferred && preferred !== "jev") {
    const index = ordered.indexOf(preferred as TextLLMProvider);
    if (index >= 0) {
      ordered.splice(index, 1);
      ordered.unshift(preferred as TextLLMProvider);
    }
  }
  return ordered.filter((provider) => isProviderConfigured(provider));
}

/** provider 不可用时给用户的可读说明（含要配哪个环境变量） */
function unavailableProviderMessage(provider: LLMProvider): string {
  switch (provider) {
    case "lmstudio":
      return "本地 LM Studio 只能在本地/Docker 部署模式下使用，当前部署环境（Vercel）不支持，请换一个 provider";
    case "jev":
      return "缺少 TYPESAFE_API_KEY 环境变量，无法调用 Jev。请在 .env.local 或部署平台配置该变量，或改用其他 provider";
    default:
      return `provider「${provider}」当前不可用：缺少环境变量 ${PROVIDER_KEY_ENV_VARS[provider]}（或在部署平台上没有配置）。请在 .env.local / 部署平台补上后重试，或换一个已配置的 provider`;
  }
}

function getModel(provider: LLMProvider): LanguageModel {
  switch (provider) {
    case "claude":
      // 模型名以 Anthropic 官方文档为准，这里先用一个当前可用的型号，AI 写代码时如有需要自行核实最新名称
      return anthropic("claude-sonnet-4-5");
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })("gpt-4o-mini");
    case "deepseek":
      // DeepSeek 的 API 兼容 OpenAI 协议，复用 openai provider，只换 baseURL + apiKey
      return createOpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com/v1",
      })("deepseek-chat");
    case "gemini":
      // gemini-2.0-flash 已被 Google 下线，API 返回的错误里明确建议改用 gemini-3.6-flash
      return google("gemini-3.6-flash");
    case "lmstudio":
      if (!isLocalLLMAvailable()) {
        throw new Error(
          "本地 LM Studio 只能在本地/Docker 部署模式下使用，当前部署环境（Vercel）不支持，请换一个 provider"
        );
      }
      // LM Studio 同样兼容 OpenAI 协议，本地起服务不需要真的 apiKey
      return createOpenAI({
        apiKey: "lm-studio",
        baseURL: process.env.LM_STUDIO_BASE_URL || "http://localhost:1234/v1",
      })("local-model");
    case "jev":
      // Jev 是结构化决策模型，不走文本生成这条路，主动给出可读的错误而不是让 SDK 报奇怪的类型错
      throw new Error(
        "Jev 只能做结构化决策（分类/比对），不支持文本生成/抽取。请改用 lib/llm 的 callJev()，或换一个文本 LLM provider。"
      );
  }
}

/**
 * 统一的 LLM 调用入口。所有模块都应该通过这个函数调用 LLM，不要各自直接用 SDK。
 * 遵守"调试规范"：外部调用失败要能被上层感知（抛出有意义的错误），不在这里静默吞掉。
 *
 * 失败约定（2026-09-20 可靠性/安全评审；2026-09-21 P1-2 加自动重试；2026-09-22 收紧时间）：
 * - 本地没配 key → LLMConfigError（可读，含环境变量名），不重试（配置问题重试也没用）
 * - 上游限流/5xx/网络错误 → 等 `RETRY_DELAY_MS` 后重试一次（前提是剩余时间还够）；仍失败才抛出
 *   UpstreamServiceError（message 只含 provider + 状态 + 稳定 code；原始错误详情只进
 *   console.warn，不拼进 message、不原样回传）
 * - 超时 → 不重试，直接抛出（交给回退链换下一个 provider）
 * - 401/402/403/400/422 这类确定性错误 → 不重试，直接抛出
 *
 * `timeoutMs` = 这一次 callLLM（含重试）最多花多久，默认 LLM_PROVIDER_BUDGET_MS；每次尝试的超时取
 * min(LLM_CALL_TIMEOUT_MS, 剩余时间)，所以调用方给的时间上限一定守得住。
 */
export async function callLLM(
  provider: LLMProvider,
  prompt: string,
  options?: { system?: string; timeoutMs?: number }
): Promise<string> {
  if (!isProviderConfigured(provider)) {
    throw new LLMConfigError(unavailableProviderMessage(provider));
  }
  const model = getModel(provider);
  const deadline = Date.now() + (options?.timeoutMs ?? LLM_PROVIDER_BUDGET_MS);

  const attemptOnce = async (): Promise<string> => {
    const { text } = await generateText({
      model,
      system: options?.system,
      prompt,
      // 重试只在下面这一处做；SDK 默认的内部重试会让"重试一次"变成最多 6 次请求
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(Math.max(1, Math.min(LLM_CALL_TIMEOUT_MS, deadline - Date.now()))),
    });
    return text;
  };

  try {
    return await attemptOnce();
  } catch (firstErr) {
    const firstUpstreamErr = toUpstreamServiceError(provider, firstErr);
    const timeLeftAfterDelay = deadline - Date.now() - RETRY_DELAY_MS;
    if (!isRetryableUpstreamError(firstUpstreamErr) || timeLeftAfterDelay < MIN_ATTEMPT_MS) {
      throw firstUpstreamErr;
    }
    console.warn(
      `[llm] ${provider} 首次调用失败（${firstUpstreamErr.code}），${RETRY_DELAY_MS}ms 后重试一次`
    );
    await delay(RETRY_DELAY_MS);
    try {
      return await attemptOnce();
    } catch (secondErr) {
      throw toUpstreamServiceError(provider, secondErr);
    }
  }
}

function toUpstreamServiceError(provider: LLMProvider, err: unknown): UpstreamServiceError {
  const detail = err instanceof Error ? err.message : String(err);
  console.warn(`[llm] 调用 ${provider} 失败（原始信息只进服务端日志）：${detail}`);

  if (isTimeoutError(err)) {
    return new UpstreamServiceError({ provider, status: 504, code: "timeout" });
  }
  const statusCode = upstreamStatusOf(err);
  if (statusCode !== null) {
    return new UpstreamServiceError({
      provider,
      status: statusCode,
      code: upstreamCodeOf(statusCode),
    });
  }
  return new UpstreamServiceError({ provider, status: 502, code: "network_error" });
}

/**
 * 上游真实的 HTTP 状态码。SDK 有时会把原始错误包一层（RetryError 的 lastError、或 cause），
 * 以前只看最外层，实测上游明明回的是 500，报出来却成了"502 network_error"。
 */
function upstreamStatusOf(err: unknown): number | null {
  let current: unknown = err;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    const statusCode = (current as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === "number" && Number.isFinite(statusCode)) return statusCode;
    const wrapped = current as { lastError?: unknown; cause?: unknown };
    current = wrapped.lastError ?? wrapped.cause;
  }
  return null;
}

function upstreamCodeOf(statusCode: number): string {
  if (statusCode === 401 || statusCode === 403) return "unauthorized";
  if (statusCode === 402) return "payment_required";
  if (statusCode === 429) return "rate_limited";
  if (statusCode === 400 || statusCode === 422) return "invalid_request";
  if (statusCode >= 500) return "upstream_error";
  return "http_error";
}

// Jev（TypeSafe System One）适配层：和 callLLM 是并列的两条能力，不是同一个东西。
// 需要"让模型在固定选项里做判断"时用 callJev；需要"写出一段文字"时用 callLLM。
export {
  JEV_TIMEOUT_MS,
  callJev,
  isJevAvailable,
  resolveJevModel,
  type JevAnswer,
  type JevChoiceAnswer,
  type JevNoulAnswer,
  type JevQuestion,
  type JevResponse,
  type JevScoreAnswer,
  type JevState,
} from "./jev";

// LLM 层的可读错误类型：REST/MCP 的错误映射层用它（见 lib/shared/request-errors.ts）
export {
  LLMConfigError,
  UpstreamServiceError,
  isTimeoutError,
  type UpstreamServiceErrorInfo,
} from "./errors";
