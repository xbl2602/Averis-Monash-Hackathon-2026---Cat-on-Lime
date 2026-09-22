/**
 * 文本模型"逐个兜底"的统一调用链（2026-09-21 新增，P0-2 的公共层）。
 *
 * 为什么需要它：混合引擎允许"首选模型失败就换下一个"，但缓存、超时、错误包装
 * 都要和单模型路径完全一致——这层把这些细节收在一处，feature 模块不要再各写一遍循环。
 *
 * 约定：
 * - 顺序由 lib/llm 的 orderedTextProviders() 给出（首选最前，其余按固定顺序，只含配了 key 的）
 * - 每次尝试都走 callWithCache（按 provider 分别缓存；失败不会被缓存）
 * - 单次尝试失败只记服务端日志并继续下一个；全部失败才抛出可读的汇总错误
 * - 整条链有总时限（2026-09-22 新增）：默认 CHAIN_BUDGET_MS，单个 provider 最多占 PER_PROVIDER_CAP_MS，
 *   保证首选卡住时下一个 provider 仍然有机会；时间用完就停，让上层走降级兜底，而不是被平台超时整个掐断
 * - 只用于"混合引擎"路径；用户显式指定 provider 的单独接口要保持"选谁就只试谁"，
 *   不能悄悄换模型让它看起来成功了（那是红线上说的"装作成功"）
 */
import { callLLM, orderedTextProviders, type LLMProvider, type TextLLMProvider } from "@/lib/llm";
import { callWithCache } from "./llm-cache";

export interface TextChainResult {
  text: string;
  /** 实际成功给出结果的 provider（可能不是首选） */
  provider: TextLLMProvider;
}

export interface TextChainOptions {
  /** 用途标签，进缓存键和排查日志，例如 "classification_llm" / "document_identify" */
  purpose: string;
  prompt: string;
  /** 首选 provider（显式传入的排最前）；不传则用默认顺序（gemini 开头） */
  preferred?: LLMProvider;
  system?: string;
  /** 整条链最多花多久（毫秒），默认 CHAIN_BUDGET_MS；调用方已经花掉一部分时间时传剩余值 */
  budgetMs?: number;
}

/**
 * 整条链的默认总时限。按平台上限倒推：分类/抽取/sandbox 接口 30s，分类前面还有 Jev（最多 10s），
 * 所以链本身不能超过 20s。
 */
export const CHAIN_BUDGET_MS = 20_000;
/** 单个 provider 最多占多久：一次 10s 的尝试 + 重试余量，给后面的 provider 留出时间 */
const PER_PROVIDER_CAP_MS = 12_000;
/** 剩余时间少于这个就不再尝试下一个（一个注定超时的请求只会拖慢降级兜底） */
const MIN_PROVIDER_MS = 3_000;

export async function callTextLLMChain(options: TextChainOptions): Promise<TextChainResult> {
  const providers = orderedTextProviders(options.preferred);
  if (providers.length === 0) {
    throw new Error(
      "没有可用的文本模型：所有 provider 都未配置 API key（至少配置一个，如 GOOGLE_GENERATIVE_AI_API_KEY，见 .env.example）"
    );
  }

  const deadline = Date.now() + (options.budgetMs ?? CHAIN_BUDGET_MS);
  const failures: string[] = [];
  for (const provider of providers) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_PROVIDER_MS) {
      failures.push(`${provider}（时间预算已用完，没有尝试）`);
      continue;
    }
    const timeoutMs = Math.min(PER_PROVIDER_CAP_MS, remaining);
    try {
      const { value } = await callWithCache({
        purpose: options.purpose,
        provider,
        model: provider,
        request: { prompt: options.prompt, system: options.system },
        execute: () => callLLM(provider, options.prompt, { system: options.system, timeoutMs }),
      });
      return { text: value, provider };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[llm-chain] ${options.purpose}：${provider} 失败，尝试下一个：${message}`);
      failures.push(`${provider}（${message}）`);
    }
  }

  throw new Error(`所有可用的文本模型都调用失败：${failures.join("；")}`);
}
