"use client";

import { Icon } from "./icon";

/** "Showing 26–50 of 520" with previous / next and a short window of page numbers. */
export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  if (total <= 0) return null;
  const pages = Math.ceil(total / limit);
  const page = Math.floor(offset / limit);
  const from = offset + 1;
  const to = Math.min(total, offset + limit);

  const window = new Set<number>([0, pages - 1, page - 1, page, page + 1]);
  const numbers = [...window].filter((n) => n >= 0 && n < pages).sort((a, b) => a - b);

  return (
    <nav aria-label="Pages" className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <div className="text-xs text-fg-muted">
        Showing <span className="font-semibold text-fg">{from.toLocaleString("en-US")}–{to.toLocaleString("en-US")}</span> of {total.toLocaleString("en-US")}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page === 0} onClick={() => onChange(Math.max(0, offset - limit))} aria-label="Previous page" className="flex h-9 w-9 items-center justify-center rounded-full text-fg-muted transition hover:bg-sunken disabled:opacity-30">
          <Icon name="arrowLeft" size={18} />
        </button>
        {numbers.map((n, i) => (
          <span key={n} className="flex items-center">
            {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1 text-fg-faint">…</span>}
            <button
              type="button"
              onClick={() => onChange(n * limit)}
              aria-current={n === page ? "page" : undefined}
              className={`h-9 min-w-9 rounded-full px-3 text-xs font-semibold tabular-nums transition ${n === page ? "bg-accent text-white" : "text-fg-muted hover:bg-sunken"}`}
            >
              {n + 1}
            </button>
          </span>
        ))}
        <button type="button" disabled={page >= pages - 1} onClick={() => onChange(offset + limit)} aria-label="Next page" className="flex h-9 w-9 items-center justify-center rounded-full text-fg-muted transition hover:bg-sunken disabled:opacity-30">
          <Icon name="arrowRight" size={18} />
        </button>
      </div>
    </nav>
  );
}
