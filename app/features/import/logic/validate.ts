/**
 * 上传校验链里的纯函数（SPEC 第 5.2 节第 1~3 步 + 文件名/路径安全）。
 * 这些函数不碰数据库、不碰请求对象，方便单独验证。
 */
import { ImportRequestError } from "./errors";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_NAME_LENGTH,
  type AllowedExtension,
} from "./types";

const EXTENSION_SET = new Set<string>(ALLOWED_EXTENSIONS);

const CONTENT_TYPES: Record<AllowedExtension, string> = {
  txt: "text/plain",
  md: "text/markdown",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** 取扩展名：只在最后一个路径分隔符之后找点，防止 "a.pdf/../x" 这类名字干扰 */
export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

/** 第 1 步：扩展名白名单，不在名单里抛可读错误（调用方按"单文件 rejected"处理） */
export function assertAllowedExtension(name: string): AllowedExtension {
  const extension = extensionOf(name);
  if (!EXTENSION_SET.has(extension)) {
    throw new ImportRequestError(
      `不支持的文件类型 ".${extension || "无扩展名"}"：只允许 ${ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(" / ")}`
    );
  }
  return extension as AllowedExtension;
}

/**
 * base64 → Buffer。除了格式校验，还做"解码再编码必须与输入一致"的复核：
 * 解析结果和声明对不上（填充不标准/夹带字符/长度被改）就拒绝，防止伪造。
 */
export function decodeBase64File(dataBase64: string): Buffer {
  const cleaned = dataBase64.replace(/\s+/g, "");
  if (cleaned === "") {
    throw new ImportRequestError("data_base64 为空（文件内容没有传上来）");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    throw new ImportRequestError("data_base64 不是合法的 base64 内容");
  }
  const content = Buffer.from(cleaned, "base64");
  if (content.length === 0) {
    throw new ImportRequestError("base64 解码后是空文件");
  }
  if (content.toString("base64") !== cleaned) {
    throw new ImportRequestError("base64 解码校验失败（内容与声明对不上），已拒绝");
  }
  return content;
}

/** 第 2 步：魔数校验（不信任客户端传来的 mime，以文件头/字节内容为准） */
export function checkMagicBytes(extension: AllowedExtension, content: Buffer): string | null {
  if (extension === "pdf") {
    return content.subarray(0, 4).toString("latin1") === "%PDF"
      ? null
      : "PDF 文件必须以 %PDF 开头（可能是改了扩展名的假 PDF）";
  }
  if (extension === "docx" || extension === "xlsx") {
    return isZipContainer(content)
      ? null
      : `${extension} 是 ZIP 容器格式，必须以 PK 开头（文件损坏或扩展名不符）`;
  }
  const badByte = findBinaryControlByte(content);
  return badByte === null
    ? null
    : `文本文件里出现二进制控制字符（第 ${badByte + 1} 个字节），可能是改了扩展名的二进制文件`;
}

function isZipContainer(content: Buffer): boolean {
  return (
    content.length >= 4 &&
    content[0] === 0x50 &&
    content[1] === 0x4b &&
    content[2] === 0x03 &&
    content[3] === 0x04
  );
}

// 文本里允许的只有 \t \n \r，其余 < 0x20 的控制字符和 DEL(0x7F) 一律视为二进制内容
function findBinaryControlByte(content: Buffer): number | null {
  for (let i = 0; i < content.length; i++) {
    const byte = content[i];
    const isAllowedWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d;
    if ((byte < 0x20 && !isAllowedWhitespace) || byte === 0x7f) return i;
  }
  return null;
}

/**
 * 文件名净化：去掉路径分隔符/控制字符/各系统保留字符，防路径注入（"../"、"\\"）。
 * 只用于 Storage 路径和库里的展示名，不影响扩展名校验（那是用原始名字做的）。
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  const safe = cleaned || "unnamed";
  return safe.length <= MAX_FILE_NAME_LENGTH ? safe : truncateKeepingExtension(safe);
}

// 截断超长文件名时保留扩展名，避免落库/预览时格式判断受影响
function truncateKeepingExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 ? name.slice(dot) : "";
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const keep = Math.max(1, MAX_FILE_NAME_LENGTH - extension.length);
  return `${stem.slice(0, keep)}${extension}`;
}

/** Storage 路径：documents/<sha256前2位>/<sha256>/<净化后的文件名>（SPEC 5.1） */
export function storagePathFor(fileHash: string, safeName: string): string {
  return `documents/${fileHash.slice(0, 2)}/${fileHash}/${safeName}`;
}

/** Storage 的 content type 以扩展名/魔数推出，不采用客户端声明的 mime */
export function detectContentType(extension: AllowedExtension): string {
  return CONTENT_TYPES[extension];
}

/** 估算 base64 解码后的字节数（用于整批大小检查，避免整批解码两遍） */
export function estimateBase64DecodedBytes(dataBase64: string): number {
  const cleaned = dataBase64.replace(/\s+/g, "");
  if (cleaned === "") return 0;
  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

/** 给错误提示用的人类可读大小 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
