/**
 * "Canonicalization" before comparison: put both sides into a comparable canonical form,
 * reducing false mismatches caused by pure formatting differences.
 * - Text fields: ignore case/whitespace/full-vs-half-width, strip trailing punctuation from
 *   company names, keep only the primary name before "|"
 * - Numeric fields: weight is reduced to plain digits (thousands separators/unit differences
 *   don't matter); container count has spaces and quotes stripped
 * Note: this is only used for the "comparison" decision — it never modifies the original text
 * that's stored/displayed (that lives in parsed_text / extracted_*).
 */
import { normalizeText } from "@/lib/shared/normalize";
import type { ComparedField } from "@/lib/shared/types";

export function canonicalFieldValue(field: ComparedField, value: string): string {
  const normalized = normalizeText(value);

  switch (field) {
    case "gross_weight_kg": {
      const digits = normalized.replace(/[^\d]/g, "");
      return digits ? String(Number(digits)) : normalized;
    }
    case "container_count":
      return normalized.replace(/[\s'’"“”.]/g, "");
    case "shipper":
    case "consignee":
    case "notify_party": {
      const name = normalized.split("|")[0].replace(/[\s:;]+$/g, "");
      const noPunct = name.replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
      return truncateAtNameSuffix(noPunct);
    }
    default:
      return normalized;
  }
}

// docx layouts sometimes run "company name + address" together (e.g. "KTP CO., LTDKTP BLDG., 36...").
// Use the heuristic that a company name ends in a legal suffix to cut off the trailing address,
// so a pure formatting difference doesn't get sent to Jev or even misjudged.
// Verified in practice: email_107's notify_party (concatenated vs. clean) no longer needs a model call because of this.
const NAME_SUFFIX =
  /(pte\.?\s*ltd\.?|sdn\.?\s*bhd\.?|co\.?,?\s*ltd\.?|limited|ltd\.?|llc|gmbh|fze|inc\.?|company)/i;

function truncateAtNameSuffix(value: string): string {
  const match = value.match(NAME_SUFFIX);
  if (!match || match.index === undefined || match.index > 60) return value;
  return value.slice(0, match.index + match[0].length);
}

// Numeric fields (once canonicalized, a difference is a real difference — these never go to Jev, which isn't good at numeric comparison)
export const NUMERIC_FIELDS: ReadonlySet<ComparedField> = new Set([
  "container_count",
  "gross_weight_kg",
]);
