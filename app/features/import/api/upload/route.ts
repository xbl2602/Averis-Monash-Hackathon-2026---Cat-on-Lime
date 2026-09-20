/**
 * POST /features/import/api/upload
 * 手动上传单证（x-admin-token 写保护）：扩展名白名单 → 魔数 → 大小 → 去重 →
 * 解析 → 按内容识别 → 原文件进 Storage → 元数据 upsert 进 uploaded_documents。
 * 单文件失败不影响同批其他文件；整批合计超过 3MB 返回 413（前端按批切开）。
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/admin-guard";
import {
  MAX_BATCH_BYTES,
  MAX_FILE_BYTES,
  MAX_RAW_BODY_BYTES,
  formatBytes,
  normalizeUploadRequest,
  uploadDocuments,
  BatchTooLargeError,
} from "../../logic";
import { parseJsonText, toImportErrorResponse } from "../params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 解析 PDF/xlsx 可能偏慢：Vercel Hobby 函数上限 60s（本地/Docker 无影响）
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const rawBody = await request.text();
    const rawBytes = Buffer.byteLength(rawBody, "utf8");
    if (rawBytes > MAX_RAW_BODY_BYTES) {
      throw new BatchTooLargeError(
        `请求体约 ${formatBytes(rawBytes)}，超过单请求实际上限 ${formatBytes(MAX_RAW_BODY_BYTES)}` +
          `（base64 会放大文件体积）；请把文件按每批 ${formatBytes(MAX_BATCH_BYTES)} 左右拆开分多次上传`
      );
    }
    const body = parseJsonText(rawBody);
    const uploadRequest = normalizeUploadRequest(body);
    return NextResponse.json(await uploadDocuments(uploadRequest));
  } catch (err) {
    return toImportErrorResponse(err);
  }
}

/** 浏览器直接打开地址时返回接口用法说明（不执行任何处理） */
export async function GET() {
  return NextResponse.json({
    endpoint: "/features/import/api/upload",
    method: "POST",
    description:
      "手动上传单证（txt/md/pdf/docx/xlsx）；按内容校验并识别 SI/BL/OTHER/UNKNOWN，原文件存 Supabase Storage，元数据落 uploaded_documents。",
    headers: { "x-admin-token": "写操作口令（服务端 ADMIN_TOKEN）" },
    body: {
      files: "[{ name, mime?, data_base64 }]，data_base64 是文件内容的 base64",
      batch_id: "可选，原样回显，便于前端把一批结果对上",
    },
    limits: {
      "单文件": formatBytes(MAX_FILE_BYTES),
      "单请求合计": `${formatBytes(MAX_BATCH_BYTES)}（超过返回 413，请分批）`,
    },
    response: {
      batch_id: "string",
      items: "[{ name, status: stored|duplicate|rejected, reason?, id?, detected_type? }]",
    },
  });
}
