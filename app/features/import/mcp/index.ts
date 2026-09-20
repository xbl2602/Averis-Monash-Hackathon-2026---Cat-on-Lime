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
 * import 模块暴露的 MCP tool，被 /app/core/mcp-server 汇总注册。
 * handler 只做"schema → logic"的转发，和 REST 共用同一套校验与实现。
 * 注意：上传本身不走 MCP（base64 大文件不适合工具调用），MCP 只提供查询和人工归类。
 */

const listUploadedDocumentsMcpTool = {
  name: "list_uploaded_documents",
  description:
    "查询手动上传的文档池（uploaded_documents）：文件名/大小/哈希/解析状态/识别类型/复核状态，列表只带最多 500 字符的文本预览，不含全文",
  inputSchema: {
    review_status: z
      .enum(REVIEW_STATUSES)
      .optional()
      .describe("pending=待人工归类（UNKNOWN）；filed=已归类；skipped=重复跳过"),
    detected_type: z
      .enum(DOCUMENT_TYPES)
      .optional()
      .describe("按内容识别出的类型：SI / BL / OTHER / UNKNOWN"),
    limit: z.number().int().min(1).max(200).optional().describe("每页条数，缺省 20，最大 200"),
    offset: z.number().int().min(0).optional().describe("跳过多少条，缺省 0"),
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
    "人工归类一个已上传文档：把 UNKNOWN 文档改成 SI / BL / OTHER，并把复核状态置为 filed（会写库）。可选 expected_updated_at 做乐观锁，记录被改过时返回冲突错误",
  inputSchema: {
    id: z.string().describe("文档 uuid（从 list_uploaded_documents 或上传结果里取）"),
    detected_type: z.enum(MANUAL_DOCUMENT_TYPES).describe("人工归类结果：SI / BL / OTHER"),
    expected_updated_at: z
      .string()
      .optional()
      .describe("可选乐观锁：与库里当前 updated_at 不一致时拒绝保存并提示冲突"),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async (args: Record<string, unknown>) => {
    const doc = await classifyUploadedDocument(normalizeClassifyRequest(args));
    // 归类结果只回元数据，不回整篇 extracted_text（避免 MCP 响应过大）
    const { extracted_text: _text, ...meta } = doc;
    return { ok: true, ...meta };
  },
};

export const importMcpTools = [listUploadedDocumentsMcpTool, classifyUploadedDocumentMcpTool];
