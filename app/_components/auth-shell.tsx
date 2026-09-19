import Link from "next/link";
import type { ReactNode } from "react";
import { OrbField } from "./orb-field";

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
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-ink px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <OrbField tone="dark" />
        <Link href="/" className="relative z-10 flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo to-halo text-sm font-bold text-ink">
            航
          </span>
          Shipping Doc Verifier
        </Link>
        <div className="relative z-10">
          <span className="font-mono text-[11px] uppercase tracking-widest text-halo">{eyebrow}</span>
          <h1 className="mt-4 whitespace-pre-line text-4xl font-extrabold leading-tight">{title}</h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-whisper">{subtitle}</p>
        </div>
        <p className="relative z-10 text-xs text-whisper/50">
          © 2026 Averis × Monash Hackathon Team
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
