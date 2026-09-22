/**
 * Batch-loads the sample emails into pipeline inputs (the email itself + the parsed text of
 * each attachment).
 *
 * This is "data-reading" infrastructure that lives in /lib/shared: both the batch entry point
 * and the evaluation scripts use this single copy — don't each duplicate the "read the inbox
 * directory + parse each attachment" logic (rule 4 of the data-flow rules in DATA_FLOW.md).
 */
import path from "node:path";
import { extractAttachmentText, type AttachmentTextResult } from "./attachment-text";
import { mapWithConcurrencyLimit } from "./concurrency";
import { listSampleEmails, readSampleAttachmentBuffer } from "./inbox";
import type { PipelineAttachment, PipelineEmailInput } from "./pipeline";
import type { InboxEmail } from "./types";

// Concurrency cap for pure local file parsing (no model calls here, just to avoid opening 520 file handles at once)
const PARSE_CONCURRENCY = 8;

/**
 * A single sample attachment -> its parsed text (PDF/xlsx/docx/txt all go through here).
 * extraction's REST/MCP single-document endpoint uses this — don't read a PDF as raw UTF-8
 * directly (that only produces garbage).
 */
export async function readSampleAttachmentParsed(
  attachmentPath: string
): Promise<AttachmentTextResult> {
  const buffer = await readSampleAttachmentBuffer(attachmentPath);
  return extractAttachmentText(path.basename(attachmentPath), buffer);
}

// A lightweight listing that only reads filenames without parsing the JSON (the implementation has moved to inbox.ts; re-exported here so callers' import paths stay unchanged)
export { listSampleEmailIds } from "./inbox";

/** emailIds omitted = all of them; limit omitted = unlimited (used by the evaluation script's --limit) */
export async function loadSamplePipelineInputs(
  emailIds?: string[],
  limit?: number
): Promise<PipelineEmailInput[]> {
  const allEmails = await listSampleEmails();
  const selectedByEmailIds = emailIds ? pickEmails(allEmails, emailIds) : allEmails;
  const selected =
    limit === undefined ? selectedByEmailIds : selectedByEmailIds.slice(0, limit);

  // Parsed concurrently, but the results are returned in the original inbox order: the batch
  // entry point's "limit = first N emails" must be reproducible
  const indexed = selected.map((email, index) => ({ email, index }));
  const { succeeded, failed } = await mapWithConcurrencyLimit(
    indexed,
    (entry) => toPipelineInput(entry.email),
    { concurrency: PARSE_CONCURRENCY }
  );

  if (failed.length > 0) {
    const first = failed[0];
    throw new Error(
      `Failed to load sample email ${first.item.email.email_id}: ${describeError(first.error)}`
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
        // The attachment file itself couldn't be read (missing/permissions/etc.): treat it as
        // an "unreadable attachment" so the pipeline marks it unreadable instead of failing
        // the whole batch
        console.warn(
          `[sample-inputs] Failed to read attachment ${attachmentPath}, treating as unreadable: ${describeError(err)}`
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
