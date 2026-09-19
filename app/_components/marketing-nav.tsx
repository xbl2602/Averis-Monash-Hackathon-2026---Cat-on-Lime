"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const ANCHORS = [
  { href: "#product", label: "产品" },
  { href: "#about", label: "关于我们" },
  { href: "#contact", label: "联系我们" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-hairline bg-paper/80 backdrop-blur-md shadow-[0_1px_0_0_rgba(20,14,40,0.04)]"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo to-royal text-sm font-bold text-white shadow-sm">
            航
          </span>
          <span className="text-ink">
            Shipping Doc <span className="text-gradient">Verifier</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-ink/70 md:flex">
          {ANCHORS.map((a) => (
            <a key={a.href} href={a.href} className="transition hover:text-ink">
              {a.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-ink/70 transition hover:text-ink"
          >
            登录
          </Link>
          <Link
            href="/dashboard"
            className="group relative overflow-hidden rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-indigo/30"
          >
            <span className="relative z-10">进入系统 →</span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-indigo to-royal transition-transform duration-300 group-hover:translate-x-0" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="打开菜单"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-ink md:hidden"
        >
          <span className="relative block h-3.5 w-4">
            <span
              className={`absolute left-0 top-0 h-0.5 w-4 bg-ink transition-transform ${open ? "translate-y-1.5 rotate-45" : ""}`}
            />
            <span className={`absolute left-0 top-1.5 h-0.5 w-4 bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
            <span
              className={`absolute left-0 top-3 h-0.5 w-4 bg-ink transition-transform ${open ? "-translate-y-1.5 -rotate-45" : ""}`}
            />
          </span>
        </button>
      </div>

      {open && (
        <div className="border-t border-hairline bg-paper px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1 text-sm font-medium text-ink/80">
            {ANCHORS.map((a) => (
              <a key={a.href} href={a.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 hover:bg-veil">
                {a.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex gap-2">
            <Link
              href="/login"
              className="flex-1 rounded-full border border-hairline px-4 py-2 text-center text-sm font-medium text-ink"
            >
              登录
            </Link>
            <Link
              href="/dashboard"
              className="flex-1 rounded-full bg-ink px-4 py-2 text-center text-sm font-semibold text-white"
            >
              进入系统
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
