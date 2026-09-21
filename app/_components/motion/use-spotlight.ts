"use client";

import type { PointerEvent } from "react";

/**
 * Props for any element with the `spot` class: publishes the pointer position as --mx / --my
 * so the CSS glow follows the cursor. Cheap: it only writes two custom properties.
 */
export function spotlightProps() {
  return {
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      el.style.setProperty("--my", `${event.clientY - rect.top}px`);
    },
  };
}
