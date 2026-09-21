/** Client-safe helpers for sample emails and their attachments (no server imports, so components can use them). */

/** The little the pickers need from each sample email (bodies stay on the server to keep the page light). */
export interface EmailOption {
  email_id: string;
  subject: string;
  from: string;
  attachments: string[];
}

/** Which kind of document an attachment is, judging by the "_SI" / "_BL" in its file name (null = cannot tell). */
export function attachmentKind(path: string): "SI" | "BL" | null {
  const name = path.split("/").pop() ?? path;
  if (/_SI\b/i.test(name)) return "SI";
  if (/_BL\b/i.test(name)) return "BL";
  return null;
}

export function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}
