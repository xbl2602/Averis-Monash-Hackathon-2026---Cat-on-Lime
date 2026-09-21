"use client";

import type { RefObject } from "react";
import { gsap, useGSAP } from "./gsap";
import { useStory } from "./story-context";

/**
 * Pointer-follow for ONE element (the final call-to-action). Within `radius` px of the element the
 * pointer pulls it by offset * strength; outside, it eases home. Off for touch pointers and whenever
 * the story is not running (reduced motion / ?motion=off / phones).
 */
export function useMagnetic(ref: RefObject<HTMLElement | null>, { radius = 90, strength = 0.25 } = {}): void {
  const { mode } = useStory();

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || mode !== "story") return;
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

      const moveX = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const moveY = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });

      const onMove = (event: PointerEvent) => {
        const r = el.getBoundingClientRect();
        // Measure from the element's resting centre, not from where it has been pulled to
        const cx = r.left + r.width / 2 - (gsap.getProperty(el, "x") as number);
        const cy = r.top + r.height / 2 - (gsap.getProperty(el, "y") as number);
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const nearX = Math.max(0, Math.abs(dx) - r.width / 2);
        const nearY = Math.max(0, Math.abs(dy) - r.height / 2);
        if (Math.hypot(nearX, nearY) <= radius) {
          moveX(dx * strength);
          moveY(dy * strength);
        } else {
          moveX(0);
          moveY(0);
        }
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      return () => window.removeEventListener("pointermove", onMove);
    },
    { dependencies: [mode] }
  );
}
