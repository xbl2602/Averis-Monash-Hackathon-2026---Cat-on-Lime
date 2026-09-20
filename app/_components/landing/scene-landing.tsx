"use client";

import Link from "next/link";
import { useRef } from "react";
import { Icon } from "../icon";
import { gsap, useGSAP } from "../scroll/gsap";
import { useStory } from "../scroll/story-context";
import { useMagnetic } from "../scroll/use-magnetic";
import { Footer } from "./cta-footer";
import { AccessBlock, HowItWorksBlock, ModelsDeployBlock } from "./landing-blocks";

/**
 * The call-to-action the plane lands in. In the story the card has no fill of its own: the plane
 * (see PlaneRig, `dock`) flies in, flattens to a report page, grows to the card's size and BECOMES
 * the card, so `.cta-fill` fades in as the plane fades out.
 */
function FinalCta() {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  useMagnetic(buttonRef); // the one magnetic element on the page

  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 pt-16">
      <div data-cta className="relative">
        <div className="cta-fill card absolute inset-0" />
        <div className="relative flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to check your first shipment?</h2>
            <p className="mt-2 text-sm text-fg-muted">Run the full pipeline on the sample inbox, or try a single step.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link ref={buttonRef} href="/dashboard" className="btn btn-primary magnetic !px-7 !py-3.5">
              Open the app
              <Icon name="arrowRight" size={16} />
            </Link>
            <Link href="/features/verification" className="btn btn-glass !px-7 !py-3.5">
              Run the pipeline
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Scene 5, "The Landing" (760vh onwards, natural flow). Back to the light palette. Each block is
 * scrubbed in by scroll and back out again; the runway and its three lanes are drawn by scroll too.
 */
export function SceneLanding() {
  const ref = useRef<HTMLDivElement>(null);
  const { mode } = useStory();

  useGSAP(
    () => {
      if (mode !== "story" || !ref.current) return;
      // Nothing of this scene may show until the pinned handoff scene has let go (its content would otherwise
      // slide up over it). Opacity, not visibility: keyboard users can still Tab to the final call-to-action.
      gsap.fromTo(
        ref.current,
        { opacity: 0 },
        { opacity: 1, ease: "none", scrollTrigger: { trigger: ref.current, start: "top 10%", end: "top 0%", scrub: true } }
      );

      const scrub = { start: "top 92%", end: "top 64%", scrub: true } as const;

      gsap.utils.toArray<HTMLElement>("[data-rise]", ref.current).forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, ease: "none", scrollTrigger: { trigger: el, ...scrub } }
        );
      });

      const runway = ref.current.querySelector<HTMLElement>("[data-runway]");
      if (runway) {
        gsap.fromTo(
          runway,
          { scaleX: 0 },
          { scaleX: 1, ease: "none", scrollTrigger: { trigger: runway, start: "top 88%", end: "top 62%", scrub: true } }
        );
        gsap.fromTo(
          ref.current.querySelectorAll("[data-lane-drop]"),
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            stagger: 0.25,
            scrollTrigger: { trigger: runway, start: "top 70%", end: "top 55%", scrub: true },
          }
        );
      }
    },
    { scope: ref, dependencies: [mode], revertOnUpdate: true }
  );

  return (
    <div ref={ref} className="scene-landing">
      <AccessBlock />
      <ModelsDeployBlock />
      <HowItWorksBlock />
      <FinalCta />
      <Footer />
    </div>
  );
}
