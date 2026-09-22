/**
 * The sandbox module's only business logic: takes an SI + BL uploaded by a judge (with optional email
 * subject/body), runs classification (optional) + extraction + comparison once, and returns the result.
 * Writes to no database, needs no Supabase — both REST and MCP call into this.
 *
 * Reuses the same engine as production (each of classification/extraction/comparison's own logic)
 * rather than reimplementing the decision logic — this way "a result the judge tested themselves" and
 * "a result the system produced in normal operation" are held to the same standard.
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
    throw new SandboxRequestError(`Unsupported provider: ${request.provider}`);
  }
  const provider = request.provider as LLMProvider | undefined;
  // Extraction only accepts a text provider (jev doesn't do text generation); if jev is passed, fall back to extraction's own default (gemini) instead of erroring
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
    throw new SandboxRequestError(`Missing ${label} file (requires { name, data_base64 })`);
  }
  const extension = assertAllowedExtension(file.name, SANDBOX_ALLOWED_EXTENSIONS);
  const content = decodeBase64File(file.data_base64);
  if (content.length > MAX_FILE_BYTES) {
    throw new SandboxFileTooLargeError(
      `${label.toUpperCase()} file (${formatBytes(content.length)}) exceeds the per-file limit of ${formatBytes(MAX_FILE_BYTES)}`
    );
  }
  const magicError = checkMagicBytes(extension, content);
  if (magicError) {
    throw new SandboxRequestError(`${label.toUpperCase()} file validation failed: ${magicError}`);
  }

  const safeName = sanitizeFileName(file.name, MAX_FILE_NAME_LENGTH);
  const parsed = await extractAttachmentText(safeName, content);
  if (parsed.status !== "ok") {
    throw new SandboxRequestError(
      `${label.toUpperCase()} file has no extractable text (may be a scanned image or a corrupted file): ${parsed.error ?? "content too short"}`
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
