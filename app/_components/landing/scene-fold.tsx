"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "../scroll/gsap";
import { useStory } from "../scroll/story-context";
import { Hero } from "./hero";

/**
 * Scene 0, "The Fold" (0-100vh, not pinned). The plane itself is animated by the master timeline;
 * this scene only owns the hero's own scroll-linked details: the quick-fact chips stagger away
 * as the sheet behind the report card lifts off and folds.
 */
export function SceneFold() {
  const ref = useRef<HTMLElement>(null);
  const { mode } = useStory();

  useGSAP(
    () => {
      if (mode !== "story" || !ref.current) return;
      const chips = gsap.utils.toArray<HTMLElement>("[data-chip]", ref.current);
      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: 0.5 },
        })
        .fromTo(
          chips,
          { y: 0, opacity: 1 },
          { y: -34, opacity: 0, stagger: 0.11, duration: 0.3, immediateRender: false },
          0.25
        );
    },
    { scope: ref, dependencies: [mode], revertOnUpdate: true }
  );

  return <Hero ref={ref} />;
}
