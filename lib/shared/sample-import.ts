/**
 * Re-writes the official sample data (data/sample/) back into the raw_emails /
 * parsed_attachments tables.
 *
 * This is only for "Developer Mode - Restore to official sample state"
 * (app/features/devmode/) and does not run on the normal business path. It reuses the same
 * shared infrastructure as scripts/import-sample-data.mjs (inbox.ts for reading files,
 * attachment-text.ts for parsing, supabase.ts for the server-side client) so the script and
 * the runtime don't each maintain their own parsing logic and end up computing inconsistent
 * fingerprints. Batch parsing goes through mapWithConcurrencyLimit (a single attachment
 * failing to parse only affects that one row, it doesn't take down the whole batch).
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

/** Re-writes the official sample emails + attachments to the database (incremental upsert; rows whose content is unchanged get the same fingerprint, so Supabase sees no real change) */
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
    .map((row) => `${row.file_path} (${row.parse_error ?? ""})`);
  // buildAttachmentRow already converts expected failures (file unreadable/parse failure)
  // into "unreadable" rows and returns them, so anything in `failed` here is a genuinely
  // unexpected exception — report it to the caller as-is, don't swallow it silently
  for (const entry of failed) {
    unreadable.push(`${entry.item.attachmentPath} (unexpected error: ${String(entry.error)})`);
  }

  const { error: emailsErr } = await supabase.from("raw_emails").upsert(emailRows, { onConflict: "email_id" });
  if (emailsErr) throw new Error(`Failed to write raw_emails: ${emailsErr.message}`);

  const batchSize = 50;
  for (let i = 0; i < attachmentRows.length; i += batchSize) {
    const batch = attachmentRows.slice(i, i + batchSize);
    const { error } = await supabase
      .from("parsed_attachments")
      .upsert(batch, { onConflict: "email_id,file_path" });
    if (error) {
      throw new Error(`Failed to write parsed_attachments rows ${i + 1}-${i + batch.length}: ${error.message}`);
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
