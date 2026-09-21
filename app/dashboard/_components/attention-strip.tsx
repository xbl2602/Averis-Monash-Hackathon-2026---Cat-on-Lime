import Link from "next/link";
import { Icon, type IconName } from "../../_components/icon";
import type { StatsSummary } from "../../_lib/contracts";

interface Item {
  key: string;
  href: string;
  icon: IconName;
  tone: string;
  title: string;
  detail: string;
  cta: string;
}

function buildItems(stats: StatsSummary): Item[] {
  const items: Item[] = [];
  if (stats.failed > 0) {
    items.push({
      key: "failed",
      href: "/features/verification#retry",
      icon: "refresh",
      tone: "bg-bad-soft text-bad",
      title: `${stats.failed} ${stats.failed === 1 ? "email" : "emails"} failed to process`,
      detail: "A model or file step broke. One click re-runs just these.",
      cta: "Retry them",
    });
  }
  if (stats.needs_review > 0) {
    items.push({
      key: "review",
      href: "/features/review",
      icon: "flag",
      tone: "bg-warn-soft text-warn",
      title: `${stats.needs_review} ${stats.needs_review === 1 ? "email needs" : "emails need"} a person`,
      detail: "The system was not sure. Confirm or correct each one.",
      cta: "Open the queue",
    });
  }
  if (stats.mismatch > 0) {
    items.push({
      key: "mismatch",
      href: "/features/results/conflicts",
      icon: "swap",
      tone: "bg-accent/12 text-accent-strong",
      title: `${stats.mismatch} ${stats.mismatch === 1 ? "BL differs" : "BLs differ"} from the SI`,
      detail: "See exactly which fields disagree, with the source line.",
      cta: "See the conflicts",
    });
  }
  if (stats.pending > 0) {
    items.push({
      key: "pending",
      href: "/features/verification",
      icon: "play",
      tone: "bg-sunken text-fg-muted",
      title: `${stats.pending} ${stats.pending === 1 ? "email has" : "emails have"} not been processed`,
      detail: "Run the pipeline to classify, extract and compare them.",
      cta: "Run the pipeline",
    });
  }
  return items;
}

/** "Needs your attention": only the things that actually need attention, each with the button that fixes it. */
export function AttentionStrip({ stats }: { stats: StatsSummary }) {
  const items = buildItems(stats);

  if (items.length === 0) {
    return (
      <div className="card animate-pop flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-soft text-ok">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path className="animate-draw" strokeDasharray="30" d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <div>
          <div className="text-sm font-bold">All clear</div>
          <div className="text-xs text-fg-muted">Everything has been processed and nothing is waiting for a person.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, i) => (
        <Link
          key={item.key}
          href={item.href}
          style={{ "--i": i } as React.CSSProperties}
          className="card card-hover animate-rise stagger group flex flex-col gap-3 p-5"
        >
          <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone}`}>
            <Icon name={item.icon} size={22} />
          </span>
          <div>
            <div className="text-sm font-bold">{item.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-fg-muted">{item.detail}</div>
          </div>
          <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-accent-strong">
            {item.cta}
            <Icon name="arrowRight" size={14} className="transition group-hover:translate-x-1" />
          </div>
        </Link>
      ))}
    </div>
  );
}
