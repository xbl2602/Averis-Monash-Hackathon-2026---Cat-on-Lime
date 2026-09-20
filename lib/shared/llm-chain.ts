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
}

export async function callTextLLMChain(options: TextChainOptions): Promise<TextChainResult> {
  const providers = orderedTextProviders(options.preferred);
  if (providers.length === 0) {
    throw new Error(
      "没有可用的文本模型：所有 provider 都未配置 API key（至少配置一个，如 GOOGLE_GENERATIVE_AI_API_KEY，见 .env.example）"
    );
  }

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const { value } = await callWithCache({
        purpose: options.purpose,
        provider,
        model: provider,
        request: { prompt: options.prompt, system: options.system },
        execute: () =>
          callLLM(provider, options.prompt, options.system ? { system: options.system } : undefined),
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
