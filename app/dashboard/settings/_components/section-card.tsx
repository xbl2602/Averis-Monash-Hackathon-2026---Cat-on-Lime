import type { ReactNode } from "react";
import { Icon, type IconName } from "../../../_components/icon";

/** Titled card used for every settings section: big icon tile, heading, short explanation, then content. */
export function SectionCard({
  id,
  icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="card scroll-mt-24 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-royal text-white shadow-md">
          <Icon name={icon} size={28} />
        </span>
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">{description}</p>
        </div>
      </div>
      <div className="mt-6 divide-y divide-line">{children}</div>
    </section>
  );
}

/** One label + control row inside a section. */
export function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-md">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <p className="mt-1 text-xs leading-relaxed text-fg-muted">{hint}</p>}
      </div>
      <div className="min-w-0 sm:shrink-0">{children}</div>
    </div>
  );
}
