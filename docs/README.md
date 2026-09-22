# docs Directory Overview (the single entry point)

> This is the index page for `docs/`: it explains **which document is currently authoritative, which is historical, and which one to check for a given question**.
> Rule: before adding a new document, ask "can this be merged into an existing one?" Merge it in if you can; only create a new file if you can't, and in that case you **must register a line here**.
> Last organized: 2026-09-21.

## Start here: what am I looking for?

| I want to know | Open this |
|---|---|
| **What's still unfinished right now (the to-do list)** | **[TODO.md](TODO.md)** |
| How to install, run, and deploy (local / Docker / Vercel) | The repo root [README.md](../README.md) |
| Building/changing the UI (GUI), which endpoints are available | **[UI_GUIDE.md](UI_GUIDE.md)** — the single entry point for UI work |
| A given endpoint's fields / parameters / response / error codes | [SHARED_INTERFACES.md](SHARED_INTERFACES.md) |
| How data flows between modules (hard rules) | [DATA_FLOW.md](DATA_FLOW.md) |
| How classification / extraction / comparison actually decide things, and what the model inputs are | [DECISION_SPEC.md](DECISION_SPEC.md) |
| Why a given design decision was made at the time | [DECISION_LOG.md](DECISION_LOG.md) |
| How the team divides work, how Git is used, AI collaboration rules | [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md) (binding rules live in the root [AGENTS.md](../AGENTS.md) / [CLAUDE.md](../CLAUDE.md)) |
| Problem background, scoring details, event schedule | [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md) + [official/](official/) |
| What's left to do for finals | [FINALS_ROADMAP.md](FINALS_ROADMAP.md) |
| Past merge records / meeting notes / audits | [HISTORY.md](HISTORY.md) (read-only history) |

## Full document list

### A. Currently active - authoritative (must be kept in sync when code/interfaces change)

| Document | One-liner | Maintenance status |
|---|---|---|
| [SHARED_INTERFACES.md](SHARED_INTERFACES.md) | Interface contract: paths, parameters, responses, error codes | Authoritative; updated in the same commit as interface changes |
| [DATA_FLOW.md](DATA_FLOW.md) | Hard rules for how data flows between modules | Authoritative |
| [DECISION_SPEC.md](DECISION_SPEC.md) | Decision criteria and model-input contract for classification/extraction/comparison | Authoritative |
| [DECISION_LOG.md](DECISION_LOG.md) | Decision-by-decision record (including "why we didn't do it that way") | Authoritative; append-only, old entries are never changed |
| [UI_GUIDE.md](UI_GUIDE.md) | GUI development guide (ready-to-use endpoint reference + UI change checklist) | Authoritative; kept in sync when interfaces change |

### B. Currently active - plans and background

| Document | One-liner | Maintenance status |
|---|---|---|
| [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md) | Team handbook: role split, timeline, Git, collaboration style | Updated as plans change |
| [FINALS_ROADMAP.md](FINALS_ROADMAP.md) | Finals sprint plan and gap list | Updated as plans change |
| [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md) | Problem background, understanding of scoring, event schedule | Background info, essentially static |
| [PHASE2_SPEC.md](PHASE2_SPEC.md) | Design notes for the config / mail / import trio | Done - 2026-09-21 doc drift resolved (the original UI_GUIDE §6 checklist has been fully addressed) |
| [REVIEW_SPEC.md](REVIEW_SPEC.md) | Design spec for the manual review loop (review queue / persistence / undo / audit) | Done - the backend (REST+MCP) is implemented and wired into all four modules; **the GUI is not built yet** (teammate A's to-do, see UI_GUIDE.md); implementation notes are in §14.1 of this file |

### C. Historical - read-only (never edit past entries; append new records at the end)

| Document | Contents |
|---|---|
| [HISTORY.md](HISTORY.md) | The former MERGE_NOTES (a one-time merge record) + WORKSHOP_1 (cloud-hosting workshop notes) + WORKSHOP_2 (Averis Q&A session notes) + COUNCIL_AUDIT_2026-09-21 (an audit snapshot) |

### D. Official originals (do not modify)

| File | Description |
|---|---|
| [official/Rules and Regulations.md](official/Rules%20and%20Regulations.md) | Official competition rules and scoring details (original English) |
| [official/Averis Hackathon Participant Infopack.md](official/Averis%20Hackathon%20Participant%20Infopack.md) | Official participant infopack (original English) |

### E. Other

| File | Description |
|---|---|
| [logo-concepts.html](logo-concepts.html) | A visual draft, not documentation |

## Maintenance Rules (to keep the docs from spiraling out of control again)

1. **Merge whenever possible**: before writing a new document, first check whether it can be folded into an existing one from A/B/C above.
2. **Every document states its identity clearly**: mark `maintenance status (authoritative/planning/historical)` + `last verified date` at the top.
3. **History is append-only**: category-C documents never have their old content edited; to update, append a new section or create a new document.
4. **Single source of truth for contracts**: fields/parameters/responses are documented only in `SHARED_INTERFACES.md`; everywhere else just links to it instead of copying it.
5. **This page is the single entry point**: any addition, rename, or archiving is synced here with one line.
