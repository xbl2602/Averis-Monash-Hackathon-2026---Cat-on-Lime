"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearch } from "./search-context";

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { query, setQuery } = useSearch();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-hairline-dark bg-ink/90 px-4 py-3 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="切换侧边栏"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-whisper/70 transition hover:bg-white/5 hover:text-white lg:hidden"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 6h16M4 12h16M4 18h16" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <div className="relative flex-1 max-w-md">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-whisper/40"
        >
          <circle cx="11" cy="11" r="7" strokeWidth="1.6" />
          <path d="m20 20-3-3" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="搜索功能模块…（分类 / 抽取 / 比对）"
          className="w-full rounded-full border border-hairline-dark bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder:text-whisper/35 outline-none transition focus:border-indigo/60 focus:ring-2 focus:ring-indigo/20"
        />
      </div>

      <Link
        href="/features/verification"
        className="hidden items-center gap-1.5 rounded-full border border-hairline-dark px-4 py-2 text-sm font-medium text-whisper/80 transition hover:border-indigo/50 hover:text-white sm:flex"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 4v16M4 12h16" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        探索
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-hairline-dark py-1 pl-1 pr-3 text-sm text-white transition hover:border-indigo/50"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo to-halo text-xs font-bold text-ink">
            演
          </span>
          <span className="hidden sm:inline">演示账户</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-11 w-44 overflow-hidden rounded-xl border border-hairline-dark bg-ink-soft py-1 shadow-xl">
            <div className="px-3 py-2 text-xs text-whisper/50">demo@shipping-doc.local</div>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-sm text-whisper/80 hover:bg-white/5 hover:text-white"
            >
              退出登录
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
