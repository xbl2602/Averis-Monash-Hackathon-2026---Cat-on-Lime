import type { IconName } from "../icon";

/**
 * All landing-page copy lives here, moved unchanged out of the old section components.
 * The scenes only decide WHERE each piece appears; they never rewrite it.
 */

export const QUICK_FACTS: { icon: IconName; label: string }[] = [
  { icon: "mail", label: "5 email categories" },
  { icon: "compare", label: "7 fields compared" },
  { icon: "file", label: "PDF · Word · Excel · Text" },
  { icon: "plug", label: "Web · REST API · MCP" },
];

/** The four capabilities, one per scene (Classify → Inbox, Extract → Scanner, Compare → Comparison, Ask → Handoff) */
export const CAPABILITIES: { icon: IconName; step: string; title: string; text: string; points: string[] }[] = [
  {
    icon: "mail",
    step: "01 · Classify",
    title: "Find the requests that matter",
    text: "Every message in the inbox is sorted by intent, so a document check never gets buried.",
    points: ["Document-comparison requests", "New SI requests", "Invoice queries", "General messages", "Spam"],
  },
  {
    icon: "list",
    step: "02 · Extract",
    title: "Read the fields, whatever they are called",
    text: "Pulls the shipment details out of the email body and its SI and BL attachments.",
    points: [
      "Shipper, consignee, notify party",
      "Port of loading and discharge",
      "Container count",
      "Gross weight in kg",
      "\"Load Port\" = \"Port of Loading\"",
    ],
  },
  {
    icon: "compare",
    step: "03 · Compare",
    title: "SI against BL, side by side",
    text: "The SI is the reference. Every mismatch shows both values, so the fix is obvious.",
    points: [
      "Seven fields checked",
      "SI and BL values side by side",
      "Formatting noise is ignored",
      "\"No mismatch detected\" when clean",
    ],
  },
  {
    icon: "users",
    step: "04 · Ask for help",
    title: "Hand it to a person when unsure",
    text: "Unreadable file, missing value or low confidence: the case goes to review, not into a guess.",
    points: ["Reason for the escalation", "Source line as evidence", "Missing attachments flagged", "Failures stay visible, with retry"],
  },
];

export const CAPABILITIES_INTRO = {
  eyebrow: "What it does",
  heading: "From email inbox to discrepancy report, in four steps.",
  text: "Run the whole pipeline on an inbox, or use each step on its own. Only document-comparison requests continue to the checking step; everything else is classified and left alone.",
};

export const FORMATS: { icon: IconName; name: string; ext: string; note: string }[] = [
  { icon: "file", name: "PDF", ext: ".pdf", note: "Text-layer PDFs, including tables and multi-page layouts" },
  { icon: "file", name: "Word", ext: ".docx", note: "Documents and tables" },
  { icon: "table", name: "Excel", ext: ".xlsx", note: "Spreadsheet rows and columns" },
  { icon: "list", name: "Plain text", ext: ".txt", note: "Email bodies and text attachments" },
];

export const FORMATS_INTRO = {
  eyebrow: "Supported formats",
  heading: "Bring the documents you already have.",
};

export const SCANNED_WARNING = {
  strong: "Scanned or image-only files",
  rest: "cannot be read reliably yet. They are set aside for human review rather than guessed at.",
};

export const MESSY_INPUTS: { title: string; text: string }[] = [
  { title: "Varied field labels", text: "\"Load Port\", \"Port of Loading\" and \"POL\" all map to the same field." },
  { title: "Formatting differences", text: "Case, punctuation, spacing and number formats do not raise false alarms." },
  { title: "Misleading subjects", text: "The message body and attachments decide the category, not just the subject line." },
  { title: "Missing attachments", text: "A comparison request without both documents is flagged, not guessed at." },
];

export const MESSY_INTRO = {
  eyebrow: "Messy real-world input",
  heading: "Tell a real discrepancy from a formatting quirk.",
};

export const SURFACES: { icon: IconName; title: string; text: string }[] = [
  { icon: "laptop", title: "Web app", text: "Made for operations teams. Works on desktop and on your phone." },
  { icon: "code", title: "REST API", text: "Send documents from your own systems and get the same verdict back." },
  { icon: "plug", title: "MCP server", text: "Let an AI assistant such as Claude run the same checks for you." },
];

export const ACCURACY_INTRO = {
  eyebrow: "Measured accuracy",
  heading: "Tested against the answer key, not just promised.",
  text: "Every one of the organisers’ 520 sample emails was run through the real system, and each verdict was compared with the official answer.",
};

export const ACCESS_INTRO = {
  eyebrow: "Use it your way",
  heading: "One check, three ways in.",
  text: "Use the web app with your team, or connect other software and AI assistants. A result is the same wherever you ask for it.",
};

export const RELIABILITY_INTRO = {
  eyebrow: "Reliability",
  headingLead: "Accurate answers, honest",
  headingEmphasis: "uncertainty",
  text: "Accuracy means finding the right requests and the right discrepancies without false alarms. Reliability means knowing when not to decide alone.",
  /** Same sentence as the hero paragraph"s last line, used as the scene"s pull quote */
  quote: "When it can't be sure, it asks a person instead of guessing.",
};

export const RELIABILITY_POINTS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "users",
    title: "Escalates instead of guessing",
    text: "Every uncertain case carries a reason and the source line it came from.",
  },
  {
    icon: "flag",
    title: "Every decision is recorded",
    text: "Confirm, correct or set aside. Each action is logged and can be undone.",
  },
  {
    icon: "refresh",
    title: "Failures stay visible",
    text: "One bad document never stops a batch, and failed emails re-run in one click.",
  },
  {
    icon: "shield",
    title: "Changes need permission",
    text: "Anyone can look. Only authorised people can save, review or upload.",
  },
];

/** Scene 5: what the user gets once the check has run. Every item is a page that exists in the app. */
export const WORKSPACE_INTRO = {
  eyebrow: "Your workspace",
  heading: "Everything after the check, in one place.",
  text: "Look up any result, see exactly where two documents disagree, settle the doubtful ones and export a file you can trust.",
};

export type WorkspaceKey = "results" | "conflicts" | "review" | "export" | "sandbox" | "documents";

export const WORKSPACE_FEATURES: { key: WorkspaceKey; icon: IconName; title: string; text: string; href: string }[] = [
  {
    key: "results",
    icon: "table",
    title: "Every result, searchable",
    text: "Filter by outcome or category, then open a row to see the SI and BL side by side with the source line of each value.",
    href: "/features/results",
  },
  {
    key: "conflicts",
    icon: "swap",
    title: "Conflicts at a glance",
    text: "The differing characters are marked, numbers can be matched with a tolerance, and a fix request is one click to copy.",
    href: "/features/results/conflicts",
  },
  {
    key: "review",
    icon: "flag",
    title: "Review in one click",
    text: "Confirm, correct, set aside or re-run. Every action is recorded and can be undone.",
    href: "/features/review",
  },
  {
    key: "export",
    icon: "shield",
    title: "Export you can trust",
    text: "Before you submit, a checklist tells you whether anything is missing, out of date or contradictory.",
    href: "/features/results",
  },
  {
    key: "sandbox",
    icon: "sparkles",
    title: "Try your own files",
    text: "Drop in any SI and BL and get a verdict in seconds. Nothing is saved.",
    href: "/features/sandbox",
  },
  {
    key: "documents",
    icon: "folder",
    title: "Upload documents",
    text: "Add files or a whole folder. Each one is identified by what is inside it, not by its name.",
    href: "/features/import",
  },
];

export const HOW_IT_WORKS = {
  eyebrow: "How it works",
  heading: "From inbox to answer in three steps.",
  steps: [
    { step: "01", title: "Sort the inbox", text: "Each email is classified. Spam and general messages stop here; document requests move on." },
    { step: "02", title: "Read both documents", text: "The SI and draft BL attachments are parsed and the seven fields are extracted from each." },
    { step: "03", title: "Get the report", text: "Mismatches appear side by side. Anything uncertain is flagged for a person, with evidence." },
  ],
};

/** The demo data used by the hero card and the comparison scene (booking 4471, SI 3 / BL 4) */
export const REPORT = {
  eyebrow: "Discrepancy report",
  subject: "Please check draft BL for booking 4471",
  badge: "1 mismatch",
  rows: [
    { field: "Shipper", si: "Pacific Fine Paper Ltd", bl: "Pacific Fine Paper Ltd", ok: true },
    { field: "Consignee", si: "Northwind Trading GmbH", bl: "Northwind Trading GmbH", ok: true },
    { field: "Notify party", si: "Northwind Logistics", bl: "Northwind Logistics", ok: true },
    { field: "Port of loading", si: "Singapore", bl: "SINGAPORE", ok: true },
    { field: "Port of discharge", si: "Hamburg", bl: "Hamburg", ok: true },
    { field: "Container count", si: "3", bl: "4", ok: false },
    { field: "Gross weight (kg)", si: "22,000", bl: "22,000", ok: true },
  ],
  flag: "Flag: Container count — SI: 3 / BL: 4",
  formattingNote:
    "Formatting differences like \"Singapore\" vs \"SINGAPORE\" are not flagged.",
  casingCallout: "Singapore vs SINGAPORE — formatting, not a mismatch",
};
