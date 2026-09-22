/**
 * Reads the official sample email data (local static-file version, corresponding to
 * data/sample/). This is shared infrastructure used by all three feature modules, not
 * business logic, so it lives in /lib/shared.
 * If we switch to the official Docker API version later (see the HTTP usage in
 * data/sample/README.md), only this one file needs to change — no other module needs to be
 * touched.
 *
 * Security convention (path-traversal prevention): every read of an externally supplied path
 * first goes through resolveInside() — only relative paths inside the data/sample directory
 * are allowed; anything that crosses drives/UNC/uses `..` always throws SampleDataPathError;
 * a file that doesn't exist throws SampleNotFoundError (without leaking the server's absolute path).
 */
import { readFile, readdir } from "fs/promises";
import path from "path";
import type { InboxEmail } from "./types";

const SAMPLE_DATA_DIR = path.join(process.cwd(), "data", "sample");

/** The path is invalid (not inside the sample directory / attempts to escape it / crosses drives) */
export class SampleDataPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SampleDataPathError";
  }
}

/** The corresponding file (email/attachment) can't be found in the sample data */
export class SampleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SampleNotFoundError";
  }
}

/** email_id allowlist: only letters/digits/underscore/hyphen are allowed (that's how the sample data is named) */
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
 * Lists only the filenames in the inbox directory (with .json stripped), without parsing the JSON.
 * Used by the batch entry point / export to get the "official sample list" (used as the
 * denominator anchor) — much cheaper than parsing everything.
 */
export async function listSampleEmailIds(): Promise<string[]> {
  const inboxDir = path.join(SAMPLE_DATA_DIR, "inbox");
  const files = (await readdir(inboxDir)).filter((f) => f.endsWith(".json")).sort();
  return files.map((f) => f.slice(0, -".json".length));
}

export async function getSampleEmail(emailId: string): Promise<InboxEmail> {
  if (!EMAIL_ID_PATTERN.test(emailId)) {
    throw new SampleDataPathError(
      "Invalid email_id: only letters, digits, underscores, and hyphens are allowed (e.g. email_004)"
    );
  }
  const filePath = resolveInside(SAMPLE_DATA_DIR, path.join("inbox", `${emailId}.json`));
  const raw = await readTextOrNotFound(filePath, `Could not find sample email ${emailId}`);
  return JSON.parse(raw) as InboxEmail;
}

// attachmentPath is exactly the string found in email.attachments, e.g. "attachments/email_004_SI.txt"
export async function readSampleAttachmentText(attachmentPath: string): Promise<string> {
  const filePath = resolveInside(SAMPLE_DATA_DIR, attachmentPath);
  return readTextOrNotFound(filePath, `Could not find attachment ${attachmentPath}`);
}

// The attachment's raw content (pdf/xlsx/docx need a Buffer to hand to their respective parsers, they can't be read as text)
export async function readSampleAttachmentBuffer(attachmentPath: string): Promise<Buffer> {
  const filePath = resolveInside(SAMPLE_DATA_DIR, attachmentPath);
  return readBufferOrNotFound(filePath, `Could not find attachment ${attachmentPath}`);
}

/**
 * Resolves an externally supplied relative path to somewhere inside baseDir; throws
 * SampleDataPathError if it's invalid.
 *
 * Rules (the strict criteria decided in the 2026-09-20 security review):
 * - The resolved result must be inside baseDir (path.relative must not start with ".." and must not be absolute)
 * - The resolved result's root (drive letter / UNC) must match baseDir's -> crossing Windows
 *   drives, `\\?\`, or UNC paths are all rejected
 */
function resolveInside(baseDir: string, relativePath: string): string {
  const resolved = path.resolve(baseDir, relativePath);
  const rel = path.relative(baseDir, resolved);
  const inside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  if (!inside || !sameRoot(resolved, baseDir)) {
    throw new SampleDataPathError(
      "Invalid path: only sample files (relative paths) inside the data/sample directory may be read"
    );
  }
  return resolved;
}

// path.parse(root) picks out the drive letter/UNC root on win32; compared case-insensitively (C:\ and c:\ are the same root)
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
