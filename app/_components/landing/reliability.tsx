import { Icon, type IconName } from "../icon";
import { OrbField } from "../orb-field";
import { Reveal } from "../reveal";

const POINTS: { icon: IconName; title: string; text: string }[] = [
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

const STATS = [
  { v: "520", l: "sample emails processed end to end" },
  { v: "100%", l: "category match in self-evaluation" },
  { v: "8", l: "documents processed in parallel, max" },
  { v: "7", l: "fields compared per document pair" },
];

export function Reliability() {
  return (
    <section id="reliability" className="band relative scroll-mt-24 overflow-hidden bg-band py-24 text-white">
      <OrbField tone="dark" />
      <div className="relative mx-auto max-w-6xl px-5">
        <Reveal>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-halo">Reliability</span>
          <h2 className="mt-4 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Accurate answers, honest <span className="text-gradient">uncertainty</span>.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-whisper">
            Accuracy means finding the right requests and the right discrepancies without false alarms. Reliability
            means knowing when not to decide alone.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <div className="flex h-full items-start gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-halo">
                  <Icon name={p.icon} size={24} />
                </span>
                <div>
                  <h3 className="font-bold">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-whisper/80">{p.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={150}>
          <div className="mt-12 grid grid-cols-2 gap-8 border-t border-white/10 pt-8 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l}>
                <div className="text-3xl font-bold">{s.v}</div>
                <div className="mt-1 text-xs text-whisper/70">{s.l}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
