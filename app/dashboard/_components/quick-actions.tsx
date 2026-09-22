"use client";

import Link from "next/link";
import { Icon, type IconName } from "../../_components/icon";
import { spotlightProps } from "../../_components/motion/use-spotlight";
import { Panel } from "./panel";

const ACTIONS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: "/features/verification", icon: "play", title: "Run verification", text: "Check a batch of emails" },
  { href: "/features/results", icon: "table", title: "Browse results", text: "Every email and its outcome" },
  { href: "/features/results/conflicts", icon: "swap", title: "See conflicts", text: "Where SI and BL differ" },
  { href: "/features/review", icon: "flag", title: "Review queue", text: "Settle the doubtful ones" },
  { href: "/features/sandbox", icon: "sparkles", title: "Try your own files", text: "Check any SI and BL" },
  { href: "/features/import", icon: "folder", title: "Upload documents", text: "Add files to the pool" },
];

const STEPS: { href: string; label: string }[] = [
  { href: "/features/classification", label: "Classify emails" },
  { href: "/features/extraction", label: "Extract fields" },
  { href: "/features/comparison", label: "Compare SI & BL" },
];

/** The six things people come here to do, as one compact grid, plus the three pipeline steps for using each on its own. */
export function QuickActions({ index }: { index: number }) {
  return (
    <Panel title="Start here" note="jump straight in" index={index}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ACTIONS.map((a, i) => (
          <Link
            key={a.href}
            href={a.href}
            {...spotlightProps()}
            style={{ "--i": i } as React.CSSProperties}
            className="spot animate-pop stagger group flex flex-col items-start gap-3 rounded-2xl border border-line bg-sunken p-4 transition duration-200 hover:-translate-y-0.5 hover:border-accent/50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-royal text-white shadow-md transition duration-300 group-hover:-rotate-6 group-hover:scale-110">
              <Icon name={a.icon} size={22} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold leading-snug">{a.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-fg-muted">{a.text}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-fg-faint">One step at a time</span>
        {STEPS.map((s) => (
          <Link key={s.href} href={s.href} className="chip transition hover:border-line-strong hover:text-fg">
            {s.label}
          </Link>
        ))}
      </div>
    </Panel>
  );
}
