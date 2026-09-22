/**
 * The review action "rerun": reruns the pipeline for a single email and upserts the results
 * table.
 * Reuses lib/shared/pipeline.ts + sample-inputs.ts + verification-store.ts, and doesn't
 * duplicate the engine-order logic (see docs/REVIEW_SPEC.md §2).
 * Rerunning doesn't clear an existing override — a human may have already corrected it, see §4.5.
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
      "Rerunning needs to write to the results table, but the current environment is missing SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  if (provider !== undefined && !isLLMProvider(provider)) {
    throw new ReviewRequestError(`Unsupported provider: ${provider}`);
  }

  const inputs = await loadSamplePipelineInputs([emailId]);
  const input = inputs[0];
  if (!input) {
    throw new ReviewNotFoundError(`Email ${emailId} isn't in the sample data, cannot rerun`);
  }

  const inputHash = computeInputHash(input);
  try {
    const outcome = await runEmailPipeline(input, { textProvider: provider as LLMProvider | undefined });
    await upsertVerificationRows([buildSuccessRow(input, outcome, inputHash)]);
    return {
      ok: true,
      summary: `Rerun succeeded: category=${outcome.result.category} status=${outcome.result.status}`,
    };
  } catch (err) {
    await upsertVerificationRows([buildFailureRow(input, err, inputHash)]);
    return { ok: false, summary: `Rerun failed: ${describeError(err)}` };
  }
}
