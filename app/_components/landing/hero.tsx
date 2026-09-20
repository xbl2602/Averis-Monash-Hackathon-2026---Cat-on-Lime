import Link from "next/link";
import { Icon } from "../icon";
import { OrbField } from "../orb-field";
import { Reveal } from "../reveal";
import { ReportPreview } from "./report-preview";

const QUICK_FACTS = [
  { icon: "mail", label: "5 email categories" },
  { icon: "compare", label: "7 fields compared" },
  { icon: "file", label: "PDF · Word · Excel · Text" },
  { icon: "plug", label: "Web · REST API · MCP" },
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <OrbField />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Reveal>
            <span className="chip backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Shipping document verification
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
              Catch every Bill of Lading error <span className="text-gradient">before it&rsquo;s final.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
              Shipping Doc Verifier sorts your shipping inbox, reads the Shipping Instruction (SI) and draft Bill of Lading
              (BL) attachments, compares seven shipment fields, and shows exactly what doesn&rsquo;t match. When it
              can&rsquo;t be sure, it asks a person instead of guessing.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="btn btn-primary !px-7 !py-3.5">
                Open the app
                <Icon name="arrowRight" size={16} />
              </Link>
              <a href="#capabilities" className="btn btn-glass !px-7 !py-3.5">
                See what it does
              </a>
            </div>
            <p className="mt-3 text-xs text-fg-faint">No sign-up needed to try the demo.</p>
          </Reveal>

          <Reveal delay={320}>
            <ul className="mt-10 flex flex-wrap gap-2.5">
              {QUICK_FACTS.map((f) => (
                <li key={f.label} className="chip !px-3.5 !py-1.5">
                  <Icon name={f.icon} size={14} className="text-accent-strong" />
                  {f.label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <ReportPreview />
        </Reveal>
      </div>
    </section>
  );
}
