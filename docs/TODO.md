# TODO (To-Do List)

> Source: a 2026-09-21 audit cross-referencing "problem-statement requirements x competitor research x current code" (read-only review, no code changed).
> Usage: pick up one item at a time; **once done, change `[ ]` to `[x]` and add an "Evidence:" line below it — don't just flip the status**.
> Priority: P0 = affects "can we submit/can it run at all"; P1 = a clear scoring bonus; P2 = do if there's time to spare.
> Every task carries its own "evidence (current state)" and "acceptance criteria," so a new AI picking this up can start working without reading the whole repo first.

---

## P0 — Solve "can it run / can we submit" first

### [x] P0-1 Add the core three tables' DDL to the repo (otherwise it won't run in a new environment)
- **What was done**: added `scripts/core-schema.sql` — the real structure exported via Supabase `list_tables` introspection of the production project (`rapuvaalzlrsjodjwqtw`) (not guessed from code), containing the complete DDL (columns/defaults/check constraints/foreign keys/comments) for the four tables `raw_emails` / `parsed_attachments` / `verification_results` / `llm_call_cache`, plus the `verification_overview` view (`security_invoker=true`) and the anon select policies for the three business tables (`llm_call_cache` deliberately has no anon policy and is service-role only, matching the live `pg_policies` query result). Everything is `create table if not exists` / `create or replace view`, so it's idempotent.
- **Kept in sync**: the README's "Database initialization" section now says to run `core-schema.sql` first, then `phase2-schema.sql` + `phase2-rls.sql`.
- **Acceptance still pending**: this hasn't actually been run against a brand-new Supabase project yet (local development uses the existing production project, so there's no "brand-new project" to test against); keep an eye out for whether tweaks are needed whenever a Supabase project is actually switched/created.
- **Note**: the DDL contains no answer/ground_truth content of any kind.

### [x] P0-2 Fix the README's wording about ground_truth
- **What was done**: the README sentence now reads "ground_truth is for local self-testing only: the organizers have explicitly confirmed that the problem package (including `ground_truth.json`) is allowed for participants to use, with the sole constraint that it's for self-testing only and must never go into the final submission file (see `AGENTS.md`/`CLAUDE.md` 'Review Notes' item 5)" — this removes the ambiguity-prone "Discord has clarified" phrasing and instead points directly to the authoritative source already documented in the repo.

---

## P1 — Clear scoring bonuses (matching top competitors' approaches)

### [x] P1-1 Manual review loop — backend (REST+MCP) is done, GUI left for teammate A
- **What was done**: rather than a "minimal version," this fully wired up REST (`api/review/{route,history,undo,bulk}`) + MCP (4 tools x 4 modules = 16) across all four modules (classification/extraction/comparison/pipeline) per `docs/REVIEW_SPEC.md`, with the shared layer in `lib/shared/review/` (`store`/`actions`/`normalize`/`merge`/`rerun`/`http`/`mcp`/`types`, 8 files); the two tables in `scripts/review-schema.sql` have been created and applied to the production Supabase project; the results export now calls `applyOverridesToSubmission` (`X-Review-Pending`/`X-Review-Deferred` response headers). **No GUI was built** (as required).
- **Three deviations** (full reasoning in `docs/REVIEW_SPEC.md` section 15 / `DECISION_LOG.md` decision 31): (1) no httpOnly cookie session was built — since there's no GUI, REST/MCP stick with the existing `x-admin-token` approach, to be revisited once the GUI is built; (2) the classification review queue currently only covers "the model chain fully failed and degraded," not "Jev confidence < 0.85 but didn't fail" (this signal currently isn't persisted into `verification_results`, which would need a separate schema change requiring operator sign-off, not included in this round); (3) MCP has no standalone bulk tool (bulk only goes through REST, which matches REVIEW_SPEC §8's original scope, so this isn't really a deviation).
- **A real bug found and fixed during testing**: `listOverrides` used to pass several hundred email_ids through PostgREST's `.in()`, which got rejected with a 400 (URL too long); switching to fetching the whole table by `target_kind` and filtering in memory made the problem go away.
- **Acceptance**: locally on `next dev`, confirm/correct/undo/bulk (including failure isolation) / optimistic-lock 409 / consistency-check 400 / the export's overlay headers changing with the action were all tested against the comparison module and all passed; test data has been cleared and nothing is left in the database; `npm run typecheck`, `npm run build`, and `npm run test:mcp-annotations` (allowlist updated) all pass.
- **Note**: nothing anywhere reads/references `ground_truth`.

### [x] P1-2 Change AI failures to "automatically retry once" instead of only offering a manual one-click retry
- **What was done**: `callLLM` in `lib/llm/index.ts` now automatically retries once within the same provider (waiting 2 seconds) for timeouts/rate limits/upstream 5xx/network errors (`isRetryableUpstreamError`); errors where retrying is pointless (401/403/400/422) are never retried and fail immediately. This retry layer happens only inside a single provider and **does not affect or replace** the existing cross-provider fallback chain in `lib/shared/llm-chain.ts` — within a single classify/extract/compare call, it retries once in the current provider first, and only moves to the fallback chain's next provider if that still fails, with `degraded` as the final fallback. `callJev` still doesn't retry (a failure goes straight to the upper-level fallback path as before, unchanged).
- **Docs kept in sync**: the old "no retry" wording in `docs/DECISION_SPEC.md` §1.5, `lib/llm/errors.ts`, and `lib/llm/jev.ts` has been updated; `DECISION_LOG.md` gained decision 30 recording this change.
- **Acceptance**: `npm run typecheck` passes; retries are only logged via console.warn and don't change the external error contract (still just the two types, LLMConfigError / UpstreamServiceError).

### [ ] P1-3 Write a risk document (perturbation results + known weaknesses + anti-filename-dependency hardening)
- **Current state/evidence**: perturbation testing is already built: `scripts/perturb-generate.mjs` / `perturb-run.ts` / `perturb-score.ts`; the most recent results are in `private/perturb-runs/2026-09-20T13-59-45-official/summary.md` (overall accuracy 1.000, defect F1 0.986, end-to-end 287/294=0.976, review recall 0.911). **But the risk document doesn't exist yet** (`private/` currently only has the two competitor-research files).
- **Approach**: write `risk-notes.md` in `private/` (never committed, never public): (1) conclusions from each perturbation group plus **known weaknesses** (pt7/pt13 have field F1=0.600 — document why and the scope of impact); (2) how much attachment-type detection depends on filenames, and the "look at content" fallback already added (`lib/shared/document-identify.ts`); (3) the no-OCR policy and its impact (scanned documents -> `unreadable`, see `docs/FINALS_ROADMAP.md:44,80`); (4) a limitations statement that "a perfect score on the 520 emails != performance on unseen data."
- **Acceptance**: the document can answer "given a new batch of unseen emails, where are we most likely to get things wrong, and how would we notice."

### [x] P1-4 Weight/quantity tolerance: already implemented (missed during the audit, not new work)
- **Evidence**: `docs/DECISION_LOG.md` decision 28 + `app/features/results/logic/numeric-query.ts` — the conflicts query already supports `numeric_mode=exact|fuzzy`, `tolerance`, and searching by value via `value_field`/`value`, letting the user choose exact or fuzzy; the default tolerance is weight `max(0.5kg, 0.1%)`, container count 0. REST + MCP take the same parameters, and the conflicts export supports this too.
- **Scope**: this tolerance is used **only for conflict queries/filtering** and never enters the final `scope=submission` verdict — the official generator's differences are large in magnitude, so adding tolerance to the submission path would cause missed detections, hence the submission verdict stays an exact comparison (`comparison/logic/index.ts` unchanged). This was already decision 28's established scope, not a new decision.
- **Conclusion**: this TODO item was an oversight from the 2026-09-21 audit (decision 28 and the existing code were missed) and doesn't actually need any further work.

### [ ] P1-5 Multi-LLM cloud acceptance (DeepSeek to be retested after the next deploy; Claude/OpenAI still missing keys)
- **Current state/evidence (re-checked 2026-09-21)**: `DEEPSEEK_API_KEY` has already been added to Vercel (`filter_project_envs` confirms the variable exists), but it was added (`updatedAt=1789952512687`) after the latest live deployment at the time (`d071ae9`, `created=1789914468786`) — a Vercel environment-variable change only takes effect for already-running functions after the next deploy. Testing `POST https://hackathonaveris.vercel.app/features/classification/api {"provider":"deepseek"}` currently still returns "missing environment variable," which is consistent with this explanation (it's not that the key wasn't set, it's that there hasn't been a redeploy since).
- **Approach**: pushing this round's changes will automatically trigger a new deployment; re-run the curl command above afterward to confirm DeepSeek is fully working; `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` still need the team to obtain their own keys and add them to Vercel.
- **Acceptance**: after the new deployment, a DeepSeek classification request returns a normal result (no more missing-key error); until Claude/OpenAI are filled in, the README honestly marks them "not configured."

---

## P2 — Do if there's time to spare

### [ ] P2-1 Release fingerprinting ("the paper we hand in matches the paper that was graded")
- **Current state/evidence**: only `logic_version` / `input_hash` are persisted (`lib/shared/versions.ts`, `lib/shared/verification-store.ts`) — there's no script that produces "a manifest of the source files used for scoring + fingerprints + a one-click verification."
- **Approach**: add a script that hashes the source code and scripts on the scoring/submission path into a manifest file, plus a `verify` command to compare against it. **The manifest file must not contain any answer content.**
- **Acceptance**: `verify` is all-green when no code has changed, and reports exactly which file changed if even one line is edited.

### [ ] P2-2 Document the "no OCR" policy in the public README/submission materials
- **Current state/evidence**: the policy is already documented internally in `docs/FINALS_ROADMAP.md:44,80` (scanned/no-text-layer documents -> `NEEDS_REVIEW`), but it's absent from the README and submission materials, so it's easy to mistake for "something that was missed."
- **Approach**: add 2-3 sentences to the README's "Capability boundaries" section: why OCR isn't done, how scanned documents are handled, and the effect on the accuracy axis.

### [ ] P2-3 Surface classification's "needs human review" in the UI (frontend, teammate A)
- **Current state/evidence**: the backend already returns `needs_review`; competitor research section 7 specifically calls out "computing it but not displaying it" as a hidden pitfall (`private/competitor-research-plain.md` lines 132, 155).
- **Approach**: explicitly display `needs_review` and `review_reason` in the result list/detail view, with filtering support.

### [ ] P2-4 Fix a nav link pointing to a page that doesn't exist (frontend, teammate A)
- **Current state/evidence**: both the competitor research and `docs/UI_GUIDE.md` mention a nav link pointing to a page that doesn't exist yet (`/features/verification`; `docs/HISTORY.md:407` recorded a 404 for it). The `app/features/verification/ui` file exists, so it needs to be confirmed whether the route and the nav are actually wired together.
- **Acceptance**: every link in the navigation returns 200 when clicked.

### [ ] P2-5 Add minimal lint + CI
- **Current state/evidence**: there's `npm run typecheck` (`package.json:13`, `tsconfig.json` strict), but **no ESLint and no `.github/workflows`** — verification relies on manually running scripts.
- **Approach**: add ESLint (Next's official config) + a CI job that runs `typecheck` (plus optionally `test:mcp-annotations`, `test:crypto`). Don't bring in a heavyweight framework.

### [x] P2-6 Sync up 6 known inconsistencies in the docs
- **What was done**: `docs/PHASE2_SPEC.md` removed the nonexistent `documents/export` endpoint, added `lmstudio` to the `test` endpoint's target list, added `supabase-projects/deactivate` to `§4.2`, added the `detected_type` query parameter to the import list endpoint, and added a clarifying sentence to `§1` that "the passphrase rule only governs config/mail/import's own endpoints, not every POST in the whole project." `docs/SHARED_INTERFACES.md` gained a table for the three classification/extraction/comparison REST endpoints and their corresponding 3 MCP tool names. Section 6 of `docs/UI_GUIDE.md` had its duplicated content cleared out and now just points back to these two files.

### [x] Verification: ease of judge install/deploy + a new sandbox module (judge-supplied test set, single-item version)
- **What was done**: (1) actually tested (not guessed from the docs) both the local zero-config `npm run dev` path and the Docker `docker compose up --build` path, confirming that the homepage / full-pipeline preview page / `dry_run` batch preview all work with no Supabase/LLM key configured at all (the rules engine takes priority + sample data is read from local files, no database dependency); the README gained a "see it running in 30 seconds as a judge/newcomer" section spelling this path out, and notes that the Supabase anon key itself isn't sensitive and can just be requested ready-made from the operator, with no need for judges to register their own account. (2) found a real architectural gap: the classification/extraction single-document endpoints only work against the repo's own bundled sample data, so judges bringing their own new emails/SI/BL files had no way to test them — added `app/features/sandbox/` (`POST /features/sandbox/api` + the MCP tool `run_adhoc_test`) to fill this gap; it writes nothing to the database, needs no Supabase configuration, and reuses the exact same extraction/comparison engine as production. Also extracted the `import` module's file-validation logic into `lib/shared/file-validate.ts` so both sides can share it.
- **Decision record**: `DECISION_LOG.md` decision 32.
- **Acceptance**: fed real sample files (email_004 SI/BL, known to have a discrepancy) into the sandbox endpoint as "the judge's own documents," and the result exactly matched the official pipeline; error paths (bad extension/bad base64/over the limit/missing file) all return readable errors. `npm run typecheck`, `npm run build`, and `npm run test:mcp-annotations` all pass.
- **Not done yet**: a batch test-set version (upload a whole batch of emails + attachments at once and run the lot) — the operator explicitly said "we want both, do the single-item version first"; whether the batch version gets built depends on time available; the sandbox's GUI page (`docs/UI_GUIDE.md` §2.8 already has handoff notes written up, belongs to teammate A).

---

## Completed (don't redo these)

- [x] Official scoring run, archived: `private/eval-runs/20260920-1757/official-score.json` (final 1.0; classification 1.0, defect F1 1.0, end-to-end 46/46, reliability 20/20; cross-checked with `score_cli.py`, same score)
- [x] AI failures fall back to rules (`lib/shared/llm-chain.ts` + `rules.ts` best-effort)
- [x] Content-based attachment-type detection fallback (`lib/shared/document-identify.ts`)
- [x] Pre-submission format/coverage check (`app/features/results/logic/export/index.ts:108,155-158`)
- [x] Tiered text comparison (canonical -> exact -> only the middle ground goes to Jev)
- [x] Field-level provenance persisted (`label-parser.ts:88-115` + `scripts/phase3-evidence-migration.sql`)
- [x] Perturbation-test harness and its most recent score
- [x] MCP annotations fail-closed + a self-check script (`scripts/check-mcp-annotations.ts`)
- [x] All three deployment files in place (`Dockerfile` / `docker-compose.yml` / `next.config.mjs` standalone)
- [x] `docs/REVIEW_SPEC.md` has been registered in `docs/README.md`
- [x] Export gained `format=csv` (in response to the "SI/BL values + why it's a mismatch" table the business side explicitly asked for at the 2026-09-21 workshop; see `docs/HISTORY.md` Workshop 2, `docs/DECISION_LOG.md` decision 33). `scope=conflicts` is an amendment list, one row per field to fix; `submission` still only accepts json. README/UI_GUIDE have been kept in sync
- [x] Developer-mode backend (database wipe/restore, for internal/judge verification use only; see `docs/DECISION_LOG.md` decision 34): three endpoints under `app/features/devmode/` (status query/wipe/restore), gated by two factors (a passphrase + a confirmation phrase matched verbatim), deliberately not registered as an MCP tool. **The GUI still isn't built** — `docs/UI_GUIDE.md` §2.9 documents the hard requirements (a persistently visible warning banner, typed confirmation rather than a one-click popup), handed off to teammate A, lower priority than the manual-review GUI
