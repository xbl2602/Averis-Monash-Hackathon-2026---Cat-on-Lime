"use client";

import { useRef } from "react";
import { Icon } from "../icon";
import { offsetWithin, seeded } from "../scroll/layout-utils";
import { SCENE_VH } from "../scroll/scene-config";
import { scrub, useScene } from "../scroll/use-scene";
import { CAPABILITIES, CAPABILITIES_INTRO } from "./content";
import { SceneEyebrow, SceneShell } from "./scene-shell";

const cap = CAPABILITIES[0];
/** Envelopes per lane (24 in total, the storyboard's cap; each lane label is one of the five categories) */
const LANE_COUNTS = [8, 5, 4, 4, 3];
const LANE_TONES = ["text-accent-strong", "text-ok", "text-warn", "text-fg-muted", "text-bad"];
/** Lane n finishes sorting at this fraction of the scene: 0.35, 0.48, 0.61, 0.74, 0.87 */
const laneEnd = (n: number) => 0.35 + n * 0.13;
const LANE_SPAN = 0.22;

/**
 * Scene 1, "The Inbox" (100-280vh, pinned 180vh). Twenty-four envelopes enter as a loose cloud and
 * sort themselves into five labelled lanes, one lane finishing after another. Every envelope
 * rests in its lane in the plain layout; the timeline only moves it away from there and back.
 */
export function SceneInbox() {
  const ref = useRef<HTMLElement>(null);

  useScene(ref, (tl, { q }) => {
    const container = q("[data-lanes]")[0] as HTMLElement;
    const envelopes = q("[data-env]") as HTMLElement[];

    scrub(tl, q("[data-copy] > *"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.06, stagger: 0.015 }, 0.02);
    scrub(tl, q("[data-lane]"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.06, stagger: 0.02 }, 0.03);
    scrub(tl, q("[data-lane-label]"), { opacity: 0.45 }, { opacity: 1, duration: 0.04, stagger: 0 }, 0.03);

    // The cloud: everything arrives loose, scattered across the lanes' area
    scrub(tl, envelopes, { opacity: 0 }, { opacity: 1, duration: 0.1, stagger: 0.003 }, 0.0);

    let index = 0;
    LANE_COUNTS.forEach((count, lane) => {
      const start = laneEnd(lane) - LANE_SPAN;
      for (let i = 0; i < count; i++, index++) {
        const el = envelopes[index];
        const seed = index + 1;
        // Function-based values are re-measured on every ScrollTrigger refresh (see useScene)
        const cloud = () => {
          const rest = offsetWithin(el, container);
          return {
            x: seeded(seed) * (container.clientWidth - 40) - rest.x,
            y: seeded(seed * 3.7) * (container.clientHeight - 30) - rest.y,
          };
        };
        scrub(tl, 
          el,
          {
            x: () => cloud().x,
            y: () => cloud().y,
            rotation: (seeded(seed * 5.1) - 0.5) * 60,
            scale: 0.8,
          },
          {
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            duration: 0.12,
            ease: "power2.inOut",
          },
          start + (count > 1 ? (i / (count - 1)) * (LANE_SPAN - 0.12) : 0)
        );
      }
      // The lane rings itself in its colour the moment its last envelope lands, then settles
      const ring = q(`[data-lane="${lane}"] [data-lane-ring]`);
      scrub(tl, ring, { opacity: 0 }, { opacity: 1, duration: 0.03 }, laneEnd(lane) - 0.01);
      tl.to(ring, { opacity: 0.45, duration: 0.05 }, laneEnd(lane) + 0.03);
    });
  });

  return (
    <SceneShell id="capabilities" pin={SCENE_VH.inbox.pin} ref={ref}>
      <div data-copy data-avoid className="story:col-span-5">
        <SceneEyebrow>{CAPABILITIES_INTRO.eyebrow}</SceneEyebrow>
        <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{CAPABILITIES_INTRO.heading}</h2>
        <p className="mt-4 text-fg-muted">{CAPABILITIES_INTRO.text}</p>

        <div className="card mt-7 p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-royal text-white shadow-md">
              <Icon name={cap.icon} size={28} />
            </span>
            <div className="eyebrow">{cap.step}</div>
          </div>
          <h3 className="mt-4 text-xl font-bold">{cap.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{cap.text}</p>
        </div>
      </div>

      <div className="story:col-span-7">
        <div
          data-lanes
          className="relative mx-auto flex w-full max-w-[720px] flex-col gap-3 story:h-[72vh] story:justify-between story:gap-0"
        >
          {cap.points.map((label, lane) => {
            const start = LANE_COUNTS.slice(0, lane).reduce((a, b) => a + b, 0);
            return (
              <div
                key={label}
                data-lane={lane}
                className="relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-full border border-line bg-sunken px-4 py-2.5 story:h-[14%] story:flex-nowrap story:py-0"
              >
                <span data-lane-label data-avoid className="w-[200px] shrink-0 text-sm font-semibold">
                  {label}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 story:flex-nowrap">
                  {Array.from({ length: LANE_COUNTS[lane] }, (_, i) => (
                    <span
                      key={start + i}
                      data-env
                      className={`inline-flex h-6 w-9 shrink-0 items-center justify-center rounded-md border border-current/30 bg-surface-solid ${LANE_TONES[lane]}`}
                    >
                      <Icon name="mail" size={14} />
                    </span>
                  ))}
                </span>
                <span
                  data-lane-ring
                  className={`pointer-events-none absolute inset-0 hidden rounded-full border-2 border-current story:block ${LANE_TONES[lane]}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
}
