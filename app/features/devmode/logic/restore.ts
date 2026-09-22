import { reimportSampleData, type SampleImportStats } from "@/lib/shared/sample-import";
import { DevModeRequestError } from "./errors";
import { wipeAllData } from "./wipe";
import type { TableWipeOutcome } from "./types";

export interface DevModeRestoreResult {
  wiped: TableWipeOutcome[];
  reimport: SampleImportStats;
}

/**
 * The full semantics of the "restore to official sample state" button: first wipe every data table,
 * then reimport raw_emails / parsed_attachments from data/sample/. After restoring, verification_results
 * is empty (classification/extraction/comparison haven't run yet) — this is intentional: running
 * `POST /features/pipeline/api` once will refill it. The restore endpoint deliberately does not also
 * run the full pipeline (that would consume real LLM call quota, and shouldn't be hidden behind a
 * "reset data" button).
 */
export async function restoreToOfficialSample(): Promise<DevModeRestoreResult> {
  const wiped = await wipeAllData();
  const failed = wiped.find((outcome) => !outcome.ok);
  if (failed) {
    throw new DevModeRequestError(`Restore aborted: wiping ${failed.table} failed (${failed.error}); reimport was not attempted`);
  }

  const reimport = await reimportSampleData();
  return { wiped, reimport };
}
