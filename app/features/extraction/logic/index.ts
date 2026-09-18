import type { ExtractedDocumentFields } from "@/lib/shared/types";

export interface ExtractFieldsInput {
  documentText: string;
  documentType: "SI" | "BL";
}

/**
 * TODO(extraction 负责人): 这是占位实现，还没有真的从文档文本里抽取字段。
 * 换成真实逻辑时：调用 @/lib/llm 的 callLLM，把 documentText 丢给模型，
 * 按 COMPARED_FIELDS（shipper / consignee / notify_party / port_of_loading /
 * port_of_discharge / container_count / gross_weight_kg，定义见 @/lib/shared/types）
 * 抽取结构化字段。注意 SI 和 BL 对同一个字段的叫法可能不一样（比如 "Port of Loading"
 * vs "Load Port"），要按"含义"对齐，不要死板匹配原文字段名。
 */
export async function extractFields(
  input: ExtractFieldsInput
): Promise<ExtractedDocumentFields> {
  void input; // 占位实现还用不到参数，先保留签名
  return {};
}
