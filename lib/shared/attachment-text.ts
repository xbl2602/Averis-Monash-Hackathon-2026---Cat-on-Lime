/**
 * Parses an attachment into plain text (used by the import script; going forward, the
 * system's preview/extraction features will also get their text from here).
 *
 * Right now the data only has 4 formats: txt / pdf / xlsx / docx. Per the team's agreed convention:
 * - Text-layer PDFs are read normally; scanned/corrupted/encrypted files etc. that yield no
 *   text are marked unreadable and set aside for now
 *   (once OCR support is added later, simply rerun the import script to fill them in — import
 *   is an upsert, so it won't create duplicate data)
 * - A parse failure in any format never throws; it returns an "unreadable" result with an
 *   error description, and it's up to the caller to decide what to do
 *   (this corresponds to the rule that "a single item failing during batch processing must
 *   not take down the whole batch")
 */
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import readXlsxFile from "read-excel-file/node";

export type AttachmentFormat = "txt" | "pdf" | "xlsx" | "docx" | "unsupported";
export type AttachmentParseStatus = "ok" | "unreadable";

export interface AttachmentTextResult {
  format: AttachmentFormat;
  status: AttachmentParseStatus;
  /** The extracted text (may be empty or contain only stray characters when unreadable) */
  text: string;
  /** The reason it couldn't be read; absent when parsing succeeded */
  error?: string;
}

// Extracted text shorter than this length is treated as "no content was read": scanned PDFs often return an empty string or just stray header characters
const MIN_TEXT_LENGTH = 10;

export async function extractAttachmentText(
  filename: string,
  content: Buffer
): Promise<AttachmentTextResult> {
  const format = detectFormat(filename);
  try {
    const text = await parseByFormat(format, content);
    const trimmed = text.trim();
    if (trimmed.length < MIN_TEXT_LENGTH) {
      return {
        format,
        status: "unreadable",
        text: trimmed,
        error: `Only extracted ${trimmed.length} character(s) — this may be a scanned document or an empty file`,
      };
    }
    return { format, status: "ok", text: trimmed };
  } catch (err) {
    return {
      format,
      status: "unreadable",
      text: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function detectFormat(filename: string): AttachmentFormat {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "txt" || ext === "md") return "txt";
  if (ext === "pdf") return "pdf";
  if (ext === "xlsx") return "xlsx";
  if (ext === "docx") return "docx";
  return "unsupported";
}

async function parseByFormat(format: AttachmentFormat, content: Buffer): Promise<string> {
  switch (format) {
    case "txt":
      return content.toString("utf-8");
    case "pdf":
      return parsePdf(content);
    case "docx":
      return parseDocx(content);
    case "xlsx":
      return parseXlsx(content);
    case "unsupported":
      throw new Error("Unsupported file format (currently txt / pdf / xlsx / docx are supported)");
  }
}

async function parsePdf(content: Buffer): Promise<string> {
  const parser = new PDFParse({ data: content });
  try {
    const result = await parser.getText();
    // Join by page: result.text contains page-separator markers like "-- 1 of 1 --", and for
    // scanned files these separators can make a file that actually has no content look like
    // it has text — this must be avoided
    return result.pages.map((page) => page.text).join("\n");
  } finally {
    await parser.destroy();
  }
}

async function parseDocx(content: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: content });
  return result.value;
}

async function parseXlsx(content: Buffer): Promise<string> {
  const sheets = await readXlsxFile(content);
  const sheetTexts = sheets.map(({ data }) => {
    const lines = data
      .map((row) =>
        row
          .map((cell) => formatCellValue(cell))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter((line) => line.length > 0);
    return lines.join("\n");
  });
  return sheetTexts.join("\n\n");
}

function formatCellValue(cell: unknown): string {
  if (cell == null) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell);
}
