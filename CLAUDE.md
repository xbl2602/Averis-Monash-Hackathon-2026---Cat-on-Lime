# Project AI Collaboration Guidelines

> **[Mandatory] CLAUDE.md ⇄ AGENTS.md two-file sync rule**
> This file is `CLAUDE.md` (read by the Claude Code / Claude family); it has a copy whose **content must be word-for-word identical**: `AGENTS.md` (read by the Codex / AGENTS family).
> - Whenever any AI changes this file, it **must write the exact same change to the other file** in the same commit; it is not allowed to finish after changing only one.
> - Before changing anything, read the other file first to confirm there's no unsynced drift; after changing, compare them line by line to make sure the two files match (only this top sync note itself may have its wording adjusted as needed — the rest of the body must be completely identical).
> - The two files may only state "which one am I" inside this sync-note block — nowhere else may their content differ.
> - Why: the team uses both the Claude workflow and the Codex/AGENTS workflow at the same time; if the two specs ever drift apart, different AIs would read contradictory rules and coordination breaks down completely.

This file is automatically read by each of the team's 3 members' own Claude Code (or any other AI coding tool that follows the CLAUDE.md convention). It is a **binding execution spec**, not background reading — every rule below must actually be followed while writing code, not just "kept in mind". The human-facing division-of-labor/timeline handbook is [TEAM_HANDBOOK.md](docs/TEAM_HANDBOOK.md); the opening-ceremony problem statement details are in [OPENING_CEREMONY_NOTES.md](docs/OPENING_CEREMONY_NOTES.md); the record of "why these rules were set this way at the time" is in [DECISION_LOG.md](docs/DECISION_LOG.md); the options/decision criteria/model-input contract for each judgment point are in [DECISION_SPEC.md](docs/DECISION_SPEC.md); the hard rules for how data should flow between modules are in [DATA_FLOW.md](docs/DATA_FLOW.md) (under docs/ — read it before writing code too).

Background: none of the team's 3 members has a programming background. The problem statement was published on 2026-09-18, and submission closes 2026-09-22 12:00pm.

## Project Status

- **Problem statement (confirmed)**: Shipping Documents Verification. The system must: ① classify emails (SI/BL confirmation/invoice inquiry/spam) ② extract fields from the body/attachments (shipper, consignee, notify party, port of loading, port of discharge, container count, weight) ③ compare BL against SI and flag discrepancies ④ flag for human review whenever it's uncertain. Full background in docs/OPENING_CEREMONY_NOTES.md.
- **Tech-stack foundation (confirmed, not just a default suggestion)**: Next.js (App Router) + Tailwind + **Supabase** + **Vercel deployment** — see docs/TEAM_HANDBOOK.md §4. This is the foundation for "business functionality" only; it is not the same as the "product-form requirements" and "multi-LLM support" sections below — those are additional hard requirements the team set, see below.
- **Feature breakdown**: three features — `classification` / `extraction` / `comparison`. See "feature module owners" at the end of this file for who owns each.
- **The official Vercel project is `hackathonaveris`, not `hackathon-demo`**: the account briefly had two Vercel projects at once — `hackathon-demo` (created first, never connected to GitHub, doesn't auto-update, now retired — ignore it) and `hackathonaveris` (correctly connected to the `main` branch of the GitHub repo `xbl2602/Hackathon`; `git push` automatically triggers a redeploy). **Treat `hackathonaveris` as authoritative.** Live demo URL: `https://hackathonaveris.vercel.app`; SSO protection is off by default, so it opens directly without logging in.
- **A real Supabase project already exists (no need to sign up again)**: the project URL and anon public key (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are already written into both the local `.env.local` (not committed to git) and `hackathonaveris`'s Vercel environment variables. **Live verification (2026-09-20)**: cloud MCP handshake, results query/export, Jev classification, and Gemini classification have all been tested working. **2026-09-21 update**: `DEEPSEEK_API_KEY` has been added to Vercel, but it was added after the most recent live deployment at the time — a Vercel environment-variable change only takes effect for already-running functions after the next deploy, so this hasn't been verified yet (needs to be re-tested after the next `git push` triggers a deploy). `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are still not filled in (selecting either of these providers in the cloud will return a readable "missing key" error) — these are private keys the team needs to apply for themselves, then fill in manually under the Vercel dashboard's Settings → Environment Variables; I won't apply for these private keys on your behalf or see them; `SUPABASE_SERVICE_ROLE_KEY` is also needed for live batch result writes (already configured and tested — `run_batch` successfully writes to the database; it's also used for local import/evaluation).

## Product-Form Requirements (hard requirement, must be done before the qualifying-round deadline)

This system can't just be a web form. The team has explicitly required: **the same set of core capabilities must be usable through three different interfaces**, and all three must be built and reachable/testable before the qualifying-round submission — not left to be added later in the finals:

1. **Web UI** — the human-facing interface for the shipping operations team, responsively designed, **must work properly on both mobile and desktop browsers** (use Tailwind breakpoints; no need to build a native app/PWA — keep the cost at the level of "a responsive website")
2. **REST API** — wrap classification/extraction/comparison as HTTP endpoints, for other programs to call
3. **MCP Server** — wrap the same capabilities as MCP tools, for AI agents (e.g. Claude Desktop, other MCP clients) to call

**Key implementation principle: don't write the same logic three times just to expose three interfaces.** Structure each feature module internally with the layers below:

```
/app/features/<feature-name>/
  logic/        <- Pure business-logic functions: inputs/outputs are explicit and don't depend directly on runtime details like HTTP/Next.js/MCP, so they're easy to reuse from the three layers below and easy to test later
  api/          <- A very thin layer: parses the HTTP request into parameters, calls the functions in logic/, and wraps the result as an HTTP response
  mcp/          <- A very thin layer: defines what this module exposes as an MCP tool (tool name, parameter schema, description), and calls the functions in logic/
  ui/           <- Web components (if this module needs a UI)
```

Set up a place under `/app/core` (e.g. `/app/core/mcp-server`) that aggregates every feature's `mcp/` exports, registering and starting a single MCP server process — this file should only do "aggregation and registration"; it should not contain any module's actual business logic.

**MCP Server transport: use HTTP/SSE (streamable HTTP), not stdio.** MCP has two common connection modes: stdio (a local process the AI client starts on its own machine) and HTTP/SSE (a remotely reachable network address). This project requires the MCP capability to be served from Vercel just like the Web UI and REST API, so it must use HTTP/SSE — that way, a single deployed app can serve the web page, the API, and MCP from one address, with no need to run a separate local process.

## Deployment Requirements (must run in all three of local / cloud / Docker)

**This is not "switch to a different host instead of Vercel" — it's that the same codebase must support three ways of starting it up:**

1. **Cloud (Vercel)** — the official demo URL shown publicly for the qualifying round/finals; `git push` auto-deploys; this stays the primary path, unchanged
2. **Local deployment** — on any machine with Node.js installed: `npm install` for dependencies, then `npm run dev` (dev mode) or `npm run build && npm start` (production mode) to run it directly, no extra configuration needed
3. **Docker deployment** — write a `Dockerfile` (paired with `output: 'standalone'` in `next.config.js`, producing a small build with dependencies already bundled), so any machine with Docker can `docker build` + `docker run` it, without installing Node.js or configuring an environment separately. A `docker-compose.yml` can also be added for one-command startup (this becomes more clearly useful once other services, like a local database, are added later)

**To achieve "one codebase, three ways to run it", keep this in mind while coding:**

- **All keys/config go through environment variables** (Supabase keys, each LLM's API key); list every needed variable and what it's for in `.env.example`, and never hardcode a key in the code — this way the three deployment modes only differ in "where the environment variables are read from," while the code logic stays exactly the same
- **Don't use Vercel-exclusive features that stop working outside Vercel** (e.g. Vercel-specific Edge Runtime-only APIs, Vercel KV, etc.) — use only standard Next.js APIs + the official Supabase SDK, so the code is portable by construction and doesn't need a separate rework just to "support local/Docker"
- **The README must clearly document the steps for each of the three ways to run it**, including how to configure environment variables, what the Docker commands are, and "our live demo is at this address"

## Multi-LLM Support (hard requirement, must work in the qualifying round)

The system must be able to switch between multiple LLMs; **at minimum, these must work in the qualifying-round stage**: Claude (Anthropic), OpenAI ChatGPT, DeepSeek, Google Gemini, local LM Studio.

**The "local LM Studio" option only works in "local deployment mode" — the public demo on Vercel can't use it.** Why: what LM Studio/Ollama call "local" means the `localhost` of the machine running this website's server. Once the project is deployed to Vercel, the server becomes a machine in Vercel's cloud, which has no way to reach the LM Studio running on the operator's own computer (the network doesn't connect, and Vercel has no GPU/local-model-inference service anyway — it only runs lightweight application code). So:
- **When deployed locally / via Docker**: the website and LM Studio are on the same machine, `localhost` connects fine, and this provider works normally
- **On the public Vercel demo**: the local LM Studio option in the provider dropdown **is disabled by default in the cloud environment** (either auto-hide it by detecting the current environment, or show a message like "local models aren't supported in this deployment environment" if it's selected, instead of crashing with an error) — the public demo actually uses the cloud providers Claude/ChatGPT/DeepSeek/Gemini
- This isn't a bug to fix — it's an architectural limitation that's supposed to be this way. Don't spend time trying to "bridge" the network between Vercel and someone's laptop.
- **Future direction (fine to just write into the docs/roadmap — no need to build this now)**: if the public demo should support open-source models later, the theoretically viable approach is to find a separate **always-on, GPU-equipped cloud host** (e.g. a RunPod, Together.ai, or AWS/GCP GPU instance) to run an inference service like Ollama/vLLM on, then point the website code at it — this is the same principle as "local LLM," just swapping "local" for "a beefier always-on server." The real difference is only that a serverless platform like Vercel has no GPU and can't keep a large model resident. This is a separate chunk of new infrastructure with non-trivial effort and cost — good material for a finals/future-roadmap slide for bonus points, but not recommended to actually build during these 4 qualifying-round days

**Don't write a separate set of call code for every LLM** — that's the surest way to blow up the workload. The Vercel AI SDK chosen in the tech stack is itself designed for "a unified multi-LLM interface"; using it well turns most of the work into "configuration" rather than "reimplementation":

- Claude / OpenAI / Gemini each have an official provider package (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` — go with whichever version actually installs; look up the latest usage when writing the code), and their calling convention (`generateText` / `streamText`) is nearly identical — only the `model` parameter changes
- **Both DeepSeek and LM Studio's local service are OpenAI-API-compatible** — there's no need to write a separate provider for them; just reuse the OpenAI-compatible calling convention and swap `baseURL` and `apiKey` to point at DeepSeek's address / the local LM Studio address (LM Studio starts an OpenAI-compatible local service at `http://localhost:1234/v1` by default)
- All LLM calls go through the adapter layer at `/lib/llm/`; each feature module's `logic/` only calls the unified function this layer exposes (e.g. `callLLM(provider, prompt, options)`) — never import a specific LLM's SDK directly inside a feature module
- The UI/config side only needs to let you "choose which provider to use this time" (an environment variable or a simple dropdown both work) — no need for smart routing, auto-selecting the best cost/performance model, or other extra features
- **Acceptance criteria**: the Gemini path must be reliably available (as the demo's fallback); the other 4 providers only need to be "selectable, switchable, and able to complete at least one call" — there's no requirement to tune the prompt separately for each one

## Architectural Constraint: "Everything Is a Plugin" (module isolation + multiple languages)

This is a core development principle the team has set, and **every AI must follow it while writing code**. The goal is to make it physically hard for the three members' AI sessions to conflict while developing in parallel, and to turn "adding features on top of the qualifying-round build" during the finals into "adding a new folder" rather than "modifying existing code."

**Principle**: core holds only the bare minimum shared skeleton; everything else is a self-contained "plugin" module living in its own folder, touching other folders as little as possible.

**Language convention**:
- **The default language is JavaScript/TypeScript** (the Next.js ecosystem); most modules should use this
- **Exceptions are allowed**: if a module is clearly better suited to a different language because of specialized libraries (e.g. using Python for PDF parsing/OCR, where the Python ecosystem is more mature), that module can be built as a separate small service exposing its capability over an HTTP API; the rest of the code only calls it through the agreed interface and never needs to understand its internal implementation language
- **Don't build a generic, language-agnostic plugin runtime/plugin registry just to "theoretically support any language"** — that's unnecessary engineering effort; it's enough that "whichever languages are actually used each have a clear external interface"
- Each module is also **free in how it implements its UI** (it can use three.js for a visual effect, or the plainest HTML/CSS) — as long as it's self-contained in its own folder, there's no requirement to unify the whole team on one component library/visual style

The agreed directory structure (a Next.js project, made concrete around the three modules the problem statement already defines, plus the product-form requirements):

```
/app
  /core
    /mcp-server        <- Aggregates every feature's MCP tool definitions, registers and starts them centrally. Must be confirmed with the operator before any change, since everyone depends on it
    (global layout, navigation, routing skeleton, shared config)
  /features
    /classification
      /logic  /api  /mcp  /ui   <- Email classification module, self-contained
    /extraction
      /logic  /api  /mcp  /ui   <- Field extraction module (may be a Python sub-service, see the "language convention" above)
    /comparison
      /logic  /api  /mcp  /ui   <- Comparison + human-confirmation trigger module
/lib
  /shared              <- Types/utility functions that genuinely need to be shared across modules — keep this as small as possible
  /llm                 <- Unified multi-LLM adapter layer (see "multi-LLM support" above); every module calls LLMs through here
docs/SHARED_INTERFACES.md    <- If modules must communicate, the interface agreement is written here
```

**Folders are named after "what this feature is," not "who changes it"** — who owns which module is recorded below under "feature module owners," so re-assigning ownership later never requires renaming folders.

Specific rules for AI:

1. **A new feature = create a new `/app/features/<feature-name>/` folder** — don't scatter new-feature code into other, already-existing feature folders
2. **Don't import another feature folder's internal implementation details** (e.g. some internal component/function inside someone else's module). If you genuinely need a capability another module provides, first check whether `docs/SHARED_INTERFACES.md` already has an agreed interface for it; if not, propose adding an interface agreement to that file first, rather than reaching directly into someone else's code to grab something
3. **`/app/core`, `/lib/shared`, and `/lib/llm` are the shared "commons" everyone uses — any change must be confirmed with the operator first**, since getting it wrong affects the other two members' modules
4. When adding new features during the finals, prefer "adding one more feature folder" over heavily restructuring an existing feature's internals — this preserves the continuity the "the finals extend the qualifying-round build" rule requires
5. This is a **lightweight folder-isolation convention**, not a request to build a real runtime dynamic-load/unload plugin system — don't proactively build infrastructure like a plugin registry, dynamic imports, or plugin lifecycle management; for a 4-day, zero-experience scenario that's unnecessary extra complexity and a source of bugs

## Code Quality Red Lines (non-negotiable)

The team has explicitly required that this system be more than just "working" — maintainability, robustness, and extensibility are core goals that must not be sacrificed for speed. This doesn't contradict "don't over-design business functionality for hypothetical needs" — **don't design interfaces for requirements that don't exist yet, but code that does exist must be structured cleanly and modularly. Simple does not mean sloppy.**

1. **No "god files"**: a single file must not hold several unrelated things at once — route handling, business logic, database operations, UI rendering. If a file is clearly mixing several different concerns, or has grown absurdly long (roughly 300+ lines is a signal to consider splitting, not a hard cap), split it into multiple files along the `logic/api/mcp/ui` layering above
2. **Each function does one thing**, and its name should make clear what that is — avoid meaningless names like `handleData` or `process`
3. **Anywhere that makes an external call needs basic error handling** (LLM API calls, database operations, third-party services, file parsing) — at minimum a try/catch, plus a readable error message for the user or a "flag for help" flow triggered — the whole page/endpoint must never just crash on error with zero feedback
4. These are baseline requirements, not "deal with it later" technical debt — every time an AI finishes writing a piece of code, it should check itself against the points above

## High Concurrency and Data Sync/Conflict Handling (hard requirement)

The team has explicitly required that **the architecture account for high-concurrency scenarios, plus data-sync and conflict issues when multiple requests/people act at once** — it must not be designed assuming "only one person uses it at a time." "High concurrency" here doesn't mean building a large distributed system that can handle a million users — this is a 4-day hackathon demo, at the scale of "judges/teammates open the site at the same time" or "process a whole batch of sample emails in one go." **The goal is to avoid writing code that breaks under concurrency, not to over-engineer a complex distributed architecture** — this doesn't contradict the principle of "don't over-design business functionality for hypothetical needs."

Specific requirements:

1. **Never store state in a "module-level mutable variable" in server code** (e.g. a variable defined at the top level of a file in `api/`, `mcp/`, or `logic/` that multiple requests read and write, used as a cache/counter/temporary store). On a serverless platform like Vercel, the same project can have multiple instances handling different requests at the same time — a module-level variable is not "one shared copy across the whole project," and relying on it for state will read stale/dirty data or get overwritten under concurrency. **There are only two places state is allowed to live**: local variables inside a single request (discarded once it's done — inherently safe), and the Supabase database (state that genuinely needs to be shared across requests or persisted must be written to the database, never kept in memory).
2. **Batch processing (e.g. running classification → extraction → comparison over every email in `data/sample/` in one go) must use "capped concurrency" — don't pick either extreme**: doing them one at a time in a queue (too slow across dozens of emails, a bad demo experience), or firing off every email to the LLM simultaneously (easily triggers LLM API rate limits, and can also exhaust Supabase's connection pool). Cap "how many are processed at once" (e.g. 3-5 concurrently), topping up with the next one as each finishes. The project already provides the `mapWithConcurrencyLimit` helper in `lib/shared/concurrency.ts` — anywhere batch processing is written going forward (e.g. `lib/shared/pipeline.ts`, see docs/DATA_FLOW.md) should use it directly rather than reinventing concurrency control.
3. **During batch processing, one item failing must not take down the whole batch**: if one email in a batch errors out because of an LLM failure or a document-parsing failure, that must not abort the entire batch and lose every result. Isolate each item's failure individually (each one gets its own try/catch, its error message is recorded on failure, and the rest keep running), so the end result shows "which succeeded, which failed, and why" — this is also an extension of the error-handling requirement in the "code quality red lines" section.
4. **Writing to Supabase going forward (e.g. saving comparison results, human confirmation/review records) must use "upsert" (update if it exists, insert if it doesn't) — never a read-then-write pattern like "check whether this row exists first, insert only if it doesn't"** — when two requests happen almost simultaneously (e.g. the same email gets processed twice, or two people click "regenerate results" at the same time), that pattern causes both requests to see "not there yet" and both decide to insert, producing duplicate rows or stepping on each other. The fix: give this kind of table a field that uniquely identifies "this is the same record" (e.g. an `email_id` unique constraint on email-related tables), and always write with Supabase's `upsert`, letting the database guarantee uniqueness instead of the code trying to determine "does it exist" itself.
5. **Any data that a human can modify/review (e.g. the human-confirmation feature the comparison module will need later) must have an `updated_at` field in its table**: if two people open the same record to edit it at nearly the same time, whoever saves second should not "silently" overwrite the first person's changes with nobody noticing — there's no need for a full "conflict detection/merge" mechanism right now (over-engineering for a 4-day demo), but the field must be there so that a simple check later — "compare `updated_at` before saving; if it changed, prompt 'this record was changed by someone else, overwrite anyway?'" — is possible. Without this field, that becomes impossible to add later.
6. **API / MCP routes must stay stateless**: every request should be a completely independent call, never depending on "whatever the previous request left behind." The code is already like this (`api/route.ts` just parses the request → calls `logic/` → wraps the response), and new endpoints going forward must keep this pattern — don't add a global cache that "remembers the last request's result" just for convenience.

## Debugging Standard (mandatory: no patch-over-the-symptom debugging)

The team has explicitly required: **when a bug is found, its root cause must be identified and fixed — patching over the symptom is not allowed.** This serves the same goal as the "code quality red lines": patch-style debugging makes code progressively more fragile while leaving the operator unable to see that the problem is still there — it's public enemy #1 for maintainability.

**What counts as "patching" (prohibited)**:
- Wrapping something in try/catch and swallowing the error with no logging/handling, making the error disappear without understanding why it happened
- Adding a targeted `if` special case to dodge one specific error scenario, instead of understanding why that scenario occurs at all
- Blindly retrying a failed call or adding a `setTimeout` delay to paper over a timing issue, instead of figuring out where the real timing/dependency problem is
- Hardcoding a value to make an error disappear or a test pass, instead of fixing the faulty logic behind it
- Changing the line of code where the symptom shows up, without checking whether the symptom is actually caused by wrong data or a wrong call order somewhere upstream

**What to do when you hit a bug**:
1. First identify the **actual cause** of the error/abnormal behavior — which function, which step's input or logic is wrong — rather than only looking at the line where the error surfaced
2. Fix **the source of the problem**; if the root cause lives in another module or an upstream data structure, say so explicitly, and update the agreement in `docs/SHARED_INTERFACES.md` if needed — don't just silently absorb the bad data someone else passed in at your own layer
3. After fixing it, **explain to the operator in plain language what the root cause was and how it was fixed this time** — the operator needs to understand "why it broke," not just "it doesn't error anymore"
4. If the root cause can't be pinned down yet, **tell the operator honestly that "this is only a workaround for now, not a real fix"** — don't quietly slap on a patch and claim it's "fixed"

## General Rules for AI

1. **For business functionality, prefer the simplest approach that works — don't pre-design an interface for a hypothetical "might need it later" requirement.** But the code's structure itself must still follow the "code quality red lines" above — the operator has no programming background, and nobody can maintain or debug messy code.
2. **Keep changes small and independently runnable**, so the operator can commit/push frequently. Don't generate one huge, unverified blob of code all at once.
3. **Before starting a change, state in one sentence which files/directories you plan to touch**, then start. The team has 3 people running their own AI sessions at the same time — the scope of a change must be clear, to reduce conflicts with other people's branches.
4. **Anything other modules will depend on (shared data structures, API response shapes, environment-variable names, the LLM calling interface)** must be written clearly into `docs/SHARED_INTERFACES.md` (create it if it doesn't exist yet) before you change it. That way, even if the operator can't follow the details, the other members' AI sessions can still read the interface agreement.
5. **Write commit messages in plain, simple language describing what was done** — no need to follow a convention like Conventional Commits.
6. **When unsure about a requirement or product direction, ask the operator directly** — don't guess and decide on their behalf.
7. Every time a small, working feature is finished, remind the operator that it's ready to push, so teammates' AI sessions can read the latest code when integrating.
8. The operator is new to programming: explain key decisions in plain language, and avoid dropping jargon without explanation; if the operator asks "what does this part do," be able to explain it clearly — don't assume they already understand.

## Git Conventions

- The `main` branch must always stay "runnable" — never push code you already know is broken
- Branch naming: `feature/<person>-<short task description>`
- Commit in small steps, frequently — don't save up a whole day's changes for one commit
- **No AI coding tool (including you) will automatically resolve conflicts from 3 parallel sessions editing the same files** — so only make changes within the files/directories the operator owns, and don't stray into a module someone else owns just because it's convenient

## Git Safety Rules (important — avoid destructive incidents)

The operator is new to programming and has no intuition for what git commands actually do — an offhand, vague remark from them (like "clean this up for me" or "reset it") can easily lead to a destructive action being carried out by mistake. **Therefore:**

1. **Never run a destructive/irreversible git command without explicit, specific confirmation**, including but not limited to `git reset --hard`, `git checkout -- .`, `git clean -f`, or a force push. When the operator says something vague like "clean this up / it's a mess, fix it," **don't jump straight to a reset-type command** — ask first: "do you want to undo uncommitted changes, or roll back to a specific commit? This will lose changes X — confirm?"
2. Before starting any large change, remind the operator to commit manually first, leaving a snapshot that can be rolled back to
3. When resolving a merge conflict, clearly explain the reasoning behind how you plan to merge it — don't silently pick one side or unilaterally discard someone's changes without explanation

## Priority Order If Time Runs Short (if it turns out 3.5 days isn't enough for everything, cut from the bottom up — never cut from the top)

1. **Get the core three-step pipeline** (classify → extract → compare) working end-to-end with Gemini — this is where the 25 points for "Working Core Prototype" come from; absolutely cannot be cut
2. A responsive, usable Web UI
3. REST API (even if it only covers the most critical of the three modules)
4. MCP Server (even if it only exposes one or two tools)
5. Switching support for the remaining 4 LLM providers (DeepSeek / ChatGPT / Gemini / LM Studio) — if time truly runs out, at least build the interface/toggle; having a provider that doesn't quite work is still better than not building it at all — document the actual state honestly
6. Multi-language plugins (e.g. splitting extraction out into a separate Python service) — if time is tight, implement the same functionality in JS first; the "separate service" step can be pushed to the finals stage

## Team Division of Labor (confirmed — split by layer, not by module)

Unlike the example in the "architectural constraint" section above, where "each person claims one feature module" — the team's actual division of labor is **split by technical layer**, not by handing the three modules `classification`/`extraction`/`comparison` to three different people:

- **The operator (lead)**: **all backend functionality** — the `logic/`, `api/`, and `mcp/` of all three modules (`classification` / `extraction` / `comparison`), plus the shared areas `/app/core`, `/lib/shared`, `/lib/llm` — all owned by the operator alone (via an AI coding tool)
- **Teammate A**: **UI/UX** — each module's own `ui/` folder, plus the global layout/navigation (`app/layout.tsx`, `app/page.tsx`, `app/core/nav.tsx`, `app/globals.css`)
- **Teammate B**: **README, slides, demo materials, etc.** — doesn't touch code; responsible for documentation and demo-related deliverables

This division fits naturally with the already-established `logic/api/mcp/ui` layering: the operator only changes `logic/api/mcp`, teammate A only changes `ui/`, so the two almost never touch the same file — the odds of conflict are lower than "split by module." **Reminders for AI**:

1. When `app/features/*/ui/` calls its own module's `api/`, the returned data shape must match what's written in `docs/SHARED_INTERFACES.md` — this is the only "interface" the operator and teammate A need to keep aligned on. Whenever the operator changes an `api/` response shape, remember to update `docs/SHARED_INTERFACES.md` in the same change, so teammate A's AI knows to adjust accordingly
2. `README.md` is currently mainly written by teammate B (narrative content, demo-related), but for technical details that change as the backend changes — "how to install dependencies," "what to put in environment variables," "deployment steps" — the operator should proactively keep it updated after making changes, rather than expecting teammate B to guess the latest state correctly

## Review Takeaways (/council 2026-09-21)

- ① Any new write tool added to MCP must explicitly declare `readOnlyHint:false` (the MCP entry point fail-closes any tool without an explicit annotation, treating it as "needs a token"); ② Any deviation between the implementation and an already-approved plan (e.g. chunking granularity, default engine) must be explicitly logged and the verification checklist updated to match; ③ Error text from external calls must be readable but must not leak the raw upstream text; ④ The denominator for submission file completeness (the submission export) must come from an independent, trustworthy source (the official sample manifest) — never use your own data as the denominator
- ⑤ **The official problem-statement package (including the answers) is confirmed usable (2026-09-21 policy update)**: `sdoc-hackathon-docker` under `[!] Problem Statement/` (which includes the `data_v2/ground_truth.json` answers, the question generator, and the official scoring script) is material the organizers **have explicitly stated participants are allowed to use** — using it normally and keeping it in the repo is not a violation. **Stop treating it as a "leak/red line," and don't clean up git history or delete it from the repo over this.** The only constraint: `ground_truth` is for local self-testing only and must never go into the final submission file (it is absent from the `scope=submission` export).
