import { z } from "zod";
import { TEXT_PROVIDER_IDS } from "@/lib/llm";
import { readSampleAttachmentParsed } from "@/lib/shared/sample-inputs";
import { makeReviewMcpTools } from "@/lib/shared/review/mcp";
import { extractFields } from "../logic";

/**
 * MCP tool for the extraction module (read-only).
 * provider only accepts text models (TEXT_PROVIDER_IDS excludes jev; z.enum rejects it before the handler runs).
 */
export const extractionMcpTool = {
  name: "extract_document_fields",
  description:
    "Extracts these 7 fields — shipper/consignee/notify_party/port_of_loading/port_of_discharge/container_count/gross_weight_kg — from an SI (Shipping Instruction) or BL (Bill of Lading) document's text, and determines the document type (OTHER = not an SI/BL, e.g. an invoice/packing list)",
  inputSchema: {
    attachment_path: z
      .string()
      .describe('The attachment path in the sample data, e.g. "attachments/email_004_SI.txt"'),
    documentType: z.enum(["SI", "BL"]),
    provider: z
      .enum(TEXT_PROVIDER_IDS)
      .optional()
      .describe("The text fallback model, defaults to gemini; jev is not supported (jev can only make structured judgments)"),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async ({
    attachment_path,
    documentType,
    provider,
  }: {
    attachment_path: string;
    documentType: "SI" | "BL";
    provider?: (typeof TEXT_PROVIDER_IDS)[number];
  }) => {
    // Parses according to file format (PDF/xlsx/docx can't be read directly as UTF-8 — that would just produce garbled text)
    const parsed = await readSampleAttachmentParsed(attachment_path);
    if (parsed.status !== "ok") {
      // The parser's raw error only goes into server-side logs, never back to the MCP caller (same convention as the REST side)
      console.warn(
        `[extraction] Attachment ${attachment_path} failed to parse (raw details are server-side log only): ${parsed.error ?? "unknown reason"}`
      );
      throw new Error(`Attachment ${attachment_path} has no extractable text (may be a scanned image or a corrupted file), cannot extract fields`);
    }
    return extractFields({ documentText: parsed.text, documentType, provider });
  },
};

// Manual review loop (P1-1): the queue = emails that are NEEDS_REVIEW for an extraction-related reason
export const extractionReviewMcpTools = makeReviewMcpTools("extraction", "extraction");
