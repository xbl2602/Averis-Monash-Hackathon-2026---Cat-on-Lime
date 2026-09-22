# Decision Spec (DECISION_SPEC)

> **What this document is**: the authoritative definition of **every decision point** across the classification / extraction / comparison modules — the options and their definitions, the programmatic decision criteria, the model decision criteria, the flattened input sent to the model, priority order, thresholds, and output mapping.
> **Mandatory**: if a code change affects anything documented here (options, definitions, prompts, thresholds, input fields), this file **must be updated in the same change**, and `npm run evaluate -- --no-write` must be re-run to confirm the score is still 520/520 (see §7).
> Related: [DATA_FLOW.md](DATA_FLOW.md) (data flow between modules), [SHARED_INTERFACES.md](SHARED_INTERFACES.md) (external interfaces), [DECISION_LOG.md](DECISION_LOG.md) (historical reasons behind decisions).

## 1. General Principles

1. **Rules first, model as fallback**: any decision that can be made with deterministic code always goes through rules (no tokens spent, stable results, regression-testable); the model is only called when the rules "clearly can't decide."
   - Classification: 52 high-precision signatures + scoring (as of 2026-09-20, a forced full re-run measured 520/520 going entirely through rules; Jev only backstops new emails the rules can't decide)
   - Extraction: label-based rules (fully extracts 237/242 readable sample documents; anything clearly not SI/BL goes straight to OTHER, never reaching the model)
   - Comparison: normalized exact match; numeric fields are always decided programmatically; only "candidate differences in text fields" are handed to Jev
2. **Model input must be flattened**: the payload sent to Jev / an LLM can only be **single-level, plain text, essential fields only** — the full email object, attachment list, database row, or any nested structure is never allowed.
3. **The two "flattening" concepts are different things** (easy to confuse, so this draws a clear line):
   - **Structural flattening** (for sending to the model): pick only the essential fields as single-level strings — see §2.3 / §2.4 / §3.3 / §4.2 / §6 for the exact shape at each call site.
   - **Text normalization `normalizeText`** (`lib/shared/normalize.ts`): lowercasing / whitespace collapsing / full-width to half-width conversion — **used only for programmatic comparison and lookup; normalized text must never be fed to a model** (it loses information and degrades extraction quality; the header of normalize.ts carries the same warning).
4. **Unified threshold of 0.85**: Jev classification confidence < 0.85 -> `needs_review=true`; Jev field-equivalence probability noul < 0.85 -> recorded as a difference. Don't change a threshold in just one place.
5. **Call conventions**: `callLLM` / `callJev` share a uniform 20s timeout and normalized errors (missing key -> a readable config error; upstream failure -> a stable code, without passing the raw text through); every result is written to `llm_call_cache` (key = purpose + engine version + provider + model + sent content), so unchanged input never triggers a repeat call. **Retries** (2026-09-21, P1-2): `callLLM` automatically retries once within the same provider (after a 2-second wait) for timeouts/rate limits/upstream 5xx/network errors; deterministic errors like 401/403/400/422 are never retried; `callJev` never retries — on failure it's handed straight to the upper hybrid engine to move to the next tier (see decision 25). This same-provider retry layer stacks with the cross-provider fallback chain in `lib/shared/llm-chain.ts`; the two are additive, not substitutes for each other.

## 2. Classification

### 2.1 Options and Definitions

The single source of truth is `EMAIL_CATEGORIES` in `lib/shared/types.ts`; the definitions live in `CATEGORY_DEFINITIONS` in `logic/index.ts`.

| Option | Definition |
|---|---|
| BL_COMPARISON | Sends a draft Bill of Lading (BL) and asks to check/confirm whether it matches the Shipping Instruction (SI) |
| SI_REQUEST | Sends or requests a Shipping Instruction (SI) |
| INVOICE_QUERY | Asks about invoices, fees, or payment-related matters |
| GENERAL | Other normal shipping-business correspondence that doesn't fall into the categories above and isn't spam |
| SPAM | Advertising, phishing, or junk mail unrelated to shipping business |

These 5 definitions are used in two places: the criteria for Jev's choice (§2.3) and the text-LLM prompt (§2.4). **The two must match verbatim.**

### 2.2 Programmatic Decision Criteria (`rules.ts`; a match is final, no model call)

- Input: `normalizeText(subject + " " + subject + " " + body)` (the subject is counted twice for extra weight)
- Tier 1: 52 signature regexes checked in a fixed order, stopping at the first match (**the order matters and must not be reshuffled**): 14 SPAM patterns -> 14 GENERAL patterns (including internal notification templates like "Submit SI & AED", "Billing process," which must be checked before the BL/SI/invoice patterns to avoid being thrown off by misleading keywords) -> 10 BL_COMPARISON patterns -> 7 SI_REQUEST patterns -> 7 INVOICE_QUERY patterns
- Tier 2 (no signature matched): keyword-list scoring (one set of keywords per category, tallying how many hit) -> a conclusion is only drawn automatically when `topScore >= 1` and the `gap over the runner-up >= 2`
- If neither tier resolves it -> hand off to the model (§2.3 / §2.4); the engine responsible for the result is tagged `rules` / `jev` / `llm` (internal metadata; doesn't change the external contract)

### 2.3 Model Decision #1: Jev (when uncertain and `TYPESAFE_API_KEY` is present)

- Model: the `JEV_MODEL` environment variable, default `jev-latest`
- **Flattened input (state)**: `{ from, subject, body }` — just 3 single-level strings (no attachments, no metadata sent)
- Question (questions.category):
  - `type: choice`
  - `instructions: Which category does this email belong to?`
  - `criteria:` matches the 5 definitions in §2.1 verbatim
- Decision criteria: `confidence >= 0.85` -> accepted directly; `< 0.85` -> `needs_review=true` (corresponding to problem-statement requirement (4), "flag uncertain cases for human review")
- Cache purpose: `classification`

### 2.4 Model Decision #2: Text LLM (when a provider is explicitly specified, or as a fallback when Jev is unavailable; defaults to gemini)

Prompt text (from `logic/index.ts`):

```
Determine which category the shipping email below belongs to. Reply with only the category code itself — no explanation, no punctuation, no other text.

Available categories:
- BL_COMPARISON: sends a draft Bill of Lading (BL) and asks to check/confirm whether it matches the Shipping Instruction (SI)
- SI_REQUEST: sends or requests a Shipping Instruction (SI)
- INVOICE_QUERY: asks about invoices, fees, or payment-related matters
- GENERAL: other normal shipping-business correspondence that doesn't fall into the categories above and isn't spam
- SPAM: advertising, phishing, or junk mail unrelated to shipping business

Email:
From: {from}
Subject: {subject}
Body:
{body}
```

- **Flattened input**: the prompt contains only the three fields From / Subject / Body (the content comes from the same flattened structure as §2.3)
- Decision criteria: a category code must be found somewhere in the response text (case-insensitive), otherwise it throws an error (never guesses)
- Cache purpose: `classification_llm`

### 2.5 Output Mapping

`category` (required) + `confidence` (present only on the Jev path; null on the rules path) + `needs_review` (can only be triggered by Jev's confidence)

## 3. Extraction

### 3.1 Fields and Definitions

The single source of truth is `COMPARED_FIELDS` in `lib/shared/types.ts`, 7 fields in total: shipper / consignee / notify_party / port_of_loading / port_of_discharge / container_count / gross_weight_kg.
These must be **aligned by meaning**, not by the literal field label in the source document — the same field is worded differently across different documents.

### 3.2 Programmatic Decision Criteria (`label-parser.ts`, runs before the model)

1. `isLikelyOtherDocument` (`lib/shared/document-identify.ts`): a match against `commercial invoice | packing list | certificate of origin` -> `document_type=OTHER`, `fields={}`, **no model call** (the layer above uses this to determine wrong_doc_type)
2. Label-rule parsing (covers every sample layout across txt / xlsx / docx / text-layer PDF):

| Field | Label variants (matched from line-start after NFKC + lowercasing) |
|---|---|
| shipper | `^shipper(/exporter)?` |
| consignee | `^consignee`, `^to the order of` (common on bills of lading) |
| notify_party | `^notify( party)?` |
| port_of_loading | `^port of loading`, `^pol`, `^load(ing) port` |
| port_of_discharge | `^port of discharge`, `^pod`, `^discharge port` |
| container_count | `^container count`, `^total containers?`, `^no. of containers?( or packages)?`, `^containers` |
| gross_weight_kg | `^(total )?gross\s*(wt|weight)\w*` (`\w*` accommodates the "Weightnn" typographic variant seen in samples) |

   The value may appear on the same line as the label (txt/xlsx) or on a following line (docx/pdf): organization-name fields take only 1 line (to avoid picking up address noise), other fields take up to 3 lines; collection stops as soon as the next section heading (STOP_LINE) or a divider line is hit
3. Value validation (guards against bad extractions): after stripping whitespace/punctuation, the value must be non-empty, must not be a placeholder (`TBA / N/A / null / blank / — / ____` etc., matched by the `PLACEHOLDER_VALUE` regex), and must pass field-specific validation (container_count must look like `number( x description)?`; gross_weight_kg must be a number plus an optional unit)
4. If all 7 fields are extracted -> return immediately, no model call

### 3.3 Model Decision: LLM Fallback (only when fields are missing; defaults to gemini)

Prompt text (from `logic/index.ts`):

```
You are a shipping-documentation assistant. Extract 7 fields from the {SI|BL} document text below (align by "meaning," not by the literal field label in the source document).

Field list: shipper, consignee, notify_party, port_of_loading, port_of_discharge, container_count, gross_weight_kg

Rules:
- Only extract values that genuinely appear in the document — never guess
- Fields you can't find should be null; placeholders (e.g. TBA / N/A / ____MT / blank) should also be null
- Output a single JSON object only — no explanation, no code block

Document text:
{documentText}
```

- **Flattened input**: only `document_type` (SI/BL, appears in the prompt sentence) + `document_text` (a single plain-text blob) — no filename, attachment list, or metadata is sent
- Decision criteria: a JSON object must be parseable from the response (tolerates ``` code fences and extra surrounding text); non-string values are discarded; placeholders are discarded
- **Merge rule: values extracted by rules take priority, the LLM only fills gaps** (rule-derived values are more reliable since they've passed validation)
- Failure degradation: if the LLM errors or returns something unparseable -> fall back to the rules-only result and log it (missing fields will be flagged missing_value further up), without derailing the whole batch
- Cache purpose: `extraction_llm`

## 4. Comparison

### 4.1 Programmatic Decision Criteria (normalize + exact match; numeric fields never go to the model)

Each side's value for the same field is first run through `canonicalFieldValue` (`logic/canonical.ts`):

| Field | Normalization rule |
|---|---|
| shipper / consignee / notify_party | normalizeText -> take the entity name before `\|` -> strip `.` `,` -> if a legal suffix (Pte Ltd / Sdn Bhd / Co Ltd / Limited / LLC / GmbH / FZE / Inc / Company) appears within 60 characters, truncate right after the suffix (strips off any trailing address) |
| container_count | normalizeText -> strip whitespace and `' ’ " “ ” .` |
| gross_weight_kg | normalizeText -> keep digits only -> strip leading zeros (thousands separators/unit differences have no effect) |
| port_of_loading / port_of_discharge | normalizeText |

- Same after normalization -> match; different -> candidate difference
- **For numeric fields (container_count / gross_weight_kg), a candidate difference is immediately treated as a real difference and is never sent to Jev** (testing showed Jev would judge "5 x 20'GP" vs "6 x 20'GP" as the same)
- One side has a value and the other doesn't -> defensively recorded as a difference (the normal flow already catches this upstream as missing_value)
- If there's no "text-field candidate difference," or Jev is unavailable -> text candidates are **counted as differences directly** (conservative, to avoid under-reporting), engine=`rules`

### 4.2 Model Decision: Jev Reviews Text-Field Candidate Differences (hybrid mode)

- Model: `jev-latest` (JEV_MODEL)
- **Flattened input (state)**: `[{ field, si_value, bl_value }, …]` — contains only the candidate fields' **raw values** (not the normalized values; normalization is only used to select candidates)
- Question (one per candidate field, type=noul):
  - `instructions: Do the SI and BL {field} refer to the same thing? Tolerate differences in case, spacing, punctuation, and word order; if they refer to different entities/places, they don't.`
  - `criteria: { true: "same meaning", false: "different meaning or cannot confirm they match" }`
- Decision criteria: `noul >= 0.85` -> match; `< 0.85` -> difference (0.85 is a calibrated ceiling from testing: the highest score seen for a genuine difference was 0.52, and the lowest for a genuine match was 0.88; raising it further starts producing false positives)
- Cache purpose: `field_equivalence`
- The explicit `provider=jev` interface (`compareWithJev`) asks about **every comparable field**, with slightly different criteria wording:
  `true: "exactly the same, or differs only in format/case/spacing but means the same thing"` / `false: "different meaning, or one side is missing and a match cannot be confirmed"`

### 4.3 Output Mapping

`status` (OK / MISMATCH / NEEDS_REVIEW) + `defect_fields` (list of differing fields) + `has_defect` + `review_reason` (non-empty only when NEEDS_REVIEW)

## 5. Pipeline "Uncertain" Determinations (review_reason, fixed check order)

| Order | review_reason | Decision criteria (all programmatic) |
|---|---|---|
| 1 | missing_attachment | Classified as BL_COMPARISON, but either the `_SI` or `_BL` attachment is missing, and the body promises a "check/comparison" (regex `(compare\|check)…(si\|draft bl\|bill of lading)`); merely requesting a file ("please send the draft BL") doesn't count and is treated as OK |
| 2 | wrong_doc_type | Either attachment is identified as OTHER (commercial invoice/packing list/certificate of origin) |
| 3 | unreadable | Attachment parsing failed (scanned/corrupted) or extraction returned empty |
| 4 | missing_value | Any of the 7 fields is missing on either the SI or BL side (including placeholders) |

If none of the above trigger -> proceed to comparison (§4), outputting OK / MISMATCH.

## 6. Model Call Site Registry (the single registry; any new call site must be registered here)

| # | Call site | Trigger condition | Model | Flattened input | Output/decision | Cache purpose |
|---|---|---|---|---|---|---|
| 1 | Classification (Jev) | Neither signatures nor scoring can decide, and `TYPESAFE_API_KEY` is present | `jev-latest` (JEV_MODEL) | `{ from, subject, body }` | choice; confidence < 0.85 -> needs_review | `classification` |
| 2 | Classification (text fallback) | An explicit provider != jev; or Jev is unavailable | gemini-3.6-flash (default) / claude-sonnet-4-5 / gpt-4o-mini / deepseek-chat / local-model | From / Subject / Body text | A category code must appear in the response, otherwise it errors | `classification_llm` |
| 3 | Extraction (gap-filling) | Rules are missing >= 1 field and it's not OTHER | `provider ?? gemini` | `{ document_type, document_text }` | JSON; null/placeholders discarded; rule-derived values take priority | `extraction_llm` |
| 4 | Comparison (review) | A text-field candidate difference exists and Jev is available | `jev-latest` | `[{ field, si_value, bl_value }]` | noul < 0.85 -> difference | `field_equivalence` |

## 7. Change Conventions (mandatory)

1. Changing any **option / definition / prompt / threshold / input field**: update this file first, then the code, then `npm run evaluate -- --no-write` must still come back **520/520** (100% classification macro-F1, 0 missed and 0 false-positive defect fields)
2. When substantively changing engine logic, bump `PIPELINE_LOGIC_VERSION` in `lib/shared/versions.ts` by 1 — the cache key includes the version, and skipping the bump mixes in stale results
3. Adding a new model call site: it must go through the unified `lib/llm` entry point (`callLLM` / `callJev`), use flattened input, and be registered in §6
4. Order-sensitive items (the classification signature order, the pipeline's review check order) must not be reshuffled, except after re-running the full evaluation and updating this file
