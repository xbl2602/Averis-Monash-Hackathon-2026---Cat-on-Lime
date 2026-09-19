/**
 * 把一份附件解析成纯文字（供导入脚本使用；以后系统的预览/抽取也从这里取文字）。
 *
 * 现在数据里只有 4 种格式：txt / pdf / xlsx / docx。按团队定的口径：
 * - 文字层 PDF 正常读；扫描件 / 损坏 / 加密等读不出文字的 → 标 unreadable 先搁置
 *   （以后接 OCR 能力后重跑导入脚本即可补上，导入是 upsert，不会产生重复数据）
 * - 任何一种格式解析失败都不抛异常，返回带 error 说明的 unreadable 结果，
 *   由调用方决定怎么处理（对应"批量处理时单条失败不拖垮整批"的规范）
 */
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import readXlsxFile from "read-excel-file/node";

export type AttachmentFormat = "txt" | "pdf" | "xlsx" | "docx" | "unsupported";
export type AttachmentParseStatus = "ok" | "unreadable";

export interface AttachmentTextResult {
  format: AttachmentFormat;
  status: AttachmentParseStatus;
  /** 解析出的文字（unreadable 时可能为空或只有零星字符） */
  text: string;
  /** 读不了时的原因说明，读成功时没有这个字段 */
  error?: string;
}

// 能提取到的文字少于这个长度就当作"没读到内容"：扫描件 PDF 往往只返回空串或零星页眉字符
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
        error: `只提取到 ${trimmed.length} 个字符，可能是扫描件或空文件`,
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
      throw new Error("暂不支持的文件格式（目前支持 txt / pdf / xlsx / docx）");
  }
}

async function parsePdf(content: Buffer): Promise<string> {
  const parser = new PDFParse({ data: content });
  try {
    const result = await parser.getText();
    // 用 pages 按页拼接：result.text 里会带 "-- 1 of 1 --" 这类页码分隔符，
    // 扫描件里这类分隔符会把"其实没读到内容"的文件伪装成有文字，必须避开
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
