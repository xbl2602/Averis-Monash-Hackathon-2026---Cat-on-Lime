# Data Flow Plan

> How data flows is designed up front — it's not "run a wire wherever's convenient."
> This document defines "where data comes from, what it passes through, and where it ends up" as a hard rule, on the same level as [CLAUDE.md](../CLAUDE.md) —
> read this file before writing code, to confirm your change doesn't break the pipeline.

## Core Principle

**Data flow must be a one-directional, traceable "pipe" — not a mesh structure where anything can call anything else.**

Think of it like a water pipe: water passes through a series of treatment stages from the source and ends up at the tap, with every junction clearly located, so if something breaks you can trace along the pipe to find which segment failed. It must never be "tap a new pipe in wherever's convenient" — that way lies an ever-messier tangle of pipes where one leak takes down the whole network and nobody can say how the water actually got there.

## Overall Data Flow (from a single email to the final submission result)

```
Official sample data (data/sample/, may later be replaced by an official API)
        │
        ▼
[classification module] determines the email type -> category
        │
        │  Only continues downstream if category === "BL_COMPARISON"
        │  (other types end here; no extraction/comparison needed)
        ▼
[extraction module] extracts fields separately for the SI attachment and the BL attachment
        │  (two calls, one for the SI text and one for the BL text, independent of each other)
        ▼
[comparison module] compares the two field sets -> status / defect_fields / has_defect / review_reason
        │
        ▼
Assembled into one EmailVerificationResult (one result per email)
        │
        ▼
Aggregated into the big { email_id: EmailVerificationResult, ... } file
        │
        ▼
Handed to the official scoring system (docker /submit or score_cli.py)
```

This pipeline's **direction is fixed**: classify -> extract -> compare -> assemble. There are no reverse arrows, and no such thing as "the comparison module reaching back to change the classification result."

## Data Flow Rules (prohibited actions — preventing a "mesh-like tangle")

1. **Modules must not directly call each other's `logic`.** `classification`'s code cannot import functions internal to `extraction`, and vice versa. The three modules only interact through "data," never through "calling each other's code directly" — one module's output is the next module's input, and the "orchestration layer" (see below) is responsible for passing it along; a module never reaches out to grab data from another module itself.
2. **The UI must not take shortcuts.** Components on the web page (`ui/`) may only call their own module's `api/` — the web page code must never directly import an LLM SDK, query the database directly, or call into another module directly.
3. **Data passed between modules must use only the types defined in `lib/shared/types.ts`** — you can't invent a new field name on the fly inside some module and then just tell a teammate verbally "remember to use this format." A verbal agreement is exactly the kind of "wire it up wherever's convenient" this document warns against — the code must actually import that type, not have each module copy its own version.
4. **The "canonical answer" for any given thing is defined in exactly one place.** For example, "which 7 fields to compare" appears exactly once, in `COMPARED_FIELDS` in `lib/shared/types.ts`; everywhere else just references it — no module should write its own copy of the field-name list. Write it twice, and eventually someone updates one copy and forgets the other, the two drift apart, and you get a bug that's a nightmare to track down.

## Orchestration Layer (pipeline): already in place

`lib/shared/pipeline.ts` is the **only** place that knows the order "classify first, then extract, then compare":

- `runEmailPipeline`: runs a single email -> assembles an `EmailVerificationResult`, and handles the 4 kinds of "uncertain" verdicts (missing attachment / wrong type / unreadable / missing field)
- `runBatchPipeline`: batch processing, using `mapWithConcurrencyLimit` to bound concurrency; a single email's failure is recorded individually and doesn't take down the whole batch
- `computeInputHash` + `PIPELINE_LOGIC_VERSION`: the basis for incremental skipping at the results layer (skip recomputation if the content and engine version are both unchanged)

The web page, REST API, and MCP should all call into this layer whenever they need to "run one email / a whole batch" — don't re-assemble the ordering logic elsewhere.
The engine runs in a hybrid mode (rules first, only calling a model when uncertain/conflicting); every model call goes through the content-fingerprint cache in `lib/shared/llm-cache.ts`. A full local evaluation run uses `npm run evaluate` (self-testing against ground_truth, which the organizers have clarified is allowed).
A failure at the model stage is handled by "graceful step-down degradation" (2026-09-21, decision 25): classification = rules -> Jev -> text-provider chain -> best-effort rules (`degraded`); comparison = normalized exact match + Jev review, falling back to a conservative verdict if Jev fails (`rules-degraded`); `retry_failed` can recompute these emails with one click.
Field-level provenance (the line number + original sentence a rule matched) flows to the results layer alongside the extraction result (`evidence_si` / `evidence_bl`, decision 29); fields produced by the LLM fallback are tagged with only their source, with no line number.

## Result Queries (results module): a read-only branch

`app/features/results/` is this pipeline's **read-only exit**, and takes no part in production: it queries results by
category/status/processing state, sorts and groups, computes stats, lists conflicting file pairs, and exports
(json/md/txt/official submission format). Its relationship to the web page, REST, and MCP:

```
verification_results (results layer)
        │  read-only (via the verification_overview view)
        ▼
[results module logic] ── same implementation ──┬── REST /features/results/api/*
                                                  └── MCP tools (list_results / get_stats / list_conflicts / export_results)
```

Rule: the results module is **read-only** and writes to no table; other modules should not query `verification_overview`
themselves either, or reassemble the same query — go through results' logic to get data (see SHARED_INTERFACES.md for the interface format).

**Exception (P1-1 manual review loop, 2026-09-21)**: a `scope=submission` export additionally reads `review_overrides`
(via `applyOverridesToSubmission` in `lib/shared/review/merge.ts` — not the results module composing its own query,
but a call into a function provided by the shared `lib/shared/review/` area), layering the human review conclusions
on top of the system's results before output. This is the one and only place that "reads another table beyond the
result query," because it's part of the export path itself and doesn't count as breaking the "results is read-only"
boundary — writes to the `review_overrides`/`review_actions` tables are entirely owned by `lib/shared/review/`,
and each of the four feature modules' (classification/extraction/comparison/pipeline) own `api/review/*` is just a thin forwarding layer.

## Judge-Supplied Document Testing (sandbox module): entirely outside this pipeline

`app/features/sandbox/` is the only module that **touches no Supabase table at all** — it takes uploaded SI/BL file
content, calls straight into classification/extraction/comparison's own `logic/` (an orchestration layer just like
`pipeline.ts`, except the input comes from the request body instead of `data/sample/`), and returns the computed
result directly without writing to `verification_results` or `raw_emails`/`parsed_attachments`. This is intentional:
the point of this module is "test it once, leave no trace" — it should never pollute the official results table or
be counted in stats/exports.

## ⚠️ Developer Mode (devmode): the only place allowed to bypass every "who can write" rule below

`app/features/devmode/` is not part of this pipeline; it's an operational tool for the team/judges to use during
verification — it can directly wipe/rebuild **every** table listed below, bypassing the usual boundaries of "only
the import script/evaluation script/review store can write." This is a deliberate exception, not a design flaw: see
decision 34 in [`DECISION_LOG.md`](DECISION_LOG.md) and the "Developer Mode" section of
[`SHARED_INTERFACES.md`](SHARED_INTERFACES.md). Constraints: it registers no MCP tool; write operations require two
gates — an `x-admin-token` plus a confirmation phrase in the request body that must match verbatim; and it never
touches the three connection-config tables `app_config`/`mail_accounts`/`supabase_projects`.

## Data "Read/Write" Boundaries

| Data | Who can read | Who can write |
|---|---|---|
| `data/sample/` (official sample emails) | All modules | No code should ever modify it — this is the raw data provided by the organizers; changing it breaks the match against ground truth |
| `lib/shared/types.ts` (field/format definitions) | All modules | Must be confirmed with the operator before any change — this is "shared territory," and a mistake here affects all three modules |
| Supabase (`raw_emails` raw layer / `parsed_attachments` text layer / `verification_results` results layer / the read-only `verification_overview` view, plus the internal `llm_call_cache`) | The first three tables and the view are open for reads to all modules, the UI, and previews (RLS public read-only); result queries all go through the `verification_overview` view (implemented by the results module) — don't each compose your own two-table query; `llm_call_cache` is readable/writable only by the server | `raw_emails` and `parsed_attachments` are written incrementally only by the local import script `npm run import:data` (skips unchanged content by fingerprint; upsert conflict keys `email_id` / `email_id,file_path`); `verification_results` is written by the local evaluation run `npm run evaluate`, upserted by `email_id` (a single email's failure is marked `processing_status='failed'`). Don't scatter writes to these tables elsewhere in the code; see SHARED_INTERFACES.md "Database storage layer" for the table structure and fingerprint rules. **Sole exception: `app/features/devmode/` can delete/reimport whole tables (see the previous section)** |
| Supabase (`review_overrides` human overrides / `review_actions` audit log, P1-1) | Open for reads to all modules and the UI (RLS public read-only) | Written only by `lib/shared/review/store.ts` (all four modules' `api/review/*` call this single implementation rather than each composing their own SQL); `review_overrides` is upserted by `(target_kind,email_id)`, `review_actions` is insert-only (append-only); see `scripts/review-schema.sql` for the DDL. **Sole exception: `app/features/devmode/` can clear whole tables (see the previous section)** |
| Environment variables | Used only to configure "how to connect to external services" (LLM keys, Supabase address) | Never stuff business data (email content, comparison results) into environment variables — that's config, not data |

## Why Be This Strict

With 3 team members developing in parallel, each with their own AI, if data flowed "wherever's convenient," it wouldn't take long before: someone changes classification's output format, and extraction quietly breaks without anyone noticing — but because the two sides are "calling each other directly / relying on a verbal agreement" instead of "going through a shared type definition," there's no way to tell which link in the chain is actually broken when you go looking. This is exactly the real-world consequence of the "mesh" chaos described at the top of this document. The benefit of a pipeline design is that when something breaks, you follow the fixed path "classify -> extract -> compare" and always know exactly which stage to check.
