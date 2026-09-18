/**
 * 读取官方提供的样例邮件数据（本地静态文件版，对应 data/sample/）。
 * 这是给三个 feature 模块共用的基础设施，不是业务逻辑，所以放在 /lib/shared。
 * 如果以后要换成官方 Docker API 版本（见 data/sample/README.md 里的 HTTP 用法），
 * 只需要改这一个文件，其他模块不用动。
 */
import { readFile, readdir } from "fs/promises";
import path from "path";
import type { InboxEmail } from "./types";

const SAMPLE_DATA_DIR = path.join(process.cwd(), "data", "sample");

export async function listSampleEmails(): Promise<InboxEmail[]> {
  const inboxDir = path.join(SAMPLE_DATA_DIR, "inbox");
  const files = (await readdir(inboxDir)).filter((f) => f.endsWith(".json")).sort();
  const emails = await Promise.all(
    files.map(async (f) => {
      const raw = await readFile(path.join(inboxDir, f), "utf-8");
      return JSON.parse(raw) as InboxEmail;
    })
  );
  return emails;
}

export async function getSampleEmail(emailId: string): Promise<InboxEmail> {
  const filePath = path.join(SAMPLE_DATA_DIR, "inbox", `${emailId}.json`);
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as InboxEmail;
}

// attachmentPath 就是 email.attachments 里的字符串，例如 "attachments/email_004_SI.txt"
export async function readSampleAttachmentText(attachmentPath: string): Promise<string> {
  const filePath = path.join(SAMPLE_DATA_DIR, attachmentPath);
  return readFile(filePath, "utf-8");
}
