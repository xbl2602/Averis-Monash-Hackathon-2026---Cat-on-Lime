import { callJev, type JevQuestion, type LLMProvider } from "@/lib/llm";
import {
  COMPARED_FIELDS,
  type ComparedField,
  type ExtractedDocumentFields,
  type ComparisonStatus,
  type ReviewReason,
} from "@/lib/shared/types";

export interface CompareDocumentsInput {
  si: ExtractedDocumentFields;
  bl: ExtractedDocumentFields;
  /**
   * 用哪种方式比对。默认 claude（沿用原有的"逐字符精确比较"，不调用模型）。
   * 传 "jev" 时会让 Jev 逐字段判断两边是否指同一个东西，能容忍
   * "1,000 vs 1000"、大小写/空格等格式差异。
   */
  provider?: LLMProvider;
}

export interface CompareDocumentsResult {
  status: ComparisonStatus;
  defect_fields: ComparedField[];
  has_defect: boolean;
  review_reason: ReviewReason | null;
}

// Jev 对每个字段返回"两边是否一致"的概率，低于这个值就算不一致
const JEV_MISMATCH_THRESHOLD = 0.5;

export async function compareDocuments(
  input: CompareDocumentsInput
): Promise<CompareDocumentsResult> {
  const provider = input.provider ?? "claude";
  if (provider === "jev") {
    return compareWithJev(input.si, input.bl);
  }
  return compareByExactValue(input.si, input.bl);
}

// 原逻辑：逐字段完全相等才算 OK（格式差异会被误判为 defect，所以才有 Jev 这条路）
function compareByExactValue(
  si: ExtractedDocumentFields,
  bl: ExtractedDocumentFields
): CompareDocumentsResult {
  const defect_fields = COMPARED_FIELDS.filter(
    (field) => (si[field] ?? "") !== (bl[field] ?? "")
  );

  return {
    status: defect_fields.length > 0 ? "MISMATCH" : "OK",
    defect_fields,
    has_defect: defect_fields.length > 0,
    review_reason: null,
  };
}

// 用 Jev 的 noul（是/否概率）逐字段判断，容忍格式差异但不放过真实不一致
async function compareWithJev(
  si: ExtractedDocumentFields,
  bl: ExtractedDocumentFields
): Promise<CompareDocumentsResult> {
  const comparableFields = COMPARED_FIELDS.filter(
    (field) => hasValue(si[field]) || hasValue(bl[field])
  );

  // 两边都没抽到任何可比较的字段，不能当作"全部一致"，交给上层处理
  if (comparableFields.length === 0) {
    return {
      status: "NEEDS_REVIEW",
      defect_fields: [],
      has_defect: false,
      review_reason: "missing_value",
    };
  }

  const questions: Record<string, JevQuestion> = {};
  for (const field of comparableFields) {
    questions[field] = {
      type: "noul",
      instructions: `SI 和 BL 上的 ${field} 指的是同一个东西吗？`,
      criteria: {
        true: "完全相同，或只是格式/大小写/空格不同但含义一致",
        false: "含义不同，或有一边缺失、无法确认一致",
      },
    };
  }

  const state = comparableFields.map((field) => ({
    field,
    si_value: si[field] ?? null,
    bl_value: bl[field] ?? null,
  }));

  const { answers } = await callJev(state, questions);

  const defect_fields = comparableFields.filter((field) => {
    const answer = answers[field];
    if (!answer || answer.type !== "noul") {
      throw new Error(`Jev 返回的比对结果格式异常：字段 ${field} 缺少 noul 答案`);
    }
    return answer.noul < JEV_MISMATCH_THRESHOLD;
  });

  return {
    status: defect_fields.length > 0 ? "MISMATCH" : "OK",
    defect_fields,
    has_defect: defect_fields.length > 0,
    review_reason: null,
  };
}

function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}
