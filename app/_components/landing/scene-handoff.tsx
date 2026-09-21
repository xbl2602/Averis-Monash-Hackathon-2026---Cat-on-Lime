"use client";

import { useRef } from "react";
import { Icon } from "../icon";
import { SCENE_VH } from "../scroll/scene-config";
import { scrub, useScene } from "../scroll/use-scene";
import { WAYPOINTS } from "../scroll/flight-waypoints";
import { CAPABILITIES, RELIABILITY_INTRO, RELIABILITY_POINTS, RELIABILITY_STATS } from "./content";
import { SceneEyebrow, SceneShell } from "./scene-shell";

const cap = CAPABILITIES[3];

/** Fork geometry in viewport percentages, taken from the same waypoints the plane flies (11 approach, 12 node, 13 human) */
const pct = (i: number) => [WAYPOINTS[i][0] * 100, WAYPOINTS[i][1] * 100] as const;
const [ax, ay] = pct(11);
const [nx, ny] = pct(12);
const [hx, hy] = pct(13);
/** The branch that resolves on its own runs off to the right and slightly down */
const [rx, ry] = [nx + 26, ny + 8];

/** Fork paths in pixels for a viewport of w x h (real pixels keep strokes even and dash-drawing exact) */
function forkPaths(w: number, h: number) {
  const P = (x: number, y: number) => `${(x / 100) * w} ${(y / 100) * h}`;
  return {
    stem: `M ${P(ax, ay)} C ${P(ax + 6, ay - 2)}, ${P(nx - 6, ny + 2)}, ${P(nx, ny)}`,
    auto: `M ${P(nx, ny)} C ${P(nx + 8, ny)}, ${P(rx - 8, ry)}, ${P(rx, ry)}`,
    human: `M ${P(nx, ny)} C ${P(nx + 4, ny - 14)}, ${P(hx - 14, hy + 4)}, ${P(hx, hy)}`,
  };
}

/**
 * Scene 4, "The Handoff" (640-760vh, pinned 120vh). The one sentence that is a product decision:
 * when it can't be sure, it asks a person. The plane hesitates at a fork (wobble, a "?" halo),
 * one branch resolves on its own, and the plane takes the other, up to a person.
 */
export function SceneHandoff() {
  const ref = useRef<HTMLElement>(null);

  useScene(
    ref,
    (tl, { q }) => {
      // Lay the fork out in this viewport's pixels before measuring its lengths
      const svgs = <T extends Element>(selector: string) => q(selector) as unknown as T[];
      const svg = svgs<SVGSVGElement>("[data-fork]")[0];
      const w = window.innerWidth;
      const h = window.innerHeight;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      const d = forkPaths(w, h);
      svgs<SVGPathElement>("[data-stem]")[0].setAttribute("d", d.stem);
      svgs<SVGPathElement>("[data-auto]")[0].setAttribute("d", d.auto);
      svgs<SVGPathElement>("[data-human]")[0].setAttribute("d", d.human);

      const drawn = (selector: string) => svgs<SVGGeometryElement>(selector);
      const lengthOf = (el: SVGGeometryElement) => el.getTotalLength?.() ?? 0;
      const draw = (selector: string, start: number, duration: number) => {
        drawn(selector).forEach((path) => {
          const len = lengthOf(path);
          scrub(tl, 
            path,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration },
            start
          );
        });
      };

      scrub(tl, q("[data-copy] > *"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.07, stagger: 0.02 }, 0.02);
      scrub(tl, q("[data-point]"), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.07, stagger: 0.06 }, 0.36);
      scrub(tl, q("[data-stat]"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.05, stagger: 0.03 }, 0.74);

      // The fork draws itself as the plane approaches it
      draw("[data-stem]", 0.02, 0.3);
      scrub(tl, q("[data-node]"), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.04, ease: "back.out(2)" }, 0.3);

      // Hesitation: the "?" halo pulses while the plane wobbles
      scrub(tl, q("[data-halo]"), { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.05 }, 0.33);
      tl.to(q("[data-halo]"), { keyframes: { scale: [1.35, 1, 1.35, 1, 1.3, 1] }, duration: 0.28 }, 0.38);
      tl.to(q("[data-halo]"), { opacity: 0, duration: 0.05 }, 0.66);

      // One branch resolves on its own; the plane takes the other
      draw("[data-auto]", 0.55, 0.14);
      scrub(tl, q("[data-auto-end]"), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.04, ease: "back.out(2)" }, 0.68);
      draw("[data-human]", 0.62, 0.32);
      scrub(tl, q("[data-human-end]"), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.05, ease: "back.out(2.4)" }, 0.9);
      scrub(tl, q("[data-received]"), { scale: 0.6, opacity: 0.9 }, { scale: 2.1, opacity: 0, duration: 0.07 }, 0.94);
    },
    { fadeOut: 0.04 }
  );

  const strokeProps = { fill: "none", strokeLinecap: "round" as const };

  return (
    <SceneShell id="reliability" pin={SCENE_VH.handoff.pin} ref={ref}>
      <div data-copy className="story:col-span-5">
        <SceneEyebrow>{RELIABILITY_INTRO.eyebrow}</SceneEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
          {RELIABILITY_INTRO.headingLead} <span className="text-gradient">{RELIABILITY_INTRO.headingEmphasis}</span>.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-muted">{RELIABILITY_INTRO.text}</p>
        <p className="mt-4 max-w-md border-l-2 border-accent pl-4 text-lg font-semibold leading-snug">
          {RELIABILITY_INTRO.quote}
        </p>

        <div className="card mt-5 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-royal text-white shadow-md">
              <Icon name={cap.icon} size={22} />
            </span>
            <div className="eyebrow">{cap.step}</div>
          </div>
          <h3 className="mt-3 text-lg font-bold">{cap.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">{cap.text}</p>
          <ul className="mt-3 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
            {cap.points.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent-strong" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="story:col-span-7">
        {/* The fork, drawn over the whole stage in viewport percentages so it sits exactly under the plane's route */}
        <svg
          data-fork
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full story:block"
        >
          <path data-stem stroke="var(--fg-faint)" strokeWidth="2" {...strokeProps} />
          <path data-auto stroke="var(--ok)" strokeWidth="3" {...strokeProps} />
          <path data-human stroke="var(--accent)" strokeWidth="3" {...strokeProps} />
        </svg>

        <div
          data-node
          aria-hidden="true"
          className="pointer-events-none absolute hidden h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-page story:block"
          style={{ left: `${nx}%`, top: `${ny}%` }}
        />
        <div
          data-halo
          aria-hidden="true"
          className="pointer-events-none absolute hidden h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/10 text-2xl font-bold text-accent-strong story:flex"
          style={{ left: `${nx}%`, top: `${ny - 9}%` }}
        >
          ?
        </div>
        <div
          data-auto-end
          aria-hidden="true"
          className="pointer-events-none absolute hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ok-soft text-ok story:flex"
          style={{ left: `${rx}%`, top: `${ry}%` }}
        >
          <Icon name="check" size={22} />
        </div>
        <div
          data-human-end
          aria-hidden="true"
          className="pointer-events-none absolute hidden h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-accent to-royal text-white shadow-lg story:flex"
          style={{ left: `${hx}%`, top: `${hy}%` }}
        >
          <Icon name="users" size={26} />
          <span
            data-received
            className="absolute inset-0 rounded-full border-2 border-accent"
          />
        </div>

        {/* The four reliability points sit in the lower right, clear of the route */}
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 story:absolute story:bottom-[15%] story:left-[46%] story:right-[4%] story:mt-0 story:gap-3">
          {RELIABILITY_POINTS.map((p) => (
            <li key={p.title} data-point className="card flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-strong">
                <Icon name={p.icon} size={20} />
              </span>
              <div>
                <h3 className="text-sm font-bold">{p.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-6 border-t border-line pt-5 sm:grid-cols-4 story:absolute story:bottom-[3%] story:left-[46%] story:right-[4%] story:mt-0 story:border-t-0 story:pt-0">
          {RELIABILITY_STATS.map((s) => (
            <div key={s.l} data-stat>
              <div className="text-2xl font-bold">{s.v}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-fg-muted">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}
