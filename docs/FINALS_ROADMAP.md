# Finals Sprint Handbook: Scoring Criteria, Backend Gaps, and Execution Order (2026-09-20)

Sources: (1) the official preliminary-round/finals scoring rubric Google Docs (full text captured 2026-09-20; links in the evidence index at the end); (2) the data generator and scoring scripts inside the official problem package (read-only analysis); (3) two isolated-agent research reports; (4) verification against this repo's current state (including a personally re-verified bug). Text is tagged 【Official wording】【Verified】【Inference】.

---

## 1. Preliminary Round Scoring Rubric (determines advancement to the top 10)

Total 100 = Technical 70 + Product & Impact 30. The single largest item is **Working Core Prototype at 25 points**.

| # | Item | Points | "Excellent"-tier highlights (paraphrased from the official text) |
|---|---|---|---|
| 1 | System Design & Architecture | 15 | The architecture is coherent, well-reasoned, and backed by the prototype or other technical evidence |
| 2 | Working Core Prototype | 25 | The core flow reliably runs end-to-end, clearly proving the main technical idea has been built |
| 3 | Technology Integration | 15 | Technology choices are sound and deeply, seamlessly integrated; the tools are used to their fullest, with a real sense of technical craft |
| 4 | Technical Feasibility & Validation | 15 | Every key assumption has clear supporting evidence, with a credible path to finishing the project |
| 5 | Problem Statement Understanding | 10 | Strong, evidence-backed understanding of the problem, the affected users, and why it matters |
| 6 | Innovation & Solution Approach | 10 | The approach is original, well-justified, and has a clear advantage over common approaches |
| 7 | Practical Value & Potential | 10 | Strong practical value plus a credible path to adoption/real-world deployment |

Key points from the official scoring notes: all seven items are scored independently, in whole numbers; **the same piece of evidence cannot earn points twice**; "scores are based on what has been **demonstrated, submitted, or clearly explained**."

## 2. Finals Scoring Rubric (determines the winner)

Total 100 = Technical 70 + Product & Impact 30. The single largest item becomes **End-to-End Functionality at 25 points**.

| # | Item | Points | "Excellent"-tier highlights (paraphrased from the official text) |
|---|---|---|---|
| 1 | End-to-End Functionality | 25 | The finished product reliably runs end-to-end, with major features and integrations working as expected |
| 2 | Architecture & Scalability | 15 | The architecture is well-justified with clear trade-offs, has a realistic scaling path, and is backed by the implementation |
| 3 | Technology Integration | 15 | Same as preliminary-round item 3 (**marked provisional, may be adjusted once aligned with sponsors**) |
| 4 | Engineering Quality & Robustness | 15 | Thoroughly tested, reliable, handles failure gracefully; security and performance are considered, strong engineering discipline |
| 5 | Solution Effectiveness & User Value | 10 | Strong problem-solution fit, with evidence that the finished product delivers real value |
| 6 | User Experience & Differentiation | 10 | Usability and differentiation are **equally important**; polished, intuitive, clearly differentiated |
| 7 | Impact & Future Potential | 10 | A credible adoption/growth path, with **clear metrics for measuring success** |

## 3. Key Takeaways (implications for strategy)

1. **The preliminary round looks at "did you get it working," the finals look at "is the finished product reliable + engineered rigorously + ready for real deployment."** Our current state (520/520 end-to-end, deployed through all three entry points, architecture fully documented) sits at the 19-25 tier for the prototype item and the 12-15 tier for architecture/integration/validation under the preliminary rubric; under the finals rubric, what genuinely needs shoring up is **Engineering Quality & Robustness (15)** (testing evidence) and **UX & Differentiation (10)** (the human review loop/differentiation).
2. **Evidence only counts if it's "demonstrated/submitted/explained."** The slides and the 5-minute video should lay out evidence against each of the rubric's seven items in turn (architecture diagrams, data flow, evaluation numbers, error-handling demos, future roadmap) rather than piling up "the same evidence scored twice."
3. **The likely form of finals testing (inference, with the following evidence chain)**: the official problem package includes a data generator, `data_v2/generate.py`, whose README explicitly states `--seed 42` and "Change the seed for a fresh draw"; the official scoring script `server/scoring.py` weights things as **50% end-to-end + 30% classification macro-F1 + 20% defect-field F1** (NEEDS_REVIEW only counts toward the diagnostic reliability metric, unweighted). From this we infer that the finals' "unseen emails" are very likely to be **a fresh draw from the same generator with a different seed**.
4. **This points to the highest-ROI action: multi-seed regression testing** — use the official generator to produce data for 3-5 new seeds, and score them locally ahead of time against the official `scoring.py`'s four-axis criteria as a "finals dry run." This step also doubles as direct evidence for preliminary-round item 4 (Feasibility & Validation).
5. **Don't add tolerance to numeric fields** (inference basis: the problem package's defect-injection logic swaps entities or adjusts container count by +/-1/+/-2, weight by +/-500-2000kg; adding tolerance would directly cause missed detections of the official differences).
6. **Don't enable OCR by default**: the official expectation for scanned/broken files is exactly NEEDS_REVIEW; having OCR change the verdict would actually hurt reliability — it can only be a "demo mode" (off by default, read-only preview, never touching the official result path).

## 4. Verified Backend Gaps

### 4.1 A Personally Re-Verified Bug: Blank Placeholders Not Recognized (highest priority)

- Fact: `PLACEHOLDER_VALUE = /^[_\-\s.]*$|^(tba|n\/?a|null|—|-)$/i` in `app/features/extraction/logic/label-parser.ts:47` doesn't recognize `???`, `TBC`, or `____MT`.
- I personally re-verified this (2026-09-20, calling the parser directly via `npx tsx`):

  ```
  "???"     -> {"shipper":"???"}
  "TBC"     -> {"shipper":"TBC"}
  "____MT"  -> {"shipper":"____MT"}
  "TBA" -> {}   "N/A" -> {}   "" -> {}   <- these behave correctly
  ```

- The official edge-case sample pool `edgecases.py` has `BLANK_TOKENS = ["???", "_______", "TBA", "TBC", "", "N/A", "____MT"]`.
- Impact (inference): after a seed change, if `???`/`TBC`/`____MT` lands on a **text field**, we won't flag `missing_value` (NEEDS_REVIEW) — instead we'll treat it as a genuine value and compare against it, producing a **false MISMATCH**. This is a direct loss against the official 50% end-to-end score.
- Fix: extend the placeholder regex (anything consisting only of punctuation/underscores is always blank, plus enumerate tbc/nil/none); update the extraction prompt's counter-examples and `docs/DECISION_SPEC.md` in sync; bump `PIPELINE_LOGIC_VERSION` in `lib/shared/versions.ts`; re-run the full evaluation. Effort: 1-2h.

### 4.2 Tier A: Low-Risk Enhancements Worth Doing Before Finals (<=4h each, doesn't touch `ui/`)

| ID | Name | What it fixes | Effect on scoring | Effort | Risk |
|---|---|---|---|---|---|
| A1 | Blank-token hardening | False-MISMATCH risk (see 4.1) | Preliminary validation / finals e2e | 1-2h | Very low |
| A2 | Multi-seed regression evaluation | Only seed-42 data has been verified so far; do a "finals dry run" ahead of time | Preliminary Feasibility / finals e2e and Robustness | 3-4h | Low (needs a Python environment; keep generated data outside the repo) |
| A3 | Harden the extraction fallback prompt | LLM fallback quality when rules miss a field (null semantics, verbatim-copy requirement) | Finals e2e / Robustness | 1-2h | Low (needs a cache-version bump) |
| A4 | KPI / STP straight-through-rate stats | Judges ask "what's the automation rate, how much manual work is saved" and we have no numbers | Product: Effectiveness / Impact (needs metrics) | 2-3h | Low (an interface change needs to be kept in sync with SHARED_INTERFACES) |
| A5 | Attach `decided_by` to exports | The official scoring script tallies and displays the rules share (`rule_pct`); our export is missing this field | Makes the "rules+AI hybrid" technology-integration story directly visible | 0.5-1h | Very low |
| A6 | Manual review write-back (minimal loop) | The official requirement is "flag uncertain cases for human review," but right now it can only be viewed, not confirmed/corrected/logged | Finals UX & Differentiation / Effectiveness | 3-4h | Medium (needs a new append-only table `review_actions`; needs operator sign-off) |

### 4.3 Tier B: Big Moves for the Finals Demo (high visual impact, risk must be controlled)

| ID | Name | Effort | Notes |
|---|---|---|---|
| B1 | Gmail read-only ingestion (manually triggered) | 6-10h | A genuine demonstration of pain point #1, "finding emails among 2000/day"; OAuth setup and privacy risk need to be rehearsed ahead of time, with pre-loaded fallback data in case it fails live |
| B2 | Scanned-document OCR (demo mode, off by default) | 4-6h | Advisory value/preview only — **must never override the unreadable verdict** (see 3.6) |
| B3 | Run auditing (`pipeline_runs` + review trail) | 3-4h | Evidence for finals Architecture & Scalability / Robustness |
| B4 | DCSA eBL 3.0 field-mapping export | 2-3h | Roadmap material; **must not be claimed as "already integrated"** |
| B5 | `.eml` / `.msg` parsing | 4-6h | A hedge in case finals hands us real Outlook samples (scenario B fallback) |
| B6 | Multi-language/port-alias normalization (UN/LOCODE) | 2-4h | A differentiation bonus; the official test set is mostly English, so don't let this crowd out the main flow |
| B7 | Local decision-model Laya integration (**interface only, see 4.3.1**) | Docs 0.5h / implementation 1.5-2 days | Evaluation conclusion: not implementing this now; the extension point is documented so that doing it later means "adding a file," not "changing the architecture" |

### 4.3.1 Local Decision Model Laya: Evaluation Conclusion and Reserved Interface

**Conclusion: not doing this now, only documenting where the interface would go.**

- The motivation of "run locally, save on API usage" doesn't hold up: the rules-first design means the 520-email sample batch only triggers about 50 LLM calls total (Jev is priced at $0.042/1M tokens, so the whole batch costs a few cents); classification rules already cover 520/520, so fallback calls are already extremely rare.
- It's a **non-generative decision model** (three scoring-question types — `choice`/`score`/`noul` — with a single forward pass of ~33ms and it never generates text), so **it can't do extraction** ("save on API locally" for field extraction is already covered by the LM Studio provider). Zero-shot performance on custom decisions is close to random (the official self-reported figure is 0.362 accuracy, vs. 0.318 for random and 0.461 for majority-class), so it would need fine-tuning on our own data plus temperature calibration to be trustworthy — currently the lowest-value option for the team's time.
- Fact sheet: Apache 2.0, three checkpoints (English 421M ctx512 / multilingual 322M ctx1024 / typed-decisions), `pip install laya`, runs on CPU; link in §7.
- **The closest comparison point is Jev**: `lib/llm/index.ts:27-40` already separates "text-generation providers" (`TEXT_PROVIDER_IDS`) from decision models, with a comment explicitly noting that Jev is "a structured decision model that never generates text." If Laya were ever integrated, it would follow the pattern of `lib/llm/jev.ts`:
  1. Add `lib/llm/laya.ts`: makes an HTTP call to a local Python service (`pip install laya` + a FastAPI wrapper exposing only choice/noul);
  2. Add a provider slot in `lib/llm/index.ts` (suggested id `laya`; unavailable on Vercel, with semantics like lmstudio's `cloudOnly`); `isProviderConfigured` checks whether `LAYA_BASE_URL` is configured plus `isLocalLLMAvailable()`, returning a readable 503 on Vercel;
  3. Add an `engine: "laya"` branch to `app/features/classification/logic/index.ts` (alongside the existing rules/jev/llm/degraded);
  4. Add a separate service to `docker-compose.yml` (under a profile that's disabled by default), leaving the main Docker image unaffected;
  5. Add a `LAYA_BASE_URL` comment entry to `.env.example`; doesn't touch `ui/` or the external contract of the existing 5 providers.
- **Why no placeholder stub is left in the code**: `AGENTS.md` forbids "pre-designing an interface for a hypothetical requirement that doesn't exist yet" and forbids adding dead code for speculative needs; the "reserved interface" lives in this document instead — the integration point, naming, and gating conditions are written down clearly, so implementing it later means "adding a file," not "changing the architecture."

### 4.4 Tier C: Explicitly Not Doing

- Adding tolerance to numeric fields (causes missed detections), enabling OCR by default in the official comparison, fine-tuning a model/vector store/RAG, splitting extraction into a Python microservice (unless B2/B5 actually ship), a full EDI/DCSA platform integration, multi-tenant OAuth polling, or using the generator's ground truth as a submission denominator or hardcoding answers keyed by email_id.

## 5. Suggested Execution Order

| When | What to do | Corresponding score items |
|---|---|---|
| 9/20-9/21 | **Submission materials come first** (video/slides/submitter, owned by teammate B); code work limited to A1 (mandatory) + A5 (<=3h combined) + A3 (optional) | All preliminary-round items |
| 9/22 morning | 2-3 hours before submission: smoke-test all three entry points on mobile + an incognito window; submit before 12:00 | Preliminary-round material completeness |
| 9/23-9/25 | A2 multi-seed regression -> fix whatever it exposes -> A6+B3 human review loop and auditing -> A4 KPI; freeze core logic on the evening of 9/25 and only prepare the demo after that | Finals 25+15+15+10 |
| 9/26 | Finals pitch (10 minutes + 5-minute Q&A); slides map evidence to each of the rubric's seven items | All finals items |

## 6. Pending Operator Confirmation

1. Is installing Python dependencies (`openpyxl` / `python-docx` / `reportlab` / `Pillow`) allowed on this machine, to run the official generator? (prerequisite for A2)
2. Is creating a new `review_actions` table in Supabase allowed (append-only, with `updated_at`)? (prerequisite for A6/B3)
3. What exact form will finals testing take (opening our Web/MCP live, or judges running the data themselves)? (determines whether A2 needs to cover the REST entry point, and B5's priority)

## 7. Evidence Index

- Preliminary-round scoring rubric (official Google Doc): https://docs.google.com/document/d/1EiI_mqJYeMN0D-dtZ_npCavVGXVcePFmcZ7O4d4ygQI/edit
- Finals scoring rubric (official Google Doc; Technology Integration marked provisional): https://docs.google.com/document/d/1S-bLf45JOabMl1QUDgl4F6NTwuwD7UKbhPKh74sqaRo/edit
- Schedule (Participant Infopack): preliminary round closes 9/22 12:00pm; top-10 selection 9/23 12:00pm; announced 9/24; **finals pitch 9/26** (Monash University Malaysia)
- Inside the official problem package: `data_v2/generate.py` (`--seed`), `data_v2/README.md` ("Change the seed for a fresh draw"), `server/scoring.py` (the 50/30/20 weighting and reliability diagnostic), `edgecases.py` (`BLANK_TOKENS`), `shipment.py` (defect injection), `pools.py` (label/entity pools)
- Laya model evaluation source: https://huggingface.co/convaiinnovations/laya (sub-checkpoints: `laya-multilingual` / `laya-typed-decisions`)
- Corresponding implementation in this repo: `app/features/extraction/logic/label-parser.ts:47`, `app/features/extraction/logic/index.ts:118`, `lib/shared/pipeline.ts`, `scripts/evaluate.ts:32-40`, `app/features/results/logic/stats.ts`, `app/features/results/logic/export/json.ts`, `app/features/mail/logic/gmail.ts` (placeholder)

## 8. Operator Decisions and Backend Progress (2026-09-21)

- **Shelved items (moved to the backend plan list, to be scheduled after the preliminary submission)**:
  - A6 manual review write-back (corresponds to plain-language item P1-8): deferred until after the preliminary submission.
  - Perturbation testing + risk document (corresponds to plain-language item P1-10): deferred until after the preliminary submission.
- **Delivered this round (backend; see DECISION_LOG decisions 25-29 and UI_GUIDE.md part 2 §7 for details)**:
  - P0-2 / P1-5 / P1-9: the classification and comparison failure fallback chains (staged fallback) + the `degraded` flag + one-click `retry_failed`
  - P0-3: attachment-pairing content fallback (keyword rules -> LLM only when rules can't decide)
  - P0-4: export format validation (`X-Export-Invalid` / `X-Export-Invalid-Ids`)
  - P1-6: numeric conflict search (`numeric_mode` / `tolerance` / `value_field` / `value`, query-only effect)
  - P1-7: field-level provenance persisted (`evidence_si` / `evidence_bl`, `scripts/phase3-evidence-migration.sql`)
- **Verification**: typecheck passes; MCP annotation self-check passes for all 11 tools; the full evaluation is a perfect 520/520 match (defect TP=72 / FP=0 / FN=0, review reasons 20/20); the Supabase migration has been applied and the view columns verified.
