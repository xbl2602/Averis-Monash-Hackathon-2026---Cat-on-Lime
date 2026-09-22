"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-reduced-motion";

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * A number that counts up to its value on first show and glides to the new value when it changes.
 *
 * `whenVisible` holds the count until the number scrolls into view (for figures far down a page). The server
 * HTML always contains the final value, so nothing shows zeros before the count starts.
 */
export function CountUp({
  value,
  duration = 1000,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  className,
  whenVisible = false,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  whenVisible?: boolean;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(reduced || whenVisible ? value : 0);
  const shownRef = useRef(shown);
  const started = useRef(!whenVisible);

  useEffect(() => {
    if (reduced) {
      shownRef.current = value;
      setShown(value);
      return;
    }

    let frame = 0;
    let observer: IntersectionObserver | undefined;

    const animate = () => {
      const from = shownRef.current;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const next = from + (value - from) * easeOutExpo(t);
        shownRef.current = next;
        setShown(next);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    if (whenVisible && !started.current) {
      // Park at zero, off-screen, until the number is actually seen
      shownRef.current = 0;
      setShown(0);
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          started.current = true;
          animate();
        },
        { threshold: 0.35 }
      );
      if (ref.current) observer.observe(ref.current);
    } else {
      animate();
    }

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [value, duration, reduced, whenVisible]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {format(shown)}
    </span>
  );
}
