"use client";

import { CountUp } from "./count-up";
import { useReady } from "./use-ready";

const SIZE = 132;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A ring that fills to a 0-1 value while the number inside counts up (used for model confidence). */
export function Gauge({ value, label, color = "var(--accent)" }: { value: number; label: string; color?: string }) {
  const ready = useReady();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }} role="img" aria-label={`${label}: ${Math.round(clamped * 100)}%`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--sunken)" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={ready ? CIRCUMFERENCE * (1 - clamped) : CIRCUMFERENCE}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-extrabold">
          <CountUp value={clamped * 100} format={(n) => `${Math.round(n)}%`} />
        </div>
        <div className="text-[10px] uppercase tracking-widest text-fg-faint">{label}</div>
      </div>
    </div>
  );
}
