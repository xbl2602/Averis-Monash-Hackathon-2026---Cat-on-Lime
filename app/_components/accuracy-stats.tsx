"use client";

import { ACCURACY_HANDOVER, ACCURACY_SCOPE_NOTE, ACCURACY_STATS } from "../_lib/accuracy";
import { Icon } from "./icon";
import { CountUp } from "./motion/count-up";

/**
 * The measured-accuracy figures, in two sizes: "landing" (big, for the marketing page, each tile scrolls in)
 * and "app" (compact, for the dashboard). Both read the same numbers and both say what they were measured on.
 */
export function AccuracyStats({ variant }: { variant: "landing" | "app" }) {
  const big = variant === "landing";
  return (
    <div>
      <ul className={`grid gap-4 ${big ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"}`}>
        {ACCURACY_STATS.map((stat, i) => (
          <li
            key={stat.key}
            {...(big ? { "data-rise": true, "data-avoid": true } : {})}
            style={{ "--i": i } as React.CSSProperties}
            className={`${big ? "card p-6" : "rounded-2xl border border-line bg-sunken p-4"} ${big ? "" : "animate-rise stagger"}`}
          >
            <div className={`font-extrabold leading-none ${big ? "text-4xl sm:text-5xl" : "text-3xl"}`}>
              <CountUp value={stat.value} whenVisible={big} duration={1400} />
              {stat.suffix && <span className={`font-bold text-fg-muted ${big ? "text-2xl sm:text-3xl" : "text-xl"}`}>{stat.suffix}</span>}
            </div>
            <div className={`mt-3 font-semibold leading-snug ${big ? "text-sm" : "text-[13px]"}`}>{stat.label}</div>
            {big && <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{stat.detail}</p>}
          </li>
        ))}
      </ul>

      <div className={`mt-5 flex flex-wrap items-start gap-x-6 gap-y-2 ${big ? "text-sm" : "text-xs"}`}>
        <p className="flex items-start gap-2 font-medium">
          <Icon name="users" size={big ? 18 : 15} className="mt-0.5 shrink-0 text-accent-strong" />
          {ACCURACY_HANDOVER}
        </p>
        <p className="flex min-w-0 flex-1 basis-72 items-start gap-2 text-fg-muted">
          <Icon name="info" size={big ? 18 : 15} className="mt-0.5 shrink-0 text-fg-faint" />
          {ACCURACY_SCOPE_NOTE}
        </p>
      </div>
    </div>
  );
}
