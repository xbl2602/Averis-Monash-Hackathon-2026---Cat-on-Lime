# Opening Ceremony Notes (2026-09-18 Virtual Opening Ceremony)

Source: the official transcript of the opening-ceremony recording (meeting minutes). This document is an organized summary of the highlights, not a verbatim transcript; the raw transcript was messy (speech-recognition errors, mixed languages), so it has been organized into structured entries by content.

> Note: in the transcript, the organizer's name was recognized as "Everest," but cross-referencing "Rules and Regulations.md" and the event's official website, the correct name is **Averis** — used consistently as Averis below. This is a speech-recognition error, not an actual name change.

---

## 1. Organizer Background (clearer than earlier research)

- Averis is a global **business and technology services provider**, covering finance, technology, data, digital transformation, and similar areas — a shared-services/outsourcing-type company.
- Opening ceremony keynote speaker: **Ms. Chin**, Averis's Head of HR, IT and Digital, who gave the opening remarks.
- The problem statement was announced live, with Q&A, by **Mr. Sergio** (a software engineer at Averis).
- The hiring preferences mentioned in the remarks could be a useful angle for the team's presentation: Averis noted that they value not just technical ability but also curiosity, adaptability, willingness to learn, and teamwork — reflecting these appropriately in the pitch/documentation would likely resonate well with the judges.

---

## 2. Schedule Update (cross-referenced against TEAM_HANDBOOK.md section 1)

| Date | Event |
|---|---|
| 9/18 (today) | Virtual opening ceremony + problem statement announcement |
| 9/20 | Workshop 1 (speakers: Sharik, Darren — not Averis staff) |
| 9/21 | Workshop 2 (speakers: from Averis) |
| 9/22 12:00pm | **Preliminary submission deadline** (via Google Form; the submission window opens 9/18) |
| 9/24 | Top-10 list announced |
| 9/26 (see the warning below) | Finals pitch day, location: **Monash University Malaysia, Bandar Sunway, Subang Jaya** |

⚠️ **A discrepancy that needs verifying on Discord**: in the transcript, the finals date was first stated as "the 26th," but later in the Q&A it was said again as "the 20th." Logically (the top-10 list is announced 9/24, so the finals can't be before that), **the 26th** is more likely correct, and "the 20th" was probably a speech-recognition error or a slip of the tongue. It's recommended to confirm the exact date via an official/Discord announcement rather than scheduling directly off this note.

**Schedule reminder**: there are workshops on both 9/20 and 9/21. Even though this is crunch time, it's likely worth carving out time to attend both (especially 9/21, which is given by Averis themselves and may relate directly to the problem statement) — leave room for them when planning, rather than filling those two days entirely with coding.

Extra perk for top-10 teams: they'll be assigned a dedicated mentor for technical and strategic guidance ahead of the finals. Each team gets 15 minutes on finals day: a 10-minute pitch + demo plus a 5-minute Q&A, and **the whole team must be present** (in person, physically — not online).

Prize money confirmed: 1st place RM5,000, 2nd place RM3,000, 3rd place RM1,000 (consistent with "Rules and Regulations.md").

---

## 3. Official Problem Statement: Shipping Documents Verification

### Business Background
Averis's shipping operations team sends and receives all related email through a single shared mailbox, receiving **as many as roughly 2000 emails a day**, of mixed types:
- Providing / revising a **Shipping Instruction (SI)** — the customer's original requirements, sent as an email attachment
- Confirming / revising a **Bill of Lading (BL) draft** — the formal document the shipping operations team drafts from the SI to send to the carrier
- Invoice-related inquiries
- Spam

Core task: check the drafted BL against its corresponding SI field by field; if even one field doesn't match, the BL must be revised until both sides agree completely before it can be finalized and sent to the carrier.

### Three Core Pain Points (in the organizer's own words)
1. **Finding the right email is time-consuming** — manually searching through 2000 emails to find the one that needs handling is slow
2. **Manual comparison is repetitive and error-prone** — it involves reading the email, understanding the instructions, checking the attachments, and then cross-checking the documents, with many steps
3. **Terminology isn't consistent between the two sides** — SI and BL are documents produced at different stages, so the same field may be labeled/formatted differently on each side, adding to the difficulty of comparison

### Three Capabilities the System Must Have (scoring is measured against these three)
1. **Classification**: determine which category an email belongs to — is it an SI? A BL confirmation/revision request? An invoice inquiry? Or spam? Content in both the body and any attachments must be recognized.
2. **Understanding intent + extracting information (Extraction)**: information must be extractable whether it's in the email body or in an attachment (e.g. a PDF). The fields explicitly called out for extraction in the sample data:
   - shipper
   - consignee
   - notify party
   - port of loading (POL)
   - port of discharge (POD)
   - container count
   - weight in kg
3. **Comparison**: check the extracted BL fields against the SI fields, find any discrepancies, and help the shipping team catch errors before finalizing the document
4. **A fallback mechanism (explicitly required by the organizers)**: if the system **can't decide or isn't sure** during classification/extraction/comparison, it should proactively "raise its hand" and ask the operator for clarification/help, rather than forcing out a result that might be wrong

### Sample Data
- The organizers provide roughly **500 emails + 100+ attachments**
- Two usage methods, either is fine:
  1. Use them directly as static files (with an accompanying Python script for viewing the data)
  2. Run a mock API using the official **Docker** image, and call the endpoint directly from your program to fetch data
- Language: the sample data is mostly in **English**. Additionally supporting Malay/Indonesian/Chinese is a bonus, not a requirement.
- The Docker package may include an API key; the organizers said if there is one, it will be distributed separately through official channels (Discord/email).

---

## 4. Technical and Submission Requirements

### Technical Freedom
- **No programming language/framework/platform/tool is mandated** — completely free choice
- Official guidance: don't just think about "getting it running during the hackathon" — also consider **scalability, maintainability, and extensibility**, and whether development could continue after the event ends. This maps to the "System Design & Architecture" scoring item.
- **Two hard requirements** (both mandatory — missing either clearly costs points):
  1. **AI must be meaningfully integrated** (as part of the core functionality/development process/deployment method)
  2. **Cloud infrastructure must be used** — the organizers explicitly stated that Docker / Docker Compose counts; it doesn't have to be a paid AWS/GCP/Azure service. Cloudflare, static site hosting, and similar all count as "cloud infrastructure."
- **The organizers provide no cloud service/AI credit budget** — teams need to find their own free options (this maps to the prep-checklist item "apply for cloud/AI credits in advance" in TEAM_HANDBOOK.md section 4)
- **There is no restriction whatsoever on AI usage**: the organizers' own words were that you can use it "as much as you like," whether for brainstorming or as the product's core feature; agentic / agent-to-agent or any other form is fine, and **no specific workflow is mandated** (there's no need to copy Averis's existing internal process — you can design your own)

### Submission Checklist (more detailed than Rules and Regulations.md)
Submission portal: **Google Form**, submission window 9/18 - 9/22 12:00pm (sharp, no late submissions)

Required items:
1. **Project description**: project name, purpose, the problem being solved
2. **Demo video**:
   - Upload to YouTube (unlisted or public) or Google Drive (sharing must be set to "anyone with the link can view")
   - **Private videos are not accepted**
   - **Maximum 5 minutes**; overtime penalty: 1 point deducted per 30 seconds over
   - Content must cover: team + project introduction, problem explanation, tech stack, working prototype demo, impact/value
3. **GitHub repository link**, with a clear **README** (including environment setup/run instructions)
4. **A publicly accessible prototype/demo link** — it must work normally throughout the judging period (meaning we need it actually deployed live, not just runnable locally)
5. **Slides or document link**: technical architecture, implementation details, challenges encountered, future plans. **No page limit.**

### Scoring (weights consistent with Rules and Regulations.md; this is the framework given verbally by the organizers)
- Overall split into two blocks: **Technical 70 points + Product & Impact 30 points**
- Technical 70-point breakdown (= the preliminary-round weights from the earlier document):
  - Working Core Prototype: 25 points
  - System Design & Architecture: 15 points
  - Technology Integration: 15 points
  - Technical Feasibility & Validation: 15 points
- Product & Impact 30-point breakdown:
  - Problem Statement Understanding: 10 points
  - Innovation & Solution Approach: 10 points
  - Practical Value & Potential: 10 points
- **Accuracy is not a major scoring factor in the preliminary round** — the finals are where the system's accuracy gets tested against new, unseen emails. So during the preliminary round, "getting it working" matters more than "getting it precise," consistent with the strategy advice in TEAM_HANDBOOK.md section 3.

---

## 5. Live Q&A Highlights

- **Is there any restriction on AI usage?** None at all — use it however you like.
- **Is there an existing internal Averis workflow to reference, or do we design our own?** There's no fixed process you must copy — it can be agentic, agent-to-agent, or any design of your own, as long as it ultimately handles classification + intent understanding + comparison.
- **Who covers the cost of cloud infrastructure/AI services?** The organizers provide no budget; they encourage free/creative solutions and there's no need to consider paid upgrades.
- **How do we get the API key in the Docker package?** No definite answer was given live; the organizers said if one becomes available it will be distributed through official channels.
- **Does this involve HS codes (commodity codes)?** This wasn't answered live — recommended to follow up on Discord.
- **What exactly does "cloud infrastructure" mean — does it have to be AWS/GCP/Azure, and paid for out of pocket?** No — ordinary web hosting, Cloudflare, and Docker/Docker Compose all count.
- **Is there a fixed output format, and how is it scored (classification accuracy or mismatch detection)? Will it be tested with unseen emails?** The preliminary round doesn't focus much on accuracy; the finals will test with undisclosed emails.
- **Are the sample emails English-only, or will there be other languages?** The sample data is mostly English; additionally supporting Malay/Indonesian/Chinese is a bonus.
- **Is there a page limit for the docs/slides?** No, as long as it fits within the 5-minute demo video's timeframe.
- **Do we need an AI solution, and does UI/UX matter?** Having an AI component is the default expectation; the UI/UX form is free (many teams go with a chat interface) — what matters most is getting classification and comparison right, and giving the user feedback/a prompt when uncertain rather than pretending to be confident.

---

## 6. Direct Impact on Our Team / Recommended Actions

1. **CLAUDE.md has already been updated for this problem statement** — the suggested split into three modules, `classification` / `extraction` / `comparison`, is derived directly from the "three capabilities the system must have" above, and maps neatly onto the three of us each owning one.
2. **Something to do today**: have each of the three of us claim one of the modules above, and put our names into the "module owners" section of CLAUDE.md.
3. **Don't forget the "raise your hand for help" mechanism** — the organizers explicitly require the system to signal when it needs human intervention. This feature isn't much work by itself, but it's a capability the organizers specifically called out, so it should be on the preliminary round's core feature checklist — don't miss it.
4. **The finals date needs to be verified on Discord** (see the warning in section 2) — plan around 9/26 for now, and update the TEAM_HANDBOOK.md timeline once confirmed.
5. **Deployment can't be left until the last minute** — the submission requirements say "the publicly accessible prototype link must work throughout the judging period," which means we need it genuinely deployed live before 9/22 (not just runnable locally). It's recommended to set up the project skeleton on Vercel early and deploy continuously alongside development, rather than deploying for the first time on the last day.
