import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

const TONES = {
  info: { icon: "help", box: "border-line bg-sunken", iconColor: "text-accent-strong" },
  warn: { icon: "alert", box: "border-line bg-warn-soft", iconColor: "text-warn" },
  bad: { icon: "alert", box: "border-line bg-bad-soft", iconColor: "text-bad" },
  ok: { icon: "check", box: "border-line bg-ok-soft", iconColor: "text-ok" },
} satisfies Record<string, { icon: IconName; box: string; iconColor: string }>;

/** Inline message box: info / warning / error / success, with an icon. */
export function Notice({ tone = "info", title, children }: { tone?: keyof typeof TONES; title?: string; children?: ReactNode }) {
  const t = TONES[tone];
  return (
    <div role={tone === "bad" ? "alert" : undefined} className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${t.box}`}>
      <Icon name={t.icon} size={22} className={`mt-0.5 shrink-0 ${t.iconColor}`} />
      <div className="min-w-0 text-fg-muted">
        {title && <div className="font-semibold text-fg">{title}</div>}
        {children && <div className={title ? "mt-1" : ""}>{children}</div>}
      </div>
    </div>
  );
}
