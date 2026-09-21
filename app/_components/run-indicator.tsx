"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { useRunningJobs } from "./run-status";

function elapsed(startedAt: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/**
 * Sits in the top bar while something long is running, on every page. Without it a run is only
 * visible on the page that started it, so leaving that page looks exactly like never having started.
 */
export function RunIndicator() {
  const jobs = useRunningJobs();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (jobs.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [jobs.length]);

  if (jobs.length === 0) return null;

  const job = jobs[0];
  const label = jobs.length > 1 ? `${jobs.length} actions running` : job.label;

  return (
    <Link
      href={job.href}
      aria-live="polite"
      title={`${label} — started ${elapsed(job.startedAt, now)} ago. Click to watch it.`}
      className="flex shrink-0 items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent-strong transition hover:border-accent"
    >
      <Icon name="refresh" size={14} className="animate-spin" />
      <span className="hidden sm:inline">{label}</span>
      <span className="font-mono text-[11px] tabular-nums">{elapsed(job.startedAt, now)}</span>
    </Link>
  );
}
