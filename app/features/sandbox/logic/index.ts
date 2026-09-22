/**
 * sandbox 的唯一业务逻辑：接一份裁判自己上传的 SI + BL（可选邮件主题/正文），
 * 跑一次分类（可选）+ 抽取 + 比对，返回结果。不写库、不需要 Supabase，REST/MCP 都调这里。
 *
 * 复用production同一套引擎（classification/extraction/comparison 各自的 logic），
 * 不重新实现判断逻辑——这样"裁判自己测的结果"和"系统正式跑出来的结果"是同一套标准。
 */
import { classifyEmail } from "@/app/features/classification/logic";
import { compareDocumentsHybrid } from "@/app/features/comparison/logic";
import { extractFields } from "@/app/features/extraction/logic";
import { isLLMProvider, isTextProvider, type LLMProvider, type TextLLMProvider } from "@/lib/llm";
import { extractAttachmentText } from "@/lib/shared/attachment-text";
import {
  assertAllowedExtension,
  checkMagicBytes,
  decodeBase64File,
  formatBytes,
  sanitizeFileName,
} from "@/lib/shared/file-validate";
import type { InboxEmail } from "@/lib/shared/types";
import { SandboxFileTooLargeError, SandboxRequestError } from "./errors";
import {
  MAX_FILE_BYTES,
  MAX_FILE_NAME_LENGTH,
  SANDBOX_ALLOWED_EXTENSIONS,
  type RunAdhocTestRequest,
  type RunAdhocTestResult,
  type SandboxFileInput,
} from "./types";

export async function runAdhocTest(request: RunAdhocTestRequest): Promise<RunAdhocTestResult> {
  if (request.provider !== undefined && !isLLMProvider(request.provider)) {
    throw new SandboxRequestError(`不支持的 provider：${request.provider}`);
  }
  const provider = request.provider as LLMProvider | undefined;
  // 抽取只接受文本 provider（jev 不做文本生成）；传了 jev 就按没指定处理（抽取走默认回退链），不报错。
  // 指定了文本 provider 时"选谁就只试谁"，和分类一致；没指定时分类/抽取都走和流水线一样的混合引擎。
  const textProvider: TextLLMProvider | undefined =
    provider && isTextProvider(provider) ? provider : undefined;

  const [si, bl] = await Promise.all([
    parseUploadedDocument(request.si, "si"),
    parseUploadedDocument(request.bl, "bl"),
  ]);

  const hasEmailText = Boolean(request.subject?.trim() || request.body?.trim());
  const classification = hasEmailText
    ? await classifyEmail({ email: buildSyntheticEmail(request), provider })
    : null;

  const [siResult, blResult] = await Promise.all([
    extractFields({ documentText: si.text, documentType: "SI", provider: textProvider }),
    extractFields({ documentText: bl.text, documentType: "BL", provider: textProvider }),
  ]);

  const comparison = await compareDocumentsHybrid({ si: siResult.fields, bl: blResult.fields });

  return {
    classification,
    extraction: { si: siResult, bl: blResult },
    comparison: {
      status: comparison.status,
      defect_fields: comparison.defect_fields,
      has_defect: comparison.has_defect,
      review_reason: comparison.review_reason,
    },
  };
}

async function parseUploadedDocument(
  file: SandboxFileInput,
  label: "si" | "bl"
): Promise<{ text: string }> {
  if (!file || typeof file.name !== "string" || typeof file.data_base64 !== "string") {
    throw new SandboxRequestError(`缺少 ${label} 文件（需要 { name, data_base64 }）`);
  }
  const extension = assertAllowedExtension(file.name, SANDBOX_ALLOWED_EXTENSIONS);
  const content = decodeBase64File(file.data_base64);
  if (content.length > MAX_FILE_BYTES) {
    throw new SandboxFileTooLargeError(
      `${label.toUpperCase()} 文件（${formatBytes(content.length)}）超过单文件上限 ${formatBytes(MAX_FILE_BYTES)}`
    );
  }
  const magicError = checkMagicBytes(extension, content);
  if (magicError) {
    throw new SandboxRequestError(`${label.toUpperCase()} 文件校验失败：${magicError}`);
  }

  const safeName = sanitizeFileName(file.name, MAX_FILE_NAME_LENGTH);
  const parsed = await extractAttachmentText(safeName, content);
  if (parsed.status !== "ok") {
    throw new SandboxRequestError(
      `${label.toUpperCase()} 文件读不出文字（可能是扫描件或损坏文件）：${parsed.error ?? "内容太短"}`
    );
  }
  return { text: parsed.text };
}

function buildSyntheticEmail(request: RunAdhocTestRequest): InboxEmail {
  return {
    email_id: "sandbox-adhoc",
    from: request.from?.trim() || "unknown@example.com",
    subject: request.subject?.trim() ?? "",
    body: request.body?.trim() ?? "",
    attachments: [],
  };
}
