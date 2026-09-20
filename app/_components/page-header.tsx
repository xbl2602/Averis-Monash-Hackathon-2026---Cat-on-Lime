import type { ReactNode } from "react";

/** Standard title block for every dashboard / feature page. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
