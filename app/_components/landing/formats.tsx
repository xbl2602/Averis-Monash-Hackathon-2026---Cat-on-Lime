import { Icon, type IconName } from "../icon";
import { Reveal } from "../reveal";

const FORMATS: { icon: IconName; name: string; ext: string; note: string }[] = [
  { icon: "file", name: "PDF", ext: ".pdf", note: "Text-layer PDFs, including tables and multi-page layouts" },
  { icon: "file", name: "Word", ext: ".docx", note: "Documents and tables" },
  { icon: "table", name: "Excel", ext: ".xlsx", note: "Spreadsheet rows and columns" },
  { icon: "list", name: "Plain text", ext: ".txt", note: "Email bodies and text attachments" },
];

const MESSY_INPUTS = [
  { title: "Varied field labels", text: "\"Load Port\", \"Port of Loading\" and \"POL\" all map to the same field." },
  { title: "Formatting differences", text: "Case, punctuation, spacing and number formats do not raise false alarms." },
  { title: "Misleading subjects", text: "The message body and attachments decide the category, not just the subject line." },
  { title: "Missing attachments", text: "A comparison request without both documents is flagged, not guessed at." },
];

export function Formats() {
  return (
    <section id="formats" className="scroll-mt-24 border-y border-line bg-sunken">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2">
        <Reveal>
          <span className="eyebrow">Supported formats</span>
          <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">Bring the documents you already have.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FORMATS.map((f) => (
              <div key={f.name} className="card flex items-start gap-4 p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-accent-strong">
                  <Icon name={f.icon} size={24} />
                </span>
                <div>
                  <div className="font-bold">
                    {f.name} <span className="font-mono text-xs font-medium text-fg-faint">{f.ext}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">{f.note}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-warn-soft p-4 text-sm">
            <Icon name="scan" size={22} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-fg-muted">
              <strong className="text-fg">Scanned or image-only files</strong> cannot be read reliably yet. They are set
              aside for human review rather than guessed at.
            </p>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <span className="eyebrow">Messy real-world input</span>
          <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
            Tell a real discrepancy from a formatting quirk.
          </h2>
          <ul className="mt-8 space-y-3">
            {MESSY_INPUTS.map((m) => (
              <li key={m.title} className="card flex items-start gap-4 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
                  <Icon name="check" size={18} />
                </span>
                <div>
                  <div className="font-semibold">{m.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-fg-muted">{m.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
