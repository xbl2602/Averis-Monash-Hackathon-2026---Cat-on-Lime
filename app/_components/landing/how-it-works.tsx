import { Reveal } from "../reveal";

const STEPS = [
  { step: "01", title: "Sort the inbox", text: "Each email is classified. Spam and general messages stop here; document requests move on." },
  { step: "02", title: "Read both documents", text: "The SI and draft BL attachments are parsed and the seven fields are extracted from each." },
  { step: "03", title: "Get the report", text: "Mismatches appear side by side. Anything uncertain is flagged for a person, with evidence." },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20">
      <Reveal>
        <span className="eyebrow">How it works</span>
        <h2 className="mt-3 text-3xl font-bold sm:text-4xl">From inbox to answer in three steps.</h2>
      </Reveal>
      <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
        <div className="absolute left-0 right-0 top-6 hidden h-px bg-line sm:block" />
        {STEPS.map((s, i) => (
          <Reveal key={s.step} delay={i * 120}>
            <div className="relative">
              <div className="card flex h-12 w-12 items-center justify-center !rounded-full font-mono text-sm font-bold text-accent-strong">
                {s.step}
              </div>
              <h3 className="mt-4 font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
