import { Icon, type IconName } from "../icon";
import {
  CATEGORY_META,
  STATUS_META,
  TONE_CLASSES,
  providerTone,
  reasonLabel,
  type Tone,
} from "../../_lib/labels";
import type { ComparisonStatus, EmailCategory, ProcessingStatus } from "../../_lib/contracts";

const TONE_ICON: Record<Tone, IconName> = { ok: "checkCircle", bad: "xCircle", warn: "alert", info: "info", muted: "clock" };

export function Badge({ tone, icon, children, className = "" }: { tone: Tone; icon?: IconName; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}>
      <Icon name={icon ?? TONE_ICON[tone]} size={14} />
      {children}
    </span>
  );
}

/** Comparison outcome, or "Failed" / "Not processed" when there is no outcome to show. */
export function StatusBadge({ status, processing }: { status: ComparisonStatus | null; processing?: ProcessingStatus }) {
  if (processing === "failed") return <Badge tone="bad" icon="xCircle">Failed</Badge>;
  if (!status) return <Badge tone="muted" icon="clock">Not processed</Badge>;
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function CategoryBadge({ category }: { category: EmailCategory | null }) {
  if (!category) return <span className="text-xs text-fg-faint">—</span>;
  const meta = CATEGORY_META[category];
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

/**
 * How an answer was produced is an implementation detail, so nothing is shown for a normal result.
 * The one thing worth telling a person: a fallback answer was used because a step failed, and re-running may improve it.
 */
export function ProviderChip({ provider }: { provider: string | null }) {
  if (!provider || !provider.includes("degraded")) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[providerTone(provider)]}`}
      title="A step failed, so a fallback answer was used. Re-running it may give a better one."
    >
      <Icon name="alert" size={12} />
      Fallback answer
    </span>
  );
}

/** One line explaining why something needs a look, when the system gave a reason. */
export function ReasonNote({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return <span className="text-xs text-warn">{reasonLabel(reason)}</span>;
}
