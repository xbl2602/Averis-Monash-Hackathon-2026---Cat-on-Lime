import { reimportSampleData, type SampleImportStats } from "@/lib/shared/sample-import";
import { DevModeRequestError } from "./errors";
import { wipeAllData } from "./wipe";
import type { TableWipeOutcome } from "./types";

export interface DevModeRestoreResult {
  wiped: TableWipeOutcome[];
  reimport: SampleImportStats;
}

/**
 * "恢复到官方样例状态"按钮的完整语义：先清空全部数据表，再从 data/sample/ 重新导入
 * raw_emails / parsed_attachments。恢复后 verification_results 是空的（还没跑过分类/
 * 抽取/比对）——这是有意的：跑一次 `POST /features/pipeline/api` 就能重新填满，
 * 不在恢复接口里顺带跑一遍全量流水线（那要消耗真实 LLM 调用额度，不应该藏在一个
 * "重置数据"的按钮背后）。
 */
export async function restoreToOfficialSample(): Promise<DevModeRestoreResult> {
  const wiped = await wipeAllData();
  const failed = wiped.find((outcome) => !outcome.ok);
  if (failed) {
    throw new DevModeRequestError(`恢复中止：清空 ${failed.table} 失败（${failed.error}），没有继续重新导入`);
  }

  const reimport = await reimportSampleData();
  return { wiped, reimport };
}
