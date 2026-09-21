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

/**
 * docx → 纯文字。不用 mammoth.extractRawText：它会把段落内的软换行（Word 里 Shift+Enter，XML 是 <w:br/>）
 * 直接丢掉、前后两段文字无缝粘在一起——实测 "APRIL FINE PAPER TRADING" + 换行 + "ON BEHALF OF ..."
 * 变成 "TRADINGON BEHALF"、"CLIFFORD PAPER INC" + "70 EAST STREET" 变成 "INC70 EAST"，
 * 公司名于是连着地址一起被抽出来，和 BL 一比就是假的 MISMATCH（扰动测试 pt13 大部分失败都是这个）。
 * 公司名/地址分行写正是 Word 单证最常见的写法，所以改走 HTML：<br> 保留成换行，段落/单元格之间
 * 空一行（和 extractRawText 的段落口径一致，下游"标签在上一行、值在下一行"的解析不受影响）。
 */
async function parseDocx(content: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { buffer: content },
    // 图片对抽字段没用，别把它们转成 base64 塞进 HTML 里白占内存
    { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) }
  );
  return docxHtmlToText(result.value);
}

function docxHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|td|th|tr|table)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function parseXlsx(content: Buffer): Promise<string> {
  const sheets = await readXlsxFile(content);
  const sheetTexts = sheets.map(({ data }) => {
    const lines = data
      .map((row) =>
        row
          .map((cell) => formatCellValue(cell))
          .join(" ")
          // 只合并横向空白，保留单元格内的换行（Excel 里 Alt+Enter）：之前用 \s+ 把换行也压成空格，
          // "公司名\n地址" 被拼成一行，公司名连着地址一起被抽出来，和 BL 一比就是假的 MISMATCH
          // （2026-09-22 扰动测试 pt7 实测，和 docx 的 <w:br/> 是同一类问题）。
          .replace(/[^\S\n]+/g, " ")
          .replace(/ *\n[\s]*/g, "\n")
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
