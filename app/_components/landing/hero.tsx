import Link from "next/link";
import type { Ref } from "react";
import { Icon } from "../icon";
import { QUICK_FACTS } from "./content";
import { ReportPreview } from "./report-preview";

/**
 * Scene 0, "The Fold". The headline is server-rendered and legible at scrollY = 0, no preloader.
 * The report card carries id="hero-report": the plane starts as a sheet of paper just behind it
 * and the flight path is anchored to wherever the layout puts it (see plane-rig.ts).
 */
export function Hero({ ref }: { ref?: Ref<HTMLElement> }) {
  return (
    <section ref={ref} className="scene-hero relative">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-20 pt-28 story:min-h-0 story:h-full story:pb-0 story:pt-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <span className="chip backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            Shipping document verification
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            Catch every Bill of Lading error <span className="text-gradient">before it&rsquo;s final.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
            Shipping Doc Verifier sorts your shipping inbox, reads the Shipping Instruction (SI) and draft Bill of Lading
            (BL) attachments, compares seven shipment fields, and shows exactly what doesn&rsquo;t match. When it
            can&rsquo;t be sure, it asks a person instead of guessing.
          </p>

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

          <ul className="mt-10 flex flex-wrap gap-2.5">
            {QUICK_FACTS.map((f) => (
              <li key={f.label} data-chip className="chip !px-3.5 !py-1.5">
                <Icon name={f.icon} size={14} className="text-accent-strong" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <div id="hero-report" className="min-w-0">
          <ReportPreview />
        </div>
      </div>
    </section>
  );
}
