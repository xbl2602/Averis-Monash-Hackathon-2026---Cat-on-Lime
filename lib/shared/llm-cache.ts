/**
 * 模型调用级缓存（见 DECISION_LOG / 引擎方案里的"缓存设计"）：
 * - 键 = sha256(用途 + 版本 + provider + 模型 + 实际发送内容)
 *   "实际发送内容"指真正发给模型的完整输入（如果哪天做了截断，截断后的版本才是指纹的一部分，
 *   内容一变指纹就变，不会把旧结果错配给新内容）——避免"缓存截段"类问题
 * - 缓存里存完整响应，不存半截；不同邮件/文档不可能撞键（输入指纹不同）——避免上下文污染
 * - 写入用 upsert，并发安全
 * - 没配 SUPABASE_SERVICE_ROLE_KEY 时自动降级为"直接调用、不缓存"，不影响主流程
 */
import { createHash } from "node:crypto";
import { getSupabaseServiceClient, isSupabaseServiceAvailable } from "./supabase";

// 引擎逻辑（prompt/规则/阈值/模型）有实质改动时手动 +1，让旧缓存自动失效
export const LLM_CACHE_VERSION = "v1";

export interface CallWithCacheOptions<T> {
  /** 用途标签，例如 "classification" / "extraction_llm" / "field_equivalence" */
  purpose: string;
  provider: string;
  model: string;
  /** 这次实际发送给模型的完整内容（用来做指纹和排查对账） */
  request: unknown;
  /** 缓存未命中时真正发起调用 */
  execute: () => Promise<T>;
}

export interface CallWithCacheResult<T> {
  value: T;
  cached: boolean;
}

export async function callWithCache<T>(
  options: CallWithCacheOptions<T>
): Promise<CallWithCacheResult<T>> {
  if (!isSupabaseServiceAvailable()) {
    // 没有 service key：不缓存，直接调用（本地没配 key 时也能跑通主流程）
    return { value: await options.execute(), cached: false };
  }

  const cacheKey = computeCacheKey(options);
  const supabase = getSupabaseServiceClient();

  try {
    const { data, error } = await supabase
      .from("llm_call_cache")
      .select("response_payload")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      await supabase
        .from("llm_call_cache")
        .update({ last_used_at: new Date().toISOString() })
        .eq("cache_key", cacheKey)
        .then(({ error: touchError }) => {
          if (touchError) console.warn("[llm-cache] 更新 last_used_at 失败：", touchError.message);
        });
      return { value: data.response_payload as T, cached: true };
    }
  } catch (err) {
    console.warn("[llm-cache] 读取缓存失败，降级为直接调用：", err instanceof Error ? err.message : err);
  }

  const value = await options.execute();

  try {
    const { error } = await supabase.from("llm_call_cache").upsert(
      {
        cache_key: cacheKey,
        purpose: options.purpose,
        provider: options.provider,
        model: options.model,
        request_payload: options.request,
        response_payload: value,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" }
    );
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn("[llm-cache] 写缓存失败（结果不受影响）：", err instanceof Error ? err.message : err);
  }

  return { value, cached: false };
}

function computeCacheKey<T>(options: CallWithCacheOptions<T>): string {
  const payload = [
    options.purpose,
    LLM_CACHE_VERSION,
    options.provider,
    options.model,
    JSON.stringify(options.request),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}
