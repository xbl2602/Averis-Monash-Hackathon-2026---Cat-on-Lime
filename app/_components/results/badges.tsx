import { Icon, type IconName } from "../icon";
import {
  CATEGORY_META,
  STATUS_META,
  TONE_CLASSES,
  engineSummary,
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

/** The "model_provider" tag as a small chip; degraded runs are called out in amber. */
export function ProviderChip({ provider }: { provider: string | null }) {
  if (!provider) return null;
  const tone = providerTone(provider);
  const degraded = provider.includes("degraded");
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[11px] ${TONE_CLASSES[tone]}`} title={degraded ? `A model step failed, so a fallback answer was used. Re-run to retry. (${provider})` : `Engine tag: ${provider}`}>
      {degraded && <Icon name="alert" size={12} />}
      {engineSummary(provider)}
    </span>
  );
}

/** One line explaining why something needs a look, when the system gave a reason. */
export function ReasonNote({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return <span className="text-xs text-warn">{reasonLabel(reason)}</span>;
}
