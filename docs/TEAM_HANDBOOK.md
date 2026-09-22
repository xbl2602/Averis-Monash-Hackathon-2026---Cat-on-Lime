# Team Execution Handbook — Averis x Monash Hackathon 2026

A role-division/collaboration handbook for the 3 team members. Technical details follow [CLAUDE.md](../CLAUDE.md) (all 3 people's Claude Code sessions read that file automatically); see [DECISION_LOG.md](DECISION_LOG.md) for the background behind core decisions.

## 0. Current Snapshot

- Team: 3 people, none with a programming background, all have used AI coding tools, none with hackathon experience
- Collaboration model: **each of the 3 runs their own AI coding session in parallel**, integrated via a Git repository
- Problem statement: won't be known until it's announced on **September 18**; we don't know what we're building yet
- Submission deadline: **2026-09-22 12:00pm**

✅ Registration, the GitHub repo, the Discord channel, and everyone's environment setup + minimal verification are all done (the corresponding items from the original section 4 have been removed).

Before the problem statement is announced, this handbook can only establish "general preparation and process"; section 8 will be filled in with the actual project content the moment the problem statement drops.

## 1. Key Timeline (updated after the 2026-09-18 opening ceremony; see [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md) for details)

| Time | Event |
|---|---|
| ~~Before 9/17 18:00~~ | ~~Registration deadline~~ Done |
| **9/18 (today)** | **Official problem statement announcement**: Shipping Documents Verification, see section 8 |
| 9/18 - 9/22 noon | Development sprint |
| 9/20 | **Workshop 1** (speakers: Sharik, Darren) — leave time in the schedule to attend |
| 9/21 | **Workshop 2** (speaker: Averis) + recommended to start feature freeze, integration, debugging, and demo-material prep from this day on |
| 9/22 morning | Record the video, write the slides, final checks |
| **9/22 12:00pm** | **Preliminary submission deadline (Google Form)** — double-checked against a countdown, the time is accurate |
| 9/24 | The preliminary round's top-10 team list is announced |
| 9/26 (see the warning below) | Finals: an in-person 10-minute pitch + 5-minute Q&A, location **Monash University Malaysia, Bandar Sunway, Subang Jaya**, **the entire team must be physically present** |

⚠️ The finals date appeared once as "the 26th" and once as "the 20th" in the opening-ceremony transcript. Logically (the top-10 list isn't announced until 9/24, so the finals can't be before that) the 26th is more credible, but it's recommended to confirm via an official Discord announcement before finalizing — don't schedule the rest of your plans directly off this note.

## 2. Event Background and Partner Positioning (research findings, not official documentation)

This section isn't part of the official Rules and Regulations — it's supplementary background from research, meant to help guess at the likely direction of the problem statement. **Anything marked "unverified/speculative" should not be treated as confirmed fact; once the problem statement is announced, the official version takes precedence.**

### 2.1 Who the Organizer Is
- **Averis Sdn Bhd**: a Malaysian global business services (GBS) company, founded in 2006, headquartered in Bangsar South, Kuala Lumpur, primarily serving **RGE Group** (Royal Golden Eagle, Sukanto Tanoto's conglomerate spanning paper/palm oil/viscose fiber/energy). Core business: IT outsourcing, HR, finance and accounting, shipping documentation, digitalization/RPO/change management.
  - The earlier research guess that "Averis might be connected to the Sunway Group" **has been disproven** — the two are unrelated.
  - **There's no evidence Averis is an agent of, or has a binding relationship with, any particular cloud vendor (AWS/Azure/GCP)** — there's no need to specifically cater to them when picking a cloud platform.
  - Based on this, a **(unverified)** guess: the problem statement is likely to lean toward an **enterprise back-office/supply-chain scenario** — e.g. HR process automation, financial reconciliation, shipping/logistics document processing, or internal enterprise digitalization tools — rather than a consumer-facing social/e-commerce app. One other hackathon Averis has participated in (co-hosted with Ace Resource Advisory) had a **supply chain/IoT** theme, which further supports this guess, though **it cannot be confirmed to be part of the same series**.
  - **This guess has been confirmed by the official problem statement announced on 9/18**: it is indeed Shipping Documents Verification — see section 8 and [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md) for details.
- **Monash University Malaysia**: confirmed to be Monash's Malaysia campus (Bandar Sunway), hosted by the School of IT — not Monash's Australian headquarters. The campus has an active GDG on Campus (Google Developer Group) student society, and the school is a member of the **Microsoft Azure Dev Tools for Teaching** program — no evidence was found of a partnership with AWS Academy or Huawei Cloud. **There's no evidence the competition mandates or favors any particular cloud platform.**

### 2.2 Whether There Are Past Editions
- No past editions (2024/2025) under the specific name "Averis x Monash Hackathon" could be found — **this is very likely the first edition**, with no historical problem statements or winner lists to reference.
- **No substantive discussion of this competition** was found on forums/social media (Lowyat.NET, Reddit, Facebook, X, TikTok) — essentially no team-finding posts, complaints, or strategy write-ups exist, so information has to come solely from the official site and Discord.

### 2.3 Format Details (filling in what the official docs didn't spell out)
- Prize pool **RM 9,000**: champion RM5,000 / runner-up RM3,000 / third place RM1,000
- There's only **one single sealed problem statement**, not multiple tracks to choose from — no need to agonize over "which track to pick"
- The **top 10 teams** from the preliminary round advance to the finals, doing a **10-minute pitch + 5-minute Q&A** in person
- Open to all university students (not limited to Monash students)
- The two detailed scoring rubric Google Docs ([preliminary](https://docs.google.com/document/u/0/d/1EiI_mqJYeMN0D-dtZ_npCavVGXVcePFmcZ7O4d4ygQI/edit), [finals](https://docs.google.com/document/u/0/d/1S-bLf45JOabMl1QUDgl4F6NTwuwD7UKbhPKh74sqaRo/edit)) require a Google login to see the full content, and research tools couldn't open them — **it's recommended to open the full rubrics manually with your own Google account as soon as possible**, since they may be more detailed than the top-level categories shown in the chart.
- No other sponsor/mentor list was found; as far as we can tell, Averis is the only hosting company.

## 3. Aligning with Scoring (spend effort where it counts)

From the scoring chart in [Rules and Regulations.md](official/Rules%20and%20Regulations.md), the highest-weighted item in both rounds is "does it actually run":

**Preliminary round (100 points)**: Working Core Prototype 25 (highest), System Design & Architecture 15, Technology Integration 15, Technical Feasibility & Validation 15, Problem Statement Understanding 10, Innovation & Solution Approach 10, Practical Value & Potential 10

**Finals (100 points)**: End to End Functionality 25 (highest), Architecture & Scalability 15, Technology Integration 15, Engineering Quality & Robustness 15, Solution Effectiveness & User Value 10, User Experience & Differentiation 10, Impact & Future Potential 10

**Conclusions**:
- Prioritize **one complete, working core flow** above building lots of half-finished features or fussing over a fancy UI.
- "Technology Integration" is worth 15 points in both rounds, and most likely refers to whether AI + cloud infrastructure are **genuinely integrated into the core functionality** (rather than just window dressing) — the rules text itself stresses that "failing to meaningfully integrate cloud infrastructure may result in a significant score reduction." AI and cloud deployment aren't bonus points; they're a hard pass bar.
- With zero programming experience on the team, `Engineering Quality & Robustness` (15 points in the finals) is an easy place to lose points — the collaboration rules in section 5 exist specifically to protect this score as much as possible.
- Researching winning projects from similar AI hackathons in Southeast Asia (e.g. "InsureScan," an AI insurance-document recognition tool, and "FundSight AI," an SME grant-matching tool, both from APU, which won the Great Malaysia AI Hackathon 2025) revealed a common pattern: **winning projects are all quite "narrow"** — one specific vertical problem plus one core AI feature a judge can understand within 30 seconds, rather than a big all-in-one platform. Common failure points are feature bloat, or a demo depending on a live API that might go down on stage (recommend preparing cached/pre-set demo data as a fallback).

## 4. Pre-Competition Prep Checklist (complete now, before 9/18)

- [ ] Decide on a "default tech stack" ahead of time (see below), to reduce decision paralysis on the day the problem statement drops
- [ ] Apply for cloud/AI credits in advance — don't wait until competition day to apply:
  - [ ] [AWS Educate](https://aws.amazon.com/education/awseducate/) (no credit card needed)
  - [ ] Azure for Students (about $100 in credits)
  - [ ] Google Cloud free tier/education credits
  - [ ] **Apply for Claude API credits directly on Anthropic's site** (note: as of March 2026, the GitHub Student Pack no longer grants direct access to the Claude Opus/Sonnet models, only Haiku — don't rely on the student pack for Claude usage)
- [ ] Manually log into a Google account and open both scoring rubric Google Docs (links in section 2.3), to check for details not shown in the official chart
- [ ] Commit this handbook and `CLAUDE.md` to the repo root
- [ ] Each person should think through their own "natural strength" (communication/presentation, design sense, writing documentation, logical testing), to inform how features get split up on 9/18 — this isn't a technical role split, it's about "who's best suited to keep an eye on what"

### Tech Stack (confirmed, not a temporary default)

The team has formally settled on the combination that requires **the least ops overhead and is easiest for AI to generate correct code for**, rather than the most "professional" combination. Research also confirmed this combination as the widely recognized "low-hallucination-rate" standard stack in the 2026 AI-coding-tool community (because it's the most common combination in documentation/training data, so AI makes the fewest mistakes writing it):

- Frontend + deployment: **Next.js**, deployed to **Vercel** (confirmed — free, deploys on every git push, no need to touch a cloud console, and AI-generated Next.js code is generally the highest quality)
- Backend/data: **Supabase** (confirmed — a managed Postgres database + auth + storage, no need to run your own server, and it clearly satisfies the "cloud infrastructure" requirement)
- AI capability: **multiple LLMs** (Claude / ChatGPT / DeepSeek / Gemini / local LM Studio, all called through a unified interface via the Vercel AI SDK), as part of the product's core functionality — see the "Multi-LLM support" section of [CLAUDE.md](../CLAUDE.md) for specific requirements

The tech stack is locked in and doesn't need to be revisited as problem-statement details come in.

## 5. Collaboration Process (general, independent of the specific problem statement)

### 5.1 Git Branching Model

Research clearly points out that **no AI coding tool currently automatically handles merge conflicts from multiple people editing the same files at the same time** (Claude Code and Bolt.new are no exception) — three people genuinely editing the same file simultaneously is a conflict hotspot, and it has to be avoided through process, not by relying on the tools to bail you out:

- The `main` branch must "run" at all times; changes only get merged in via Pull Request — never push code that doesn't run directly to main
- Everyone works on their own branch: `name/task-summary` (e.g. `alex/login-page`), **only touching folders within their own claimed scope** (matching the folder split described in section 5.2, "everything is a plugin")
- **Commit small and often**: as soon as you've got a small working piece, commit + push — don't save up a whole day's changes before committing, since large changes piled together are hard to merge
- Pull the latest code from main before starting work each day, to avoid drifting further and further apart
- **Assign one "integration owner" per day** (rotating among the 3), responsible for merging everyone's Pull Requests into main that day
- Avoid "three people simultaneously issuing instructions to AI against the same file" — this is repeatedly flagged in the research as the number-one cause of things going wrong

### 5.1.1 How To Actually Do This (beginner-friendly: use GitHub Desktop throughout, no command line needed)

None of the three of us have used Git before, so **it's strongly recommended to use the graphical tool [GitHub Desktop](https://desktop.github.com/)** — click buttons the whole way through, no need to memorize commands. Claude Code can also run git commands directly for you, but **don't let it operate completely unsupervised** (see the safety reminder below for why) — use GitHub Desktop as the "final check" for branching/committing/pushing/merging, and use Claude Code for writing code and explaining conflicts.

**The daily routine:**

1. **Before starting work**: open GitHub Desktop, click **Fetch origin** then **Pull**, to pull down everyone else's latest code from main
2. **Create your own branch**: at the top, **Current Branch -> New Branch**, name it `your-name/todays-feature`
3. **Write code**: use Claude Code as normal
4. **Commit in small steps as you go**: once you've got a small working piece, write a one-line description of what changed in the bottom-left of GitHub Desktop and click **Commit**
5. **Push**: click the **Push origin** button to send your commits to the cloud (do this whenever you reach a stopping point, at least every 2 hours)
6. **Once a small piece of a feature is done, open a Pull Request**: at the top, **Branch -> Create Pull Request**, which auto-opens the GitHub page in your browser — fill in a title and submit
7. **The integration owner for the day** checks the PR on the GitHub website, and clicks **Merge pull request** if it looks fine
8. **Everyone else** repeats step 1 (Fetch -> Pull) to bring the newly merged code from main back to their own machine

**When a merge conflict happens (a file will show markers like this):**

```
<<<<<<< HEAD
your version
=======
your teammate's version
>>>>>>> the other branch's name
```

1. GitHub Desktop or VS Code will flag this file as "conflicted" — open it
2. If opened in VS Code, buttons like **Accept Current Change / Accept Incoming Change / Accept Both / Compare Changes** appear above the code — click whichever you want to keep
3. Confirm there are no leftover `<<<<<<<` `=======` `>>>>>>>` markers in the file (manually delete them if there are)
4. You can also **paste the whole conflicting section into your own Claude Code** and ask "these two code sections conflict, help me merge them, try to keep both sides' changes, and explain how you merged them" — **read its explanation before accepting, don't click Accept Both without looking**
5. Save the file, go back to GitHub Desktop, check the box marking this file as "resolved," and Commit + Push as usual

**⚠️ Safety reminders for using AI coding tools with Git (based on real incidents that actually happened):**

- **Commit manually before letting AI start any new task**, leaving a clean "before" snapshot — so if AI breaks something, there's a way back
- **Never have two people's AI editing the same branch at the same time**
- **Glance at what a conflict-merge result from AI actually changed before accepting it** — don't approve it blindly
- If AI breaks something, **undo it using GitHub Desktop's graphical "Discard changes" button** — don't tell the AI "clean this up for me / reset it for me." There's already a real case where this kind of vague phrasing led an AI to run a destructive command like `git reset --hard`, which **permanently wipes out uncommitted changes**

### 5.2 Splitting Modules: Everything Is a Plugin (the first thing to do on announcement day, within 30-60 minutes)

The team's core architectural principle is **"everything is a plugin"** — the project is split into a very thin "core skeleton" (navigation, layout, shared config) plus a number of **self-contained feature modules**, each in its own folder, avoiding other people's folders as much as possible. This convention is already written into [CLAUDE.md](../CLAUDE.md), and all 3 people's AI follow it automatically; see that file for the exact directory structure.

This architecture wasn't chosen to "look professional" — it directly addresses two real pain points:

- **How can 3 people using AI in parallel avoid conflicts?** -> everyone's feature lives in their own folder, making it physically hard to conflict with anyone else; conflicts only happen in a small number of "shared area" files, and those just need a heads-up in the group chat before editing
- **The finals must be an extension of the preliminary submission, not a rebuild from scratch** -> adding a feature for finals = creating another feature folder, without needing major changes to existing code, making "extending" the natural path

**Actual division of labor (confirmed; split by layer, not by module)**: unlike this section's original idea of "each person claims one feature module," the team actually split work by technical layer:

- **The operator**: all backend functionality — the `logic/`, `api/`, `mcp/` folders of the three modules `classification`/`extraction`/`comparison`, plus the `/app/core` and `/lib` shared areas
- **Teammate A**: UI/UX — the `ui/` folder of all three modules + the global layout and navigation
- **Teammate B**: README, slides, demo materials — doesn't touch code

This split fits naturally with the `logic/api/mcp/ui` layered architecture — the operator and teammate A will almost never edit the same file. The only thing the two need to keep aligned is the interface format documented in `SHARED_INTERFACES.md` — when the operator changes an `api/` response format, this file must be updated in the same change, so teammate A's AI knows to adjust the UI accordingly.

(What follows is the original process reference for splitting work by module, which no longer fully applies now that work is split by layer — kept only for reference in case the division of labor changes again in the future):

1. All 3 discuss the product approach together (each can first have their own AI help analyze the problem statement)
2. Split the project into feature modules that are **as independent as possible, each in its own folder** — exactly how to split depends on the problem statement, but the criterion is "can this piece run more or less independently, without needing to frequently reach into another module's internal details"
3. If a feature absolutely needs something within someone else's area of responsibility, first write clearly in `SHARED_INTERFACES.md` "what data format/interface I need," rather than having your own AI go directly modify/read implementation details in someone else's area

### 5.3 AI Usage Guidelines

- All 3 people's Claude Code (or other tools) read [CLAUDE.md](../CLAUDE.md) at the repo root, keeping code style and directory structure consistent
- Before starting a task, post "I'm about to do XYZ" in the `#dev` channel, to avoid two people duplicating the same work
- Push as soon as a small runnable feature is done, so a teammate's AI can read the latest code when integrating
- **If you don't understand AI-generated code yourself, just ask the AI "what does this do"** — especially for parts that affect other people's modules (shared data structures, interface formats) — don't accept it blindly
- For any interface change that "another module will use," write it down clearly first (a `SHARED_INTERFACES.md` works well) before making the change, so the other person's AI knows to adjust accordingly

### 5.4 Sync Mechanism

- Recommend at least two 15-minute voice syncs a day (e.g. noon + evening), covering: what got done yesterday / what's planned for today / where you're stuck and need help
- Use a pinned Discord message or a shared document to track "who owns which module" in real time

## 6. Sprint-Phase Template (placeholder, to be refined once the problem statement lands on 9/18)

- **Day 1 (9/18)**: brainstorm + settle on an approach + split modules + everyone gets a basic skeleton running (even if it's just an empty page deployed live)
- **Day 2-3 (9/19-9/20)**: main development sprint, integrating at least once a day
- **Day 4 (9/21)**: **feature freeze** (no more new features), start integrating, debugging, preparing demo materials, and preparing backup data in case an API fails
- **Day 5 morning (9/22)**: record the video, write the slides, do a final check of the submission checklist, submit before noon

## 7. Pre-Submission Checklist (per [Rules and Regulations.md](official/Rules%20and%20Regulations.md))

- [ ] Project Description (project name, purpose, the problem being solved)
- [ ] Demo Video (**<=5 minutes**, 1 point deducted per 30 seconds over; YouTube unlisted/public both fine, not private; Google Drive must be set to "Anyone with the link -> Viewer")
  - [ ] Video content covers: team & project name / what the problem is & who it affects / tech stack / live demo / impact (data or user feedback)
- [ ] GitHub repository link, with a README containing clear setup instructions
- [ ] Live Prototype publicly accessible link, **must stay online throughout judging**
- [ ] Slide Deck / document link, covering: technical architecture, implementation details, challenges encountered, future plans
- [ ] Every field in the Google Form filled in completely (team name, representative contact info, etc.)

## 8. Project Content (updated after the 2026-09-18 problem statement announcement)

- **Problem statement**: Averis's shipping operations team receives roughly 2000 emails a day in one shared mailbox (a mix of Shipping Instructions/SI, Bill of Lading/BL confirmations, invoice inquiries, and spam), and needs to check a BL draft against its corresponding SI field by field until they fully agree before it can be finalized; manual checking is repetitive and error-prone. The system needs to: (1) classify email type, (2) extract key fields from the body/attachments (shipper, consignee, notify party, port of loading, port of discharge, container count, weight), (3) compare BL and SI fields and flag discrepancies, (4) proactively flag when human intervention is needed in uncertain cases. See [OPENING_CEREMONY_NOTES.md](OPENING_CEREMONY_NOTES.md) for full details, sample data notes, and scoring criteria.
- [ ] Project name (not decided yet — recommend settling on one today)
- **Final tech stack**: the organizers confirmed there's no restriction, so we're sticking with the combination settled on in section 4 (Next.js + Supabase + Vercel + multiple LLMs; see [CLAUDE.md](../CLAUDE.md) for specifics), which is already sufficient
- **Feature module split**: split into three features following the three steps given officially (already written into [CLAUDE.md](../CLAUDE.md)); the code structure is split by module into `classification`/`extraction`/`comparison`, but **the human division of labor is by layer, not by module** (see section 5.2):
  - [x] Backend (all `logic`/`api`/`mcp` for the three modules + the `/app/core` and `/lib` shared areas) — owner: the operator
  - [x] UI/UX (the `ui/` folders for the three modules + global layout/navigation) — owner: teammate A
  - [x] README / slides / demo materials — owner: teammate B
- [ ] Detailed day-by-day task list (once modules are claimed, each person refines this in their own AI session)
- **Material usable for the "future plans" section of the slide deck**: the public demo currently uses cloud LLMs (Vercel has no GPU and can't run local large-model inference); in the future, to support a self-hosted open-source model, a separate GPU cloud instance (RunPod/Together.ai, etc.) could run the inference service, with the website code just pointing at it — this doesn't need to actually be implemented; putting it in the slides to show "we've thought through how this scales" is worth points (maps to Architecture & Scalability / Impact & Future Potential in the finals rubric)

## Appendix: Information Explicitly Not Found / Unverified During Research

Avoid treating the following as established fact:

- A connection between Averis and Sunway Group — **unverified, most likely wrong** (Averis actually belongs to RGE Group)
- Past editions of this competition (2024/2025) — not found; presumed to be the first edition
- Whether Monash Malaysia has an AWS Academy / Huawei Cloud partnership — no evidence found
- Whether Averis x Monash has dedicated sponsor cloud credits/perks — not found; recommend asking Discord/the organizers directly
- ~~The exact date and location (campus) of the in-person finals pitch — not officially announced~~ **Location confirmed**: Monash University Malaysia, Bandar Sunway, Subang Jaya. **Date still uncertain**: the opening-ceremony transcript said "the 26th" once and "the 20th" once — needs verifying on Discord
- Total number of competing teams — not found
- Any sponsors/mentors besides Averis — not found
