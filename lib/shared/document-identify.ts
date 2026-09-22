/**
 * Identify document type from "document content" (not filename-dependent).
 *
 * Why this lives in lib/shared: both the import module (user-uploaded documents) and the
 * extraction module need to answer "what actually is this document" — there must be only one
 * set of rules, so the two sides don't slowly drift apart with separate implementations.
 *
 * The check order is deliberate: OTHER first, then SI, then BL —
 * 1. A trap in the sample set (e.g. email_501_BL.txt) is actually a commercial invoice, which
 *    still contains phrases like "B/L date" and "Seller/Buyer"; if OTHER isn't checked first,
 *    the invoice gets misread as a bill of lading. This also matches extraction's existing
 *    behavior (label-parser used to make this check itself).
 * 2. In the samples, an SI's title is sometimes written "BILL OF LADING INSTRUCTION", which
 *    contains the phrase "bill of lading" — so SI must be checked before BL, otherwise an SI
 *    gets misread as a BL.
 *
 * NOTE: the Chinese terms embedded in the regexes below (提单 "bill of lading", 提单号
 * "B/L number", 装运指示/托运指示/提单指示 "shipping instructions") are real signals that
 * appear in the shipping documents themselves (many are bilingual English/Chinese business
 * forms) — they are matched against document content, not descriptive text, and must not be
 * removed or translated.
 */
import type { DocumentType } from "./types";

// Signals for other document types (the three wrong_doc_type traps in the samples: commercial
// invoice / packing list / certificate of origin)
export function isLikelyOtherDocument(text: string): boolean {
  return /(commercial invoice|packing list|certificate of origin)/i.test(text);
}

// Strong BL signal: the body directly names a bill of lading (English "bill of lading"/"bl
// draft", or its Chinese equivalent 提单)
const BL_STRONG = /bill of lading|\bbl draft\b|提单/;
// Weak BL signal + corroboration: when only "B/L" appears, it must be accompanied by a BL-specific
// element such as the B/L number (English or 提单号) or vessel name
const BL_WEAK = /\bb\/l\b/;
const BL_SUPPORT =
  /(b\/l no|bill of lading no|提单号|ocean vessel|vessel|voyage|container count|place of delivery|to the order of)/;

// Strong SI signal: the title explicitly says "shipping instruction".
// In the samples, SI titles appear three ways: SHIPPING INSTRUCTION (txt), BILL OF LADING
// INSTRUCTION (pdf), BL INSTRUCTION (xlsx) — the latter two contain "bill of lading"/"BL" but
// are still "instructions to the carrier", so SI_STRONG must be checked before BL (which is
// written as "BILL OF LADING"/"BL DRAFT" without "instruction").
const SI_STRONG =
  /shipping instruction|(?:bill of lading|b\/l|bl)\s+instructions?\b|装运指示|托运指示|提单指示/;
// Weak SI signal + corroboration: when only "SI" appears, require at least 2 field labels that
// are specific to a shipping-instruction layout
const SI_WEAK = /\bsi\b|\bs\/i\b/;
const SI_FIELD_LABELS = [
  /shipper/,
  /consignee/,
  /notify/,
  /port of loading|\bpol\b/,
  /port of discharge|\bpod\b/,
  /container count|total containers/,
  /gross\s*(?:wt|weight)/,
];

/** Given document text, returns SI / BL / OTHER / UNKNOWN; a pure function with no side effects */
export function identifyDocumentType(text: string): DocumentType {
  const normalized = text.normalize("NFKC").toLowerCase();

  if (isLikelyOtherDocument(text)) return "OTHER";
  const siLabelHits = SI_FIELD_LABELS.filter((pattern) => pattern.test(normalized)).length;
  if (SI_STRONG.test(normalized) || (SI_WEAK.test(normalized) && siLabelHits >= 2)) {
    return "SI";
  }
  if (BL_STRONG.test(normalized) || (BL_WEAK.test(normalized) && BL_SUPPORT.test(normalized))) {
    return "BL";
  }
  return "UNKNOWN";
}
