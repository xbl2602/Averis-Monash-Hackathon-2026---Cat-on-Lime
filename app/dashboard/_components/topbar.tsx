"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../_components/icon";
import { ThemeToggle } from "../../_components/theme-toggle";
import { AdminChip } from "../../_components/admin/admin-chip";
import { pageTitle } from "./nav-items";
import { useSearch } from "./search-context";

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { query, setQuery } = useSearch();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Module search only filters the overview grid, so it is shown there and nowhere else
  const showSearch = pathname === "/dashboard";

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-header px-4 py-3 backdrop-blur-xl sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-muted transition hover:bg-sunken hover:text-fg lg:hidden"
      >
        <Icon name="menu" size={22} />
      </button>

      {showSearch ? (
        <div className="relative max-w-md flex-1">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-faint"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search modules (classify, extract, compare)"
            aria-label="Search modules"
            className="field !py-2.5 !pl-11"
          />
        </div>
      ) : (
        <div className="flex-1 truncate text-sm font-semibold text-fg-muted">
          {pageTitle(pathname)}
        </div>
      )}

      <Link
        href="/features/verification"
        className="btn btn-glass hidden !py-2 sm:inline-flex"
      >
        <Icon name="play" size={16} />
        Run pipeline
      </Link>

      <AdminChip />

      <ThemeToggle />

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-full border border-line bg-sunken py-1 pl-1 pr-3 text-sm text-fg transition hover:border-line-strong"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-royal text-white">
            <Icon name="user" size={16} />
          </span>
          <span className="hidden sm:inline">Demo account</span>
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-line bg-surface-solid py-1 shadow-xl"
          >
            <div className="border-b border-line px-4 py-3">
              <div className="text-sm font-semibold">Demo account</div>
              <div className="mt-0.5 text-xs text-fg-faint">demo@shipping-doc.local</div>
            </div>
            <Link
              href="/dashboard/settings"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-fg-muted hover:bg-sunken hover:text-fg"
            >
              <Icon name="gear" size={18} />
              Settings
            </Link>
            <Link
              href="/login"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-fg-muted hover:bg-sunken hover:text-fg"
            >
              <Icon name="logout" size={18} />
              Sign out
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
