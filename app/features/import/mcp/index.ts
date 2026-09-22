import { z } from "zod";
import {
  classifyUploadedDocument,
  DOCUMENT_TYPES,
  listUploadedDocuments,
  MANUAL_DOCUMENT_TYPES,
  normalizeClassifyRequest,
  normalizeDocumentListQuery,
  REVIEW_STATUSES,
} from "../logic";

/**
 * The MCP tools exposed by the import module, aggregated and registered by /app/core/mcp-server.
 * Handlers only forward "schema -> logic", sharing the same validation and implementation as REST.
 * Note: uploading itself doesn't go through MCP (large base64 files aren't suited to tool calls); MCP only offers querying and manual classification.
 */

const listUploadedDocumentsMcpTool = {
  name: "list_uploaded_documents",
  description:
    "Query the manually uploaded document pool (uploaded_documents): filename/size/hash/parse status/detected type/review status; the list only includes a preview of up to 500 characters of text, not the full content",
  inputSchema: {
    review_status: z
      .enum(REVIEW_STATUSES)
      .optional()
      .describe("pending=awaiting manual classification (UNKNOWN); filed=already classified; skipped=duplicate, skipped"),
    detected_type: z
      .enum(DOCUMENT_TYPES)
      .optional()
      .describe("Type detected from content: SI / BL / OTHER / UNKNOWN"),
    limit: z.number().int().min(1).max(200).optional().describe("Items per page, default 20, max 200"),
    offset: z.number().int().min(0).optional().describe("Number of items to skip, default 0"),
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) =>
    listUploadedDocuments(normalizeDocumentListQuery(args)),
};

const classifyUploadedDocumentMcpTool = {
  name: "classify_uploaded_document",
  description:
    "Manually classify an uploaded document: change an UNKNOWN document to SI / BL / OTHER, and set its review status to filed (this writes to the database). Optionally pass expected_updated_at for optimistic locking, returning a conflict error if the record was changed in the meantime",
  inputSchema: {
    id: z.string().describe("The document's uuid (from list_uploaded_documents or an upload result)"),
    detected_type: z.enum(MANUAL_DOCUMENT_TYPES).describe("Manual classification result: SI / BL / OTHER"),
    expected_updated_at: z
      .string()
      .optional()
      .describe("Optional optimistic lock: if it doesn't match the current updated_at in the database, the save is rejected with a conflict"),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) => {
    const doc = await classifyUploadedDocument(normalizeClassifyRequest(args));
    // The classification result only returns metadata, not the full extracted_text (to avoid an oversized MCP response)
    const { extracted_text: _text, ...meta } = doc;
    return { ok: true, ...meta };
  },
};

export const importMcpTools = [listUploadedDocumentsMcpTool, classifyUploadedDocumentMcpTool];
