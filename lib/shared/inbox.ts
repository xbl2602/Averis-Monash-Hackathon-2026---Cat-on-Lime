/**
 * 读取官方提供的样例邮件数据（本地静态文件版，对应 data/sample/）。
 * 这是给三个 feature 模块共用的基础设施，不是业务逻辑，所以放在 /lib/shared。
 * 如果以后要换成官方 Docker API 版本（见 data/sample/README.md 里的 HTTP 用法），
 * 只需要改这一个文件，其他模块不用动。
 *
 * 安全约定（防路径穿越）：所有对外部传入路径的读取都先过 resolveInside()——
 * 只允许 data/sample 目录内的相对路径，跨盘/UNC/`..` 一律抛 SampleDataPathError；
 * 文件不存在时抛 SampleNotFoundError（不把服务器的绝对路径带出去）。
 */
import { readFile, readdir } from "fs/promises";
import path from "path";
import type { InboxEmail } from "./types";

const SAMPLE_DATA_DIR = path.join(process.cwd(), "data", "sample");

/** 路径不合法（不在样例目录内 / 试图跳出 / 跨盘） */
export class SampleDataPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SampleDataPathError";
  }
}

/** 样例数据里找不到对应文件（邮件/附件） */
export class SampleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SampleNotFoundError";
  }
}

/** email_id 白名单：只允许字母/数字/下划线/连字符（样例数据里就是这么命名的） */
const EMAIL_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

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

/**
 * 只列 inbox 目录里的文件名（去掉 .json），不解析 JSON。
 * 批量入口 / 导出用它们拿"官方样例清单"（分母锚定），比全量解析一遍便宜得多。
 */
export async function listSampleEmailIds(): Promise<string[]> {
  const inboxDir = path.join(SAMPLE_DATA_DIR, "inbox");
  const files = (await readdir(inboxDir)).filter((f) => f.endsWith(".json")).sort();
  return files.map((f) => f.slice(0, -".json".length));
}

export async function getSampleEmail(emailId: string): Promise<InboxEmail> {
  if (!EMAIL_ID_PATTERN.test(emailId)) {
    throw new SampleDataPathError(
      "email_id 不合法：只允许字母、数字、下划线、连字符（例如 email_004）"
    );
  }
  const filePath = resolveInside(SAMPLE_DATA_DIR, path.join("inbox", `${emailId}.json`));
  const raw = await readTextOrNotFound(filePath, `找不到样例邮件 ${emailId}`);
  return JSON.parse(raw) as InboxEmail;
}

// attachmentPath 就是 email.attachments 里的字符串，例如 "attachments/email_004_SI.txt"
export async function readSampleAttachmentText(attachmentPath: string): Promise<string> {
  const filePath = resolveInside(SAMPLE_DATA_DIR, attachmentPath);
  return readTextOrNotFound(filePath, `找不到附件 ${attachmentPath}`);
}

// 附件原始内容（pdf/xlsx/docx 需要 Buffer 交给各自的解析器，不能按文本读）
export async function readSampleAttachmentBuffer(attachmentPath: string): Promise<Buffer> {
  const filePath = resolveInside(SAMPLE_DATA_DIR, attachmentPath);
  return readBufferOrNotFound(filePath, `找不到附件 ${attachmentPath}`);
}

/**
 * 把外部传入的相对路径解析到 baseDir 内部；不合法就抛 SampleDataPathError。
 *
 * 判定（2026-09-20 安全评审定的严格口径）：
 * - 解析结果必须在 baseDir 之内（path.relative 不以 ".." 开头、不是绝对路径）
 * - 解析结果的根（盘符 / UNC）必须与 baseDir 相同 → Windows 跨盘、`\\?\`、UNC 一律拒绝
 */
function resolveInside(baseDir: string, relativePath: string): string {
  const resolved = path.resolve(baseDir, relativePath);
  const rel = path.relative(baseDir, resolved);
  const inside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  if (!inside || !sameRoot(resolved, baseDir)) {
    throw new SampleDataPathError(
      "路径不合法：只允许读取 data/sample 目录内的样例文件（相对路径）"
    );
  }
  return resolved;
}

// path.parse(root) 在 win32 上挑出盘符/UNC 根；大小写不敏感比较（C:\ 与 c:\ 同根）
function sameRoot(a: string, b: string): boolean {
  return path.parse(a).root.toLowerCase() === path.parse(b).root.toLowerCase();
}

async function readTextOrNotFound(filePath: string, notFoundMessage: string): Promise<string> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (err) {
    if (isNotFound(err)) throw new SampleNotFoundError(notFoundMessage);
    throw err;
  }
}

async function readBufferOrNotFound(filePath: string, notFoundMessage: string): Promise<Buffer> {
  try {
    return await readFile(filePath);
  } catch (err) {
    if (isNotFound(err)) throw new SampleNotFoundError(notFoundMessage);
    throw err;
  }
}

function isNotFound(err: unknown): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT";
}
