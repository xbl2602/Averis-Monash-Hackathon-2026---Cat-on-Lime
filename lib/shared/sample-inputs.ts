/**
 * 把样例邮件批量加载成流水线输入（邮件本体 + 每个附件解析出的文字）。
 *
 * 这是"读数据"的基础设施，放在 /lib/shared：批量入口、评测脚本都用这一份，
 * 不要各自复制"读 inbox 目录 + 逐附件解析"的逻辑（DATA_FLOW.md 数据流规则第 4 条）。
 */
import path from "node:path";
import { extractAttachmentText, type AttachmentTextResult } from "./attachment-text";
import { mapWithConcurrencyLimit } from "./concurrency";
import { listSampleEmails, readSampleAttachmentBuffer } from "./inbox";
import type { PipelineAttachment, PipelineEmailInput } from "./pipeline";
import type { InboxEmail } from "./types";

// 纯本地文件解析的并发上限（不调模型，只是别一次开 520 个文件句柄）
const PARSE_CONCURRENCY = 8;

/**
 * 单份样例附件 → 解析后的文字（PDF/xlsx/docx/txt 都走这里）。
 * extraction 的 REST/MCP 单文档接口用它，不要直接按 UTF-8 读 PDF（那样只能读出乱码）。
 */
export async function readSampleAttachmentParsed(
  attachmentPath: string
): Promise<AttachmentTextResult> {
  const buffer = await readSampleAttachmentBuffer(attachmentPath);
  return extractAttachmentText(path.basename(attachmentPath), buffer);
}

// 只读文件名、不解析 JSON 的轻量清单（实现已挪到 inbox.ts；这里 re-export 保持调用方路径不变）
export { listSampleEmailIds } from "./inbox";

/** emailIds 不传 = 全部；limit 不传 = 不限制（评测脚本 --limit 用） */
export async function loadSamplePipelineInputs(
  emailIds?: string[],
  limit?: number
): Promise<PipelineEmailInput[]> {
  const allEmails = await listSampleEmails();
  const selectedByEmailIds = emailIds ? pickEmails(allEmails, emailIds) : allEmails;
  const selected =
    limit === undefined ? selectedByEmailIds : selectedByEmailIds.slice(0, limit);

  // 并发解析，但结果按 inbox 原始顺序返回：批量入口的 limit=前 N 封 必须可复现
  const indexed = selected.map((email, index) => ({ email, index }));
  const { succeeded, failed } = await mapWithConcurrencyLimit(
    indexed,
    (entry) => toPipelineInput(entry.email),
    { concurrency: PARSE_CONCURRENCY }
  );

  if (failed.length > 0) {
    const first = failed[0];
    throw new Error(
      `加载样例邮件 ${first.item.email.email_id} 失败：${describeError(first.error)}`
    );
  }

  return succeeded
    .sort((a, b) => a.item.index - b.item.index)
    .map((entry) => entry.result);
}

function pickEmails(all: InboxEmail[], emailIds: string[]): InboxEmail[] {
  const wanted = new Set(emailIds);
  return all.filter((email) => wanted.has(email.email_id));
}

async function toPipelineInput(email: InboxEmail): Promise<PipelineEmailInput> {
  const attachments = await Promise.all(
    email.attachments.map(async (attachmentPath): Promise<PipelineAttachment> => {
      try {
        const buffer = await readSampleAttachmentBuffer(attachmentPath);
        const parsed = await extractAttachmentText(path.basename(attachmentPath), buffer);
        return { path: attachmentPath, parseStatus: parsed.status, text: parsed.text };
      } catch (err) {
        // 附件文件本身读不出来（缺失/权限等）：按"读不了的附件"处理，
        // 让流水线判 unreadable，而不是让整批一起失败
        console.warn(
          `[sample-inputs] 附件 ${attachmentPath} 读取失败，按 unreadable 处理：${describeError(err)}`
        );
        return { path: attachmentPath, parseStatus: "unreadable", text: "" };
      }
    })
  );
  return { email, attachments };
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
