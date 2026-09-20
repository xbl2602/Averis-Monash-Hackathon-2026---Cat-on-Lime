import { z } from "zod";
import { TEXT_PROVIDER_IDS } from "@/lib/llm";
import { readSampleAttachmentParsed } from "@/lib/shared/sample-inputs";
import { extractFields } from "../logic";

/**
 * extraction 模块的 MCP tool（只读）。
 * provider 只接受文本模型（TEXT_PROVIDER_IDS 排除了 jev；z.enum 在 handler 前就会挡掉）。
 */
export const extractionMcpTool = {
  name: "extract_document_fields",
  description:
    "从一份 SI（Shipping Instruction）或 BL（Bill of Lading）文档文本里抽取 shipper/consignee/notify_party/port_of_loading/port_of_discharge/container_count/gross_weight_kg 这7个字段，并判断文档类型（OTHER = 不是 SI/BL，如发票/装箱单）",
  inputSchema: {
    attachment_path: z
      .string()
      .describe('样例数据里的附件路径，例如 "attachments/email_004_SI.txt"'),
    documentType: z.enum(["SI", "BL"]),
    provider: z
      .enum(TEXT_PROVIDER_IDS)
      .optional()
      .describe("文本兜底模型，缺省 gemini；不支持 jev（jev 只能做结构化判断）"),
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
    // 按文件格式解析（PDF/xlsx/docx 不能按 UTF-8 直接读，那样只有乱码）
    const parsed = await readSampleAttachmentParsed(attachment_path);
    if (parsed.status !== "ok") {
      // 解析器原文只进服务端日志，不回传给 MCP 调用方（与 REST 侧同口径）
      console.warn(
        `[extraction] 附件 ${attachment_path} 解析失败（原始信息只进服务端日志）：${parsed.error ?? "未知原因"}`
      );
      throw new Error(`附件 ${attachment_path} 读不出文字（可能是扫描件或损坏文件），无法抽取字段`);
    }
    return extractFields({ documentText: parsed.text, documentType, provider });
  },
};
