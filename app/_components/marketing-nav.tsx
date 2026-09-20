"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "./brand-mark";
import { ThemeToggle } from "./theme-toggle";

const ANCHORS = [
  { href: "#capabilities", label: "Capabilities" },
  { href: "#formats", label: "Formats" },
  { href: "#access", label: "Web, API & MCP" },
  { href: "#reliability", label: "Reliability" },
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
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
      <div
        className={`card mx-auto flex max-w-6xl items-center justify-between !rounded-full px-4 py-2.5 transition-shadow duration-300 sm:px-5 ${
          scrolled ? "" : "!shadow-none"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <BrandMark />
          <span className="text-fg">Shipping Doc Verifier</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-fg-muted lg:flex">
          {ANCHORS.map((a) => (
            <a key={a.href} href={a.href} className="transition hover:text-fg">
              {a.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="hidden px-2 text-sm font-medium text-fg-muted transition hover:text-fg md:block">
            Sign in
          </Link>
          <Link href="/dashboard" className="btn btn-primary hidden !py-2 md:inline-flex">
            Open the app
            <span aria-hidden>→</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg md:hidden"
          >
            <span className="relative block h-3.5 w-4">
              <span className={`absolute left-0 top-0 h-0.5 w-4 bg-fg transition-transform ${open ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`absolute left-0 top-1.5 h-0.5 w-4 bg-fg transition-opacity ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 top-3 h-0.5 w-4 bg-fg transition-transform ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div className="card mx-auto mt-2 max-w-6xl p-4 md:hidden">
          <nav className="flex flex-col gap-1 text-sm font-medium text-fg">
            {ANCHORS.map((a) => (
              <a key={a.href} href={a.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-sunken">
                {a.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex gap-2">
            <Link href="/login" className="btn btn-glass flex-1">
              Sign in
            </Link>
            <Link href="/dashboard" className="btn btn-primary flex-1">
              Open the app
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
