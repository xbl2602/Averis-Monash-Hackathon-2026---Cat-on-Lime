import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "./brand-mark";
import { OrbField } from "./orb-field";
import { ThemeToggle } from "./theme-toggle";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* The brand panel stays dark in both themes */}
      <div className="relative hidden overflow-hidden bg-ink px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <OrbField tone="dark" />
        <Link href="/" className="relative z-10 flex items-center gap-2.5 font-semibold">
          <BrandMark className="h-9 w-9" />
          Shipping Doc Verifier
        </Link>
        <div className="relative z-10">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-halo">{eyebrow}</span>
          <h1 className="mt-4 whitespace-pre-line text-4xl font-extrabold leading-tight">{title}</h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-whisper">{subtitle}</p>
        </div>
        <p className="relative z-10 text-xs text-whisper/50">© 2026 Shipping Doc Verifier</p>
      </div>

      <div className="relative flex items-center justify-center px-6 py-16">
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
