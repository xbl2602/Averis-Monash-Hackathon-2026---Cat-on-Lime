"use client";

import { useState, type ReactNode } from "react";
import { CountUp } from "./count-up";
import { useReady } from "./use-ready";

export interface RingSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

const SIZE = 200;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

/** Donut chart that draws itself in. Hovering a slice or a legend row highlights both and shows that slice in the middle. */
export function RingChart({ segments, centerLabel, footer }: { segments: RingSegment[]; centerLabel: string; footer?: ReactNode }) {
  const ready = useReady();
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const shown = segments.filter((s) => s.value > 0);
  const focus = segments.find((s) => s.key === active);

  let offset = 0;
  const arcs = shown.map((segment, i) => {
    const length = total > 0 ? (segment.value / total) * CIRCUMFERENCE : 0;
    const drawn = Math.max(0, length - (shown.length > 1 ? GAP : 0));
    const arc = { segment, i, drawn, dashOffset: -offset };
    offset += length;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" role="img" aria-label={`${centerLabel}: ${total}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--sunken)" strokeWidth={STROKE} />
          {arcs.map(({ segment, i, drawn, dashOffset }) => (
            <circle
              key={segment.key}
              className="ring-seg cursor-pointer"
              style={{ "--i": i } as React.CSSProperties}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={active === segment.key ? STROKE + 5 : STROKE}
              strokeLinecap="round"
              strokeDasharray={ready ? `${drawn} ${CIRCUMFERENCE - drawn}` : `0 ${CIRCUMFERENCE}`}
              strokeDashoffset={dashOffset}
              opacity={active && active !== segment.key ? 0.35 : 1}
              onPointerEnter={() => setActive(segment.key)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-4xl font-extrabold">
            <CountUp value={focus ? focus.value : total} />
          </div>
          <div className="mt-0.5 max-w-[7rem] text-xs font-medium text-fg-muted">{focus ? focus.label : centerLabel}</div>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {segments.map((segment) => (
          <li key={segment.key}>
            <button
              type="button"
              onPointerEnter={() => setActive(segment.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(segment.key)}
              onBlur={() => setActive(null)}
              className={`flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-sm transition ${
                active === segment.key ? "bg-sunken" : ""
              }`}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: segment.color }} />
              <span className="min-w-0 flex-1 truncate text-fg-muted">{segment.label}</span>
              <span className="font-mono text-xs font-semibold tabular-nums">{segment.value.toLocaleString("en-US")}</span>
              <span className="w-10 text-right font-mono text-xs text-fg-faint tabular-nums">
                {total > 0 ? Math.round((segment.value / total) * 100) : 0}%
              </span>
            </button>
          </li>
        ))}
        {footer}
      </ul>
    </div>
  );
}
