/**
 * Flattening (normalize): put text into a canonical form — case-insensitive, whitespace
 * collapsed, full-width characters converted to half-width.
 *
 * Two uses:
 * 1. Computed once on email import and stored in the *_normalized database column, for
 *    preview/search;
 * 2. Later, when comparing fields, flatten both sides first so pure formatting differences
 *    (case, extra spaces — beyond things like "1,000 vs 1000") aren't misreported as mismatches.
 *
 * Note: flattening is only for "comparison/search" — never feed flattened text into the LLM for
 * extraction (lowercasing and collapsing whitespace loses information and hurts extraction
 * quality).
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC") // full-width letters/digits/spaces → half-width
    .toLowerCase()
    .replace(/\s+/g, " ") // collapse runs of whitespace (including newlines, tabs, non-breaking spaces) into a single space
    .trim();
}
