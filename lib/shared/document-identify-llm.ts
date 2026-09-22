/**
 * "Rules + LLM fallback" version of content-based document type identification (added
 * 2026-09-21, P0-3).
 *
 * Layered the same way as the classification engine (deterministic first, the model only
 * touches the gray area):
 * 1. Keyword rules (document-identify.ts, a pure function already used by the import module)
 *    return directly whenever they can decide;
 * 2. Only when the rules can't decide (UNKNOWN) do we ask the text-model chain, and the model
 *    is only allowed to pick one of SI / BL / OTHER / UNKNOWN;
 * 3. If the model also fails: treat as UNKNOWN (the caller already has an existing branch for
 *    "missing/unreadable attachment", so nothing crashes).
 *
 * The model only receives a snippet of the document text (no filename/path/email metadata —
 * see the model-input contract in DECISION_SPEC).
 */
import type { LLMProvider } from "@/lib/llm";
import { identifyDocumentType } from "./document-identify";
import { callTextLLMChain } from "./llm-chain";
import type { DocumentType } from "./types";

// Looking at just this leading chunk is enough to decide (titles/keywords are always in the
// first few paragraphs), avoiding sending the whole document to the model
const SNIPPET_LENGTH = 2000;

const ALLOWED_TYPES: readonly string[] = ["SI", "BL", "OTHER", "UNKNOWN"];

export async function identifyDocumentTypeSmart(
  text: string,
  preferred?: LLMProvider
): Promise<DocumentType> {
  const ruled = identifyDocumentType(text);
  if (ruled !== "UNKNOWN") return ruled;

  const snippet = text.slice(0, SNIPPET_LENGTH);
  const prompt = `You are a shipping-document classification assistant. Based only on the document text below, decide which one type it is. Answer with a single word, no explanation:
SI (Shipping Instruction)
BL (Bill of Lading, or a draft bill of lading)
OTHER (commercial invoice / packing list / certificate of origin / other document)
UNKNOWN (cannot be determined)

Document text:
${snippet}`;

  try {
    const { text: answer } = await callTextLLMChain({
      purpose: "document_identify",
      prompt,
      preferred,
    });
    return parseDocumentTypeAnswer(answer);
  } catch (err) {
    console.warn(
      `[document-identify] Rules couldn't decide and the model fallback failed too; treating as UNKNOWN: ${err instanceof Error ? err.message : err}`
    );
    return "UNKNOWN";
  }
}

/** Only the first standalone valid word in the model's answer counts; anything off-topic is treated as UNKNOWN (never guessed) */
function parseDocumentTypeAnswer(answer: string): DocumentType {
  const tokens = answer.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  const hit = tokens.find((token) => ALLOWED_TYPES.includes(token));
  return (hit as DocumentType | undefined) ?? "UNKNOWN";
}
