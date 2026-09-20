"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Icon, type IconName } from "../../_components/icon";
import { useSearch } from "./search-context";

export type FeatureTile = {
  href: string;
  tag: string;
  title: string;
  desc: string;
  icon: IconName;
  accent: string;
};

export function FeatureGrid({ tiles }: { tiles: FeatureTile[] }) {
  const { query } = useSearch();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tiles;
    return tiles.filter(
      (t) => t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.tag.toLowerCase().includes(q)
    );
  }, [tiles, query]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line-strong p-10 text-center text-sm text-fg-muted">
        No modules match &ldquo;{query}&rdquo;. Try another keyword.
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((tile) => (
        <Link key={tile.href} href={tile.href} className="card card-hover group relative overflow-hidden p-7">
          <div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl transition group-hover:opacity-45"
            style={{ background: tile.accent }}
          />
          <div className="relative">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-royal text-white shadow-md">
                <Icon name={tile.icon} size={28} />
              </span>
              <div className="eyebrow">{tile.tag}</div>
            </div>
            <h3 className="mt-5 text-xl font-bold">{tile.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-fg-muted">{tile.desc}</p>
            <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-fg-muted transition group-hover:text-accent-strong">
              Open module
              <span className="inline-block transition group-hover:translate-x-1">→</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
