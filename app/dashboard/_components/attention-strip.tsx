import Link from "next/link";
import { Icon, type IconName } from "../../_components/icon";
import type { StatsSummary } from "../../_lib/contracts";
import { Panel } from "./panel";

interface Row {
  key: string;
  href: string;
  icon: IconName;
  tone: string;
  count: number;
  /** Shown when there is something to do / when there is nothing */
  todo: { title: string; detail: string };
  clear: { title: string; detail: string };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function buildRows(stats: StatsSummary): Row[] {
  return [
    {
      key: "failed",
      href: "/features/verification#retry",
      icon: "refresh",
      tone: "bg-bad-soft text-bad",
      count: stats.failed,
      todo: { title: `${stats.failed} failed to process`, detail: "Re-run just these in one click" },
      clear: { title: "Nothing failed", detail: "Every email was processed" },
    },
    {
      key: "review",
      href: "/features/review",
      icon: "flag",
      tone: "bg-warn-soft text-warn",
      count: stats.needs_review,
      todo: { title: `${stats.needs_review} ${plural(stats.needs_review, "needs", "need")} a person`, detail: "Confirm or correct each one" },
      clear: { title: "No one needs to look", detail: "Nothing is waiting for review" },
    },
    // Only exists once the server counts unsure classifications (see _lib/backend-contract.ts); until then the panel keeps its four rows
    ...(typeof stats.classification_needs_review === "number"
      ? [
          {
            key: "classifier",
            href: "/features/results?classification_review=true",
            icon: "mail" as IconName,
            tone: "bg-warn-soft text-warn",
            count: stats.classification_needs_review,
            todo: { title: `${stats.classification_needs_review} ${plural(stats.classification_needs_review, "email", "emails")} the classifier was unsure about`, detail: "Check the category was right" },
            clear: { title: "The classifier was sure of every email", detail: "No category is in doubt" },
          },
        ]
      : []),
    {
      key: "mismatch",
      href: "/features/results/conflicts",
      icon: "swap",
      tone: "bg-accent/12 text-accent-strong",
      count: stats.mismatch,
      todo: { title: `${stats.mismatch} ${plural(stats.mismatch, "BL differs", "BLs differ")} from the SI`, detail: "See which fields, and where they came from" },
      clear: { title: "Every BL matches its SI", detail: "No conflicts found" },
    },
    {
      key: "pending",
      href: "/features/verification",
      icon: "play",
      tone: "bg-sunken text-fg-muted",
      count: stats.pending,
      todo: { title: `${stats.pending} not checked yet`, detail: "Run a verification to cover them" },
      clear: { title: "Everything is checked", detail: "The whole inbox has been through" },
    },
  ];
}

/**
 * "Needs your attention": the four things that can be waiting, in a fixed order, so the panel always reads the
 * same way. A row with something to do is coloured and leads to the page that fixes it; a row with nothing to do
 * turns green and says so.
 */
export function AttentionList({ stats, index }: { stats: StatsSummary; index: number }) {
  const rows = buildRows(stats);
  const open = rows.filter((r) => r.count > 0).length;

  return (
    <Panel title="Needs your attention" note={open > 0 ? `${open} to look at` : "all clear"} index={index}>
      <ul className="flex h-full flex-col justify-between gap-2.5">
        {rows.map((row, i) => {
          const todo = row.count > 0;
          const text = todo ? row.todo : row.clear;
          return (
            <li key={row.key} style={{ "--i": i } as React.CSSProperties} className="animate-rise stagger flex-1">
              <Link
                href={row.href}
                className={`group flex h-full min-h-[4.5rem] items-center gap-3.5 rounded-2xl border p-3.5 transition duration-200 hover:border-line-strong ${
                  todo ? "border-line bg-sunken hover:bg-surface-solid" : "border-transparent bg-ok-soft/50"
                }`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${todo ? row.tone : "bg-ok-soft text-ok"}`}>
                  <Icon name={todo ? row.icon : "checkCircle"} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug">{text.title}</span>
                  <span className="block text-xs leading-snug text-fg-muted">{text.detail}</span>
                </span>
                <Icon name="arrowRight" size={16} className="shrink-0 text-fg-faint transition group-hover:translate-x-1 group-hover:text-accent-strong" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
