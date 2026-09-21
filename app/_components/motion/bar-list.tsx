"use client";

import Link from "next/link";
import { useReady } from "./use-ready";

export interface BarItem {
  key: string;
  label: string;
  value: number;
  color?: string;
  href?: string;
}

/** Horizontal bars that grow in one after another. Each row can link somewhere (e.g. a filtered results view). */
export function BarList({ items, empty = "Nothing to show yet." }: { items: BarItem[]; empty?: string }) {
  const ready = useReady();
  const max = Math.max(1, ...items.map((item) => item.value));

  if (items.length === 0) return <p className="py-6 text-center text-sm text-fg-faint">{empty}</p>;

  return (
    <ul className="space-y-3" data-ready={ready}>
      {items.map((item, i) => {
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{item.label}</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-fg-muted">{item.value.toLocaleString("en-US")}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-sunken">
              <div
                className="bar-fill h-full rounded-full"
                style={{ width: `${(item.value / max) * 100}%`, background: item.color ?? "var(--accent)", "--i": i } as React.CSSProperties}
              />
            </div>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className="group block rounded-xl p-1 -m-1 transition hover:bg-sunken">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
