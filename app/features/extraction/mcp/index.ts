import { z } from "zod";
import { readSampleAttachmentParsed } from "@/lib/shared/sample-inputs";
import { extractFields } from "../logic";

export const extractionMcpTool = {
  name: "extract_document_fields",
  description:
    "从一份 SI（Shipping Instruction）或 BL（Bill of Lading）文档文本里抽取 shipper/consignee/notify_party/port_of_loading/port_of_discharge/container_count/gross_weight_kg 这7个字段，并判断文档类型（OTHER = 不是 SI/BL，如发票/装箱单）",
  inputSchema: {
    attachment_path: z
      .string()
      .describe('样例数据里的附件路径，例如 "attachments/email_004_SI.txt"'),
    documentType: z.enum(["SI", "BL"]),
  },
  handler: async ({
    attachment_path,
    documentType,
  }: {
    attachment_path: string;
    documentType: "SI" | "BL";
  }) => {
    // 按文件格式解析（PDF/xlsx/docx 不能按 UTF-8 直接读，那样只有乱码）
    const parsed = await readSampleAttachmentParsed(attachment_path);
    if (parsed.status !== "ok") {
      throw new Error(
        `附件 ${attachment_path} 读不出文字（${parsed.error ?? "未知原因"}），无法抽取字段`
      );
    }
    return extractFields({ documentText: parsed.text, documentType });
  },
};
