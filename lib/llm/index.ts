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

// 校验任意输入是不是合法的 provider（API/MCP 路由解析请求时用）
export function isLLMProvider(value: unknown): value is LLMProvider {
  return typeof value === "string" && (LLM_PROVIDER_IDS as readonly string[]).includes(value);
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
      return google("gemini-2.0-flash");
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
 */
export async function callLLM(
  provider: LLMProvider,
  prompt: string,
  options?: { system?: string }
): Promise<string> {
  const model = getModel(provider);
  const { text } = await generateText({
    model,
    system: options?.system,
    prompt,
  });
  return text;
}

// Jev（TypeSafe System One）适配层：和 callLLM 是并列的两条能力，不是同一个东西。
// 需要"让模型在固定选项里做判断"时用 callJev；需要"写出一段文字"时用 callLLM。
export {
  callJev,
  isJevAvailable,
  type JevAnswer,
  type JevChoiceAnswer,
  type JevNoulAnswer,
  type JevQuestion,
  type JevResponse,
  type JevScoreAnswer,
  type JevState,
} from "./jev";
