"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/dashboard",
    label: "总览",
    icon: <path d="M4 12 12 4l8 8M6 10v10h12V10" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    href: "/features/verification",
    label: "完整流水线",
    icon: <path d="M6 4.5v15l13-7.5-13-7.5Z" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    href: "/features/classification",
    label: "邮件分类",
    icon: (
      <path
        d="M4 6h16v12H4V6Zm0 0 8 7 8-7"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/features/extraction",
    label: "字段抽取",
    icon: <path d="M5 5h14M5 10h14M5 15h9M5 20h5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    href: "/features/comparison",
    label: "比对确认",
    icon: (
      <path
        d="M8 4v12a2 2 0 0 0 2 2h6M4 8l4-4 4 4M20 16l-4 4-4-4"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    href: "/features/jev-lab",
    label: "Jev 验证",
    icon: (
      <path
        d="M9 3h6M10 3v5.2L5.5 17a2 2 0 0 0 1.8 2.9h9.4a2 2 0 0 0 1.8-2.9L14 8.2V3"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-hairline-dark bg-ink-soft transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <Link href="/" className="flex items-center gap-2 px-6 py-6 font-semibold text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo to-halo text-sm font-bold text-ink">
          航
        </span>
        <span className="text-sm">Shipping Doc Verifier</span>
      </Link>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-gradient-to-r from-indigo/25 to-halo/10 text-white"
                  : "text-whisper/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className={active ? "text-halo" : "text-whisper/50 group-hover:text-halo"}
              >
                {item.icon}
              </svg>
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-halo" />}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-hairline-dark px-3 py-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-whisper/60 transition hover:bg-white/5 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M15 18l-6-6 6-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          返回官网
        </Link>
        <Link
          href="/login"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-whisper/60 transition hover:bg-white/5 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          登录 / 注册（演示）
        </Link>
      </div>
    </aside>
  );
}
