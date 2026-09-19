"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearch } from "./search-context";

export type FeatureTile = {
  href: string;
  tag: string;
  title: string;
  desc: string;
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
      <div className="rounded-2xl border border-dashed border-hairline-dark p-10 text-center text-sm text-whisper/50">
        没有匹配“{query}”的功能模块，换个关键词试试。
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((tile) => (
        <Link
          key={tile.href}
          href={tile.href}
          className="group relative overflow-hidden rounded-2xl border border-hairline-dark bg-ink-soft p-7 transition hover:-translate-y-1.5 hover:border-indigo/50 hover:shadow-2xl hover:shadow-indigo/20"
        >
          <div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40"
            style={{ background: tile.accent }}
          />
          <div className="relative">
            <div className="font-mono text-[10px] uppercase tracking-widest text-halo/80">{tile.tag}</div>
            <h3 className="mt-3 text-xl font-bold text-white">{tile.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-whisper/60">{tile.desc}</p>
            <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-whisper/70 transition group-hover:text-halo">
              打开模块
              <span className="transition group-hover:translate-x-1 inline-block">→</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
