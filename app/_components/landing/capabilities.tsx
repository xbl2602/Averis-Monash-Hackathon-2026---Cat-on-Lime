import { Icon, type IconName } from "../icon";
import { Reveal } from "../reveal";

const CAPABILITIES: { icon: IconName; step: string; title: string; text: string; points: string[] }[] = [
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

export function Capabilities() {
  return (
    <section id="capabilities" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
      <Reveal>
        <span className="eyebrow">What it does</span>
        <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          From email inbox to discrepancy report, in four steps.
        </h2>
        <p className="mt-4 max-w-2xl text-fg-muted">
          Run the whole pipeline on an inbox, or use each step on its own. Only document-comparison requests continue to
          the checking step; everything else is classified and left alone.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {CAPABILITIES.map((c, i) => (
          <Reveal key={c.step} delay={(i % 2) * 100}>
            <div className="card card-hover h-full p-7">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-royal text-white shadow-md">
                  <Icon name={c.icon} size={28} />
                </span>
                <div className="eyebrow">{c.step}</div>
              </div>
              <h3 className="mt-5 text-xl font-bold">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{c.text}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {c.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5">
                    <Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent-strong" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
