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

export const REST_SNIPPET = `curl -X POST https://<your-host>/features/classification/api \\
  -H "Content-Type: application/json" \\
  -d '{ "email_id": "email_004" }'`;

export const MCP_SNIPPET = `{
  "mcpServers": {
    "shipping-doc-verifier": {
      "url": "https://<your-host>/core/mcp-server"
    }
  }
}`;

export const MCP_TOOLS = [
  "classify_email",
  "extract_document_fields",
  "compare_documents",
  "run_batch",
  "list_results",
  "export_results",
];

export const SURFACES: { icon: IconName; title: string; text: string }[] = [
  { icon: "laptop", title: "Web app", text: "A responsive interface for operations teams. Works on desktop and phone browsers." },
  { icon: "code", title: "REST API", text: "Plain HTTP endpoints for classification, extraction, comparison, batch runs and results." },
  {
    icon: "plug",
    title: "MCP server",
    text: "The same capabilities as MCP tools, over streamable HTTP, for Claude Desktop and other AI agents.",
  },
];

export const ACCESS_INTRO = {
  eyebrow: "Use it your way",
  heading: "One engine, three ways in.",
  text: "The web app, the REST API and the MCP server all run the same verification logic, so a result is the same wherever you ask for it.",
  restNote: "Read endpoints are open. Anything that writes results needs an admin token; public batch runs are preview-only.",
};

export const RELIABILITY_INTRO = {
  eyebrow: "Reliability",
  headingLead: "Accurate answers, honest",
  headingEmphasis: "uncertainty",
  text: "Accuracy means finding the right requests and the right discrepancies without false alarms. Reliability means knowing when not to decide alone.",
  /** Same sentence as the hero paragraph's last line, used as the scene's pull quote */
  quote: "When it can't be sure, it asks a person instead of guessing.",
};

export const RELIABILITY_POINTS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "users",
    title: "Escalates instead of guessing",
    text: "Every uncertain case carries a reason and the source line it came from.",
  },
  {
    icon: "refresh",
    title: "Failures are visible, and retryable",
    text: "One bad document never stops a batch. Failed or degraded emails can be re-run in one click.",
  },
  {
    icon: "layers",
    title: "Fallback across models",
    text: "If one model fails, the next takes over. A rules-first engine keeps working with no API key at all.",
  },
  {
    icon: "shield",
    title: "Safe by default",
    text: "Reading is open, but writing results needs an admin token. Public runs are preview-only.",
  },
];

export const RELIABILITY_STATS = [
  { v: "520", l: "sample emails processed end to end" },
  { v: "100%", l: "category match in self-evaluation" },
  { v: "8", l: "documents processed in parallel, max" },
  { v: "7", l: "fields compared per document pair" },
];

export const MODELS = ["Gemini", "Claude", "ChatGPT", "DeepSeek", "LM Studio (local)", "Jev (structured decisions)"];

export const MODELS_COPY = {
  heading: "Choose your model",
  text: "Switch the language model per run. Deterministic rules go first and a model only steps in when they cannot settle a field. Local models run only where your own machine hosts them.",
};

export const DEPLOYMENTS: { icon: IconName; title: string; text: string }[] = [
  { icon: "cloud", title: "Cloud", text: "Deploy to Vercel with one push and share a public URL." },
  { icon: "laptop", title: "Local", text: "npm install, npm run dev. Works on any machine with Node.js." },
  { icon: "box", title: "Docker", text: "One image, one command. No Node.js needed on the host." },
];

export const DEPLOY_COPY = {
  heading: "Run it anywhere",
  text: "The same code runs in three places, configured only through environment variables.",
};

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
