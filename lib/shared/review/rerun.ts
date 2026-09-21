/**
 * 复核动作"重跑"：对单封邮件重新跑一次流水线并 upsert 结果表。
 * 复用 lib/shared/pipeline.ts + sample-inputs.ts + verification-store.ts，
 * 不复制引擎顺序逻辑（见 docs/REVIEW_SPEC.md §2）。
 * 重跑不清除已有 override——人此前可能已修正过，见 §4.5。
 */
import { isLLMProvider, type LLMProvider } from "@/lib/llm";
import { computeInputHash, runEmailPipeline } from "@/lib/shared/pipeline";
import { loadSamplePipelineInputs } from "@/lib/shared/sample-inputs";
import { isSupabaseServiceAvailable } from "@/lib/shared/supabase";
import {
  buildFailureRow,
  buildSuccessRow,
  describeError,
  upsertVerificationRows,
} from "@/lib/shared/verification-store";
import { ReviewNotFoundError, ReviewRequestError, ReviewStoreUnavailableError } from "./errors";

export interface RerunOutcome {
  ok: boolean;
  summary: string;
}

export async function rerunSingleEmail(emailId: string, provider?: string): Promise<RerunOutcome> {
  if (!isSupabaseServiceAvailable()) {
    throw new ReviewStoreUnavailableError(
      "重跑需要写结果表，但当前环境缺少 SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  if (provider !== undefined && !isLLMProvider(provider)) {
    throw new ReviewRequestError(`不支持的 provider：${provider}`);
  }

  const inputs = await loadSamplePipelineInputs([emailId]);
  const input = inputs[0];
  if (!input) {
    throw new ReviewNotFoundError(`样例数据里没有邮件 ${emailId}，无法重跑`);
  }

  const inputHash = computeInputHash(input);
  try {
    const outcome = await runEmailPipeline(input, { textProvider: provider as LLMProvider | undefined });
    await upsertVerificationRows([buildSuccessRow(input, outcome, inputHash)]);
    return {
      ok: true,
      summary: `重跑成功：category=${outcome.result.category} status=${outcome.result.status}`,
    };
  } catch (err) {
    await upsertVerificationRows([buildFailureRow(input, err, inputHash)]);
    return { ok: false, summary: `重跑失败：${describeError(err)}` };
  }
}
