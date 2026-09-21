/**
 * 把官方样例数据（data/sample/）重新写进 raw_emails / parsed_attachments 两张表。
 *
 * 只给"开发者模式 - 恢复到官方样例状态"用（app/features/devmode/），不在正常业务路径
 * 上跑。复用和 scripts/import-sample-data.mjs 同一套共享基础设施（inbox.ts 读文件、
 * attachment-text.ts 解析、supabase.ts 服务端客户端），避免脚本和运行时各写一份解析
 * 逻辑、算出不一致的指纹。批量解析走 mapWithConcurrencyLimit（单个附件解析失败只影响
 * 那一条，不拖垮整批）。
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { extractAttachmentText } from "./attachment-text";
import { mapWithConcurrencyLimit } from "./concurrency";
import { listSampleEmails, readSampleAttachmentBuffer } from "./inbox";
import { normalizeText } from "./normalize";
import { getSupabaseServiceClient } from "./supabase";
import type { InboxEmail } from "./types";

export interface SampleImportStats {
  emailsTotal: number;
  emailsWritten: number;
  attachmentsTotal: number;
  attachmentsWritten: number;
  attachmentsFailed: number;
  unreadableAttachments: string[];
}

interface AttachmentJob {
  email: InboxEmail;
  attachmentPath: string;
}

function hashObject(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function buildAttachmentRow(job: AttachmentJob): Promise<Record<string, unknown>> {
  const filename = path.basename(job.attachmentPath);
  const buffer = await readSampleAttachmentBuffer(job.attachmentPath);
  const parsed = await extractAttachmentText(filename, buffer);
  const row = {
    email_id: job.email.email_id,
    file_path: job.attachmentPath,
    file_format: parsed.format,
    parse_status: parsed.status,
    parse_error: parsed.error ?? null,
    parsed_text: parsed.text,
    normalized_text: normalizeText(parsed.text),
  };
  return { ...row, content_hash: hashObject(row) };
}

/** 官方样例邮件 + 附件重新写库（增量 upsert，内容没变的行指纹相同、Supabase 端不产生实际变更） */
export async function reimportSampleData(): Promise<SampleImportStats> {
  const emails = await listSampleEmails();
  const supabase = getSupabaseServiceClient();

  const emailRows = emails.map((email) => {
    const row = {
      email_id: email.email_id,
      from_address: email.from,
      subject: email.subject,
      body: email.body,
      normalized_body: normalizeText(email.body),
      attachment_paths: email.attachments,
    };
    return { ...row, content_hash: hashObject(row) };
  });

  const jobs: AttachmentJob[] = emails.flatMap((email) =>
    email.attachments.map((attachmentPath) => ({ email, attachmentPath }))
  );

  const { succeeded, failed } = await mapWithConcurrencyLimit(jobs, buildAttachmentRow, { concurrency: 5 });
  const attachmentRows = succeeded.map((entry) => entry.result);
  const unreadable = attachmentRows
    .filter((row) => row.parse_status === "unreadable")
    .map((row) => `${row.file_path}（${row.parse_error ?? ""}）`);
  // buildAttachmentRow 已经把预期内的失败（文件读不到/解析失败）转成 unreadable 行返回，
  // 这里 failed 只会有真正意料之外的异常——照实告诉调用方，不静默吞掉
  for (const entry of failed) {
    unreadable.push(`${entry.item.attachmentPath}（未预期的错误：${String(entry.error)}）`);
  }

  const { error: emailsErr } = await supabase.from("raw_emails").upsert(emailRows, { onConflict: "email_id" });
  if (emailsErr) throw new Error(`写入 raw_emails 失败：${emailsErr.message}`);

  const batchSize = 50;
  for (let i = 0; i < attachmentRows.length; i += batchSize) {
    const batch = attachmentRows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("parsed_attachments")
      .upsert(batch, { onConflict: "email_id,file_path" });
    if (error) {
      throw new Error(`写入 parsed_attachments 第 ${i + 1}~${i + batch.length} 行失败：${error.message}`);
    }
  }

  return {
    emailsTotal: emails.length,
    emailsWritten: emailRows.length,
    attachmentsTotal: jobs.length,
    attachmentsWritten: attachmentRows.length,
    attachmentsFailed: failed.length,
    unreadableAttachments: unreadable,
  };
}
