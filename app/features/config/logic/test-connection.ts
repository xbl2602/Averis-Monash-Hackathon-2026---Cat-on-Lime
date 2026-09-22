/**
 * 配置测试连接（第二阶段 SPEC 第 3.3 节）。
 * 服务端解密后真实调用一次目标服务，只回 ok/detail，不泄露 key。
 */
import { resolveConfigValue } from "@/lib/shared/config-store";
import { getActiveSupabaseConfig } from "@/lib/shared/supabase";
import { JEV_TIMEOUT_MS, isLocalLLMAvailable, resolveJevModel } from "@/lib/llm";

export type TestTarget = "claude" | "openai" | "deepseek" | "gemini" | "typesafe" | "supabase" | "lmstudio";

const KEY_BY_TARGET: Record<"claude" | "openai" | "deepseek" | "gemini", string> = {
  claude: "llm.anthropic_api_key",
  openai: "llm.openai_api_key",
  deepseek: "llm.deepseek_api_key",
  gemini: "llm.gemini_api_key",
};

export interface TestResult {
  ok: boolean;
  detail: string;
}

export async function testConnection(target: TestTarget): Promise<TestResult> {
  try {
    switch (target) {
      case "claude":
      case "openai":
      case "deepseek":
      case "gemini":
        return await testLlmKey(target);
      case "typesafe":
        return await testTypesafe();
      case "supabase":
        return await testSupabase();
      case "lmstudio":
        return testLmStudio();
    }
  } catch (err) {
    return { ok: false, detail: describeError(err) };
  }
}

// fetch 抛出的 "fetch failed" 本身没有可读信息，把底层 cause 的 code/message 一起带上（不含任何密钥）
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: { code?: string; message?: string } }).cause;
  const suffix = cause?.code ?? cause?.message;
  return suffix ? `${err.message}（${suffix}）` : err.message;
}

async function testLlmKey(target: "claude" | "openai" | "deepseek" | "gemini"): Promise<TestResult> {
  const key = (await resolveConfigValue(KEY_BY_TARGET[target])) as string | null;
  if (!key) {
    return { ok: false, detail: `未配置 ${target} 的 API key，请先填写再测试` };
  }

  // 用"列模型"接口做最小真实调用：不产生 token 费用，且能验证 key 有效性
  const endpoints: Record<"claude" | "openai" | "deepseek" | "gemini", { url: string; headers: Record<string, string> }> = {
    claude: {
      url: "https://api.anthropic.com/v1/models?limit=1",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    },
    openai: {
      url: "https://api.openai.com/v1/models?limit=1",
      headers: { Authorization: `Bearer ${key}` },
    },
    deepseek: {
      url: "https://api.deepseek.com/v1/models",
      headers: { Authorization: `Bearer ${key}` },
    },
    gemini: {
      url: `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`,
      headers: {},
    },
  };

  const { url, headers } = endpoints[target];
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  // 列模型接口不产生费用，所以查不出"余额不足"——2026-09-22 DeepSeek 在这里显示有效，真调用却返回 402。
  // 成功时如实说明验证了什么、没验证什么，免得把"key 能登录"读成"模型能用"。
  if (response.ok) {
    return { ok: true, detail: `${target} key 有效，服务可达（只验证了 key，没有实际生成；余额不足等问题要实际调用一次才会暴露）` };
  }
  if (response.status === 402) {
    return { ok: false, detail: `${target} 返回 402：账户余额不足或需要付费，请到服务商后台充值` };
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, detail: `${target} 拒绝了这个 key（HTTP ${response.status}），请检查是否填错或已过期` };
  }
  return { ok: false, detail: `${target} 返回 HTTP ${response.status}，请稍后重试` };
}

async function testTypesafe(): Promise<TestResult> {
  const key = (await resolveConfigValue("llm.typesafe_api_key")) as string | null;
  if (!key) return { ok: false, detail: "未配置 TypeSafe Jev 的 API key" };
  // 用最小 state+question 发一次真实请求，验证 key 与端点。
  // 2026-09-22 修：以前漏了必填的 model 字段，TypeSafe 一律回 422（"body.model Field required"），
  // 设置页因此一直显示 Jev 连不上，而真实的分类/比对调用（带 model）其实是好的。model 取值和真实调用同源。
  const response = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: resolveJevModel(),
      state: { probe: "connection test" },
      questions: { ok: { type: "noul", instructions: "这是一个测试请求，回答是" } },
    }),
    signal: AbortSignal.timeout(JEV_TIMEOUT_MS),
  });
  if (response.ok) return { ok: true, detail: "TypeSafe Jev key 有效，服务可达" };
  if (response.status === 401) return { ok: false, detail: "TypeSafe 拒绝了这个 key（401），请检查是否填错" };
  return { ok: false, detail: `TypeSafe 返回 HTTP ${response.status}，请稍后重试` };
}

async function testSupabase(): Promise<TestResult> {
  // 用"当前实际生效"的配置（启用项目 > 环境变量），和写库走的 getSupabaseServiceClientAsync 语义一致。
  // 不走 resolveConfigValue("supabase.service_key")：那个 key 不在 config-store 的环境变量映射里，永远解析不到。
  const config = await getActiveSupabaseConfig();
  if (!config || !config.serviceKey) {
    return {
      ok: false,
      detail: "未配置可用的 Supabase service key：请在 mail 的 supabase-projects 接口启用一个带 service key 的项目，或在环境变量里配置",
    };
  }
  const { url, serviceKey: key } = config;
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  return response.ok
    ? { ok: true, detail: "Supabase 项目可达，key 有效" }
    : { ok: false, detail: `Supabase 返回 HTTP ${response.status}，请检查 URL 和 key` };
}

function testLmStudio(): TestResult {
  if (!isLocalLLMAvailable()) {
    return { ok: false, detail: "当前是 Vercel 云端环境，本地 LM Studio 不可用（架构限制，非配置错误）" };
  }
  return { ok: true, detail: "本地环境允许使用 LM Studio；请确认 LM Studio 已启动（默认 http://localhost:1234/v1）" };
}
