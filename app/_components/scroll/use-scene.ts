"use client";

import type { RefObject } from "react";
import { gsap, useGSAP } from "./gsap";
import { useStory } from "./story-context";
import { useViewportKey } from "./use-viewport-key";

export interface SceneTools {
  /** Scoped selector: finds elements inside this scene only */
  q: gsap.utils.SelectorFunc;
  /** The scene's pinned stage element */
  stage: HTMLElement;
}

interface SceneOptions {
  /** How much of the scene's scroll the stage takes to fade in / out (fraction of the scene) */
  fadeIn?: number;
  fadeOut?: number;
}

/**
 * Registers ONE scrubbed timeline for a pinned scene. The timeline is exactly one unit long and its
 * progress is the scene's own scroll progress (0 when the scene pins, 1 when it releases), so a scene
 * author places things at 0.42 and it happens at 42% of the scene's scroll, forwards or backwards.
 *
 * Scenes only animate their OWN content here. The plane and the page theme belong to the master
 * timeline in plane-rig.ts, so two scenes can never fight over them.
 */
export function useScene(
  scope: RefObject<HTMLElement | null>,
  build: (tl: gsap.core.Timeline, tools: SceneTools) => void | (() => void),
  { fadeIn = 0.05, fadeOut = 0.05 }: SceneOptions = {}
): void {
  const { mode } = useStory();
  const viewport = useViewportKey();

  useGSAP(
    () => {
      const root = scope.current;
      if (mode !== "story" || !root) return;
      const stage = root.querySelector<HTMLElement>(".scene-stage");
      if (!stage) return;

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.5,
          invalidateOnRefresh: true,
        },
      });

      // The stage is hidden until its own scroll range starts (visibility toggles with autoAlpha)
      tl.fromTo(stage, { autoAlpha: 0 }, { autoAlpha: 1, duration: fadeIn, immediateRender: true }, 0);
      tl.to(stage, { autoAlpha: 0, duration: fadeOut }, 1 - fadeOut);

      const cleanup = build(tl, { q: gsap.utils.selector(root), stage });

      tl.set({}, {}, 1); // pin the timeline length to exactly 1
      return cleanup; // e.g. restore text a scene rewrote
    },
    { scope, dependencies: [mode, viewport], revertOnUpdate: true }
  );
}

/**
 * `tl.fromTo` that ALWAYS starts every target in its "from" state.
 * (GSAP's own immediateRender only applies the from-state to the first target of a staggered tween
 * placed later in a timeline, so the other targets would show up before their turn.)
 */
export function scrub(
  tl: gsap.core.Timeline,
  targets: gsap.TweenTarget,
  from: gsap.TweenVars,
  to: gsap.TweenVars,
  position?: gsap.Position
): gsap.core.Timeline {
  const { immediateRender: _ignored, ...fromVars } = from as gsap.TweenVars & { immediateRender?: boolean };
  void _ignored;
  gsap.set(targets, fromVars);
  return tl.fromTo(targets, fromVars, { ...to, immediateRender: false }, position);
}
