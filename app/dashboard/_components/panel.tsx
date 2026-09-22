import type { CSSProperties, ReactNode } from "react";

/** The titled card every overview section sits in. Equal-height when placed in a grid row. */
export function Panel({
  title,
  note,
  index = 0,
  className = "",
  children,
}: {
  title: string;
  note?: string;
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`card animate-rise stagger flex h-full min-w-0 flex-col p-5 sm:p-6 ${className}`} style={{ "--i": index } as CSSProperties}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold">{title}</h2>
        {note && <span className="text-xs text-fg-faint">{note}</span>}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}
