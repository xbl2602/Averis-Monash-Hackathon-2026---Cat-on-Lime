/**
 * TypeSafe "System One" 结构化决策模型 Jev 的适配层（见 CLAUDE.md "多LLM支持"）。
 *
 * 它和普通 LLM 不一样：输入是 state（要判断的材料）+ 一组 typed questions，
 * 输出是带校准概率的结构化答案，**不生成任何文本**。所以它不能走 callLLM，
 * 必须通过这里暴露的 callJev 调用。官方文档：https://docs.typesafe.ai/api
 *
 * Jev 适合"在代码里做判断"（分类 / 路由 / 逐字段是否一致），不适合需要写文字的
 * 字段抽取（extraction）——那类任务请继续用 callLLM。
 */

export type JevQuestion =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> }
  | { type: "score"; instructions: string; criteria: string[] };

export interface JevNoulAnswer {
  type: "noul";
  noul: number; // 0~1，回答"是"的概率；没有单独的 confidence 字段
}

export interface JevChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number; // 0~1，由概率分布算出的置信度
}

export interface JevScoreAnswer {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer;

export interface JevResponse {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

export type JevState = string | Record<string, unknown> | unknown[];

const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_JEV_MODEL = "jev-latest";

// 有没有配 TYPESAFE_API_KEY——界面/逻辑可以据此决定要不要让用户选 Jev
export function isJevAvailable(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

// 把 HTTP 状态码翻译成操作者能看懂的话（错误处理要求见 CLAUDE.md "代码质量红线"）
function explainJevStatus(status: number): string {
  switch (status) {
    case 401:
      return "（API key 缺失或无效，检查 TYPESAFE_API_KEY）";
    case 422:
      return "（请求体不合法，通常是 state 或 questions 的结构写错了）";
    case 429:
      return "（超出速率限制，稍后重试或降低批量并发）";
    case 529:
      return "（TypeSafe 服务暂时过载，稍后重试）";
    default:
      return "";
  }
}

/**
 * 统一调用 Jev。遵守"调试规范"：外部调用失败要抛出有意义、能看懂的错，
 * 不在这里静默吞掉，也不做无脑重试。
 */
export async function callJev(
  state: JevState,
  questions: Record<string, JevQuestion>
): Promise<JevResponse> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "缺少 TYPESAFE_API_KEY 环境变量，无法调用 Jev。请在 .env.local 或部署平台配置该变量，或改用其他 provider。"
    );
  }

  const model = process.env.JEV_MODEL || DEFAULT_JEV_MODEL;

  let response: Response;
  try {
    response = await fetch(TYPESAFE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state, model, questions }),
    });
  } catch (err) {
    throw new Error(
      `调用 Jev 失败（网络错误）：${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `调用 Jev 失败：HTTP ${response.status}${explainJevStatus(response.status)}${
        detail ? ` - ${detail.slice(0, 500)}` : ""
      }`
    );
  }

  return (await response.json()) as JevResponse;
}
