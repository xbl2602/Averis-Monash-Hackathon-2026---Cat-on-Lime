import {
  COMPARED_FIELDS,
  type ExtractedDocumentFields,
  type ComparisonStatus,
  type ComparedField,
  type ReviewReason,
} from "@/lib/shared/types";

export interface CompareDocumentsInput {
  si: ExtractedDocumentFields;
  bl: ExtractedDocumentFields;
}

export interface CompareDocumentsResult {
  status: ComparisonStatus;
  defect_fields: ComparedField[];
  has_defect: boolean;
  review_reason: ReviewReason | null;
}

/**
 * 占位实现：目前只是最简单的"逐字段完全相等才算OK"字符串比较。
 * TODO(comparison 负责人): 还没有处理的情况，换成真实逻辑时要考虑：
 * - 大小写/多余空格等"看起来不一样但其实一样"的情况（不能算 defect）
 * - 数字/日期格式不同但含义相同（比如 "1,000" vs "1000"）
 * - 两边都缺某个字段时，不该直接判 OK，应该走 status:"NEEDS_REVIEW" +
 *   review_reason:"missing_value"（枚举定义见 @/lib/shared/types）
 */
export async function compareDocuments(
  input: CompareDocumentsInput
): Promise<CompareDocumentsResult> {
  const defect_fields = COMPARED_FIELDS.filter(
    (field) => (input.si[field] ?? "") !== (input.bl[field] ?? "")
  );

  return {
    status: defect_fields.length > 0 ? "MISMATCH" : "OK",
    defect_fields,
    has_defect: defect_fields.length > 0,
    review_reason: null,
  };
}
