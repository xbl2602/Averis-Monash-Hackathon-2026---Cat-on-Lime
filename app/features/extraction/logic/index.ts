/**
 * Field extraction (hybrid): label rules first, calling the LLM as a fallback only for missing fields.
 * - Rules cover every normal document in the samples (237 of 242 readable documents fully extracted; the other 5 are "wrong document type" traps)
 * - The LLM fallback only fires when rules leave fields missing; the prompt explicitly requires "fill null if not found, null for placeholders" to prevent fabrication
 * - A document that's clearly not SI/BL returns document_type=OTHER directly (the caller uses this to flag wrong_doc_type), avoiding a wasted call
 */
import { callLLM, type LLMProvider } from "@/lib/llm";
import { callWithCache } from "@/lib/shared/llm-cache";
import {
  COMPARED_FIELDS,
  type ComparedField,
  type ExtractedDocumentEvidence,
  type ExtractedDocumentFields,
  type ExtractDocumentResult,
} from "@/lib/shared/types";
import {
  isLikelyOtherDocument,
  parseDocumentFieldsWithEvidence,
  PLACEHOLDER_VALUE,
} from "./label-parser";

export interface ExtractFieldsInput {
  documentText: string;
  documentType: "SI" | "BL";
  /** Which text model to fall back to when rules leave fields missing; defaults to gemini */
  provider?: LLMProvider;
}

export async function extractFields(input: ExtractFieldsInput): Promise<ExtractDocumentResult> {
  if (isLikelyOtherDocument(input.documentText)) {
    return { document_type: "OTHER", fields: {}, extracted_by: "rules", evidence: {} };
  }

  const parsed = parseDocumentFieldsWithEvidence(input.documentText);
  const ruleFields = parsed.fields;
  const missing = COMPARED_FIELDS.filter((field) => !ruleFields[field]);
  if (missing.length === 0) {
    return {
      document_type: input.documentType,
      fields: ruleFields,
      extracted_by: "rules",
      evidence: parsed.evidence,
    };
  }

  const llmFields = await tryLlmExtraction(input);
  // Values from rules are validated and more reliable: rules take priority, the LLM only fills gaps
  const merged: ExtractedDocumentFields = { ...(llmFields ?? {}), ...ruleFields };
  const usedLlm = (Object.keys(llmFields ?? {}) as ComparedField[]).some(
    (field) => !ruleFields[field]
  );
  // Provenance: rule-extracted fields carry a line number + original text; LLM-filled fields only note the source (no line evidence, so no fake provenance is attached)
  const evidence: ExtractedDocumentEvidence = { ...parsed.evidence };
  if (llmFields) {
    for (const field of Object.keys(llmFields) as ComparedField[]) {
      if (!ruleFields[field]) evidence[field] = { source: "llm" };
    }
  }
  return {
    document_type: input.documentType,
    fields: merged,
    extracted_by: usedLlm ? "llm" : "rules",
    evidence,
  };
}

/**
 * The model-input flattening contract (see docs/DECISION_SPEC.md §3.3/§6):
 * only documentType (SI/BL) + a single plain-text document body are sent;
 * filenames, attachment paths, and parsing metadata never go into the model input.
 */
async function tryLlmExtraction(
  input: ExtractFieldsInput
): Promise<ExtractedDocumentFields | null> {
  const provider = input.provider ?? "gemini";
  const prompt = buildExtractionPrompt(input);

  try {
    const { value: raw } = await callWithCache({
      purpose: "extraction_llm",
      provider,
      model: provider,
      request: { prompt },
      execute: () => callLLM(provider, prompt),
    });
    const parsed = parseJsonObject(raw);
    if (!parsed) {
      console.warn(`[extraction] The LLM fallback did not return valid JSON; using rule results only this time: ${raw.slice(0, 200)}`);
      return null;
    }
    return sanitizeLlmFields(parsed);
  } catch (err) {
    // If the LLM fallback fails (e.g. no key configured), degrade to "rule results only": any
    // missing field will be flagged missing_value further up, so one failed fallback doesn't
    // drag down the whole batch; the reason is logged here for debugging (never swallowed silently)
    console.warn(
      `[extraction] LLM fallback call failed (${provider}); using rule results only this time:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

function buildExtractionPrompt(input: ExtractFieldsInput): string {
  return `You are a shipping-document assistant. Extract 7 fields from the ${input.documentType} document text below (match by meaning, not by the exact field names used in the original text).

Fields: ${COMPARED_FIELDS.join(", ")}

Rules:
- Only extract values that genuinely exist in the document — never guess
- Fill null for any field you can't find; also fill null for placeholders (e.g. TBA / N/A / ____MT / blank)
- Output a single JSON object only — no explanation, no code block

Document text:
${input.documentText}`;
}

// Tolerate the model wrapping the JSON in a code block or surrounding it with extra text
function parseJsonObject(text: string): Record<string, unknown> | null {
  const withoutFence = text.replace(/```(?:json)?/gi, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(withoutFence.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function sanitizeLlmFields(parsed: Record<string, unknown>): ExtractedDocumentFields {
  const fields: ExtractedDocumentFields = {};
  for (const field of COMPARED_FIELDS) {
    const raw = parsed[field];
    if (typeof raw !== "string") continue;
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (!cleaned || PLACEHOLDER_VALUE.test(cleaned)) continue;
    fields[field] = cleaned;
  }
  return fields;
}
