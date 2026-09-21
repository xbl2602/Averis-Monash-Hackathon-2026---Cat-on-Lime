import { listSampleEmails } from "@/lib/shared/inbox";
import type { EmailOption } from "./attachments";

/** Server-side only: the sample inbox for the "pick an email" controls. An unreadable inbox gives an empty list, not a broken page. */
export async function listEmailOptions(): Promise<EmailOption[]> {
  try {
    const emails = await listSampleEmails();
    return emails.map(({ email_id, subject, from, attachments }) => ({ email_id, subject, from, attachments }));
  } catch {
    return [];
  }
}
