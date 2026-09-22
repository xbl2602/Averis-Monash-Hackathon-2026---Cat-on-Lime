"use client";

import { useRef } from "react";
import { Icon } from "../icon";
import { SCENE_VH } from "../scroll/scene-config";
import { scrub, useScene } from "../scroll/use-scene";
import { CAPABILITIES, FORMATS, FORMATS_INTRO, SCANNED_WARNING } from "./content";
import { SceneEyebrow, SceneShell } from "./scene-shell";

const cap = CAPABILITIES[1];

/**
 * Scene 2, "The Scanner" (280-460vh, pinned 180vh). A beam sweeps down the four supported formats,
 * lighting each in turn; the plane flies through it and, on the far side, unfolds into the SI sheet
 * while the draft BL sheet appears beside it and the extracted fields resolve out of the pair.
 * (The SI sheet IS the plane; only the BL sheet is a separate element.)
 */
export function SceneScanner() {
  const ref = useRef<HTMLElement>(null);

  useScene(ref, (tl, { q }) => {
    const vh = window.innerHeight;
    // Beam centre (px in the stage): it should cross the plane's route at y = 0.42 when the plane passes (p = 0.667)
    const y0 = vh * 0.06;
    const yPlane = vh * 0.42;
    const y1 = vh * 0.62;

    scrub(tl, q("[data-copy] > *"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.06, stagger: 0.015 }, 0.02);
    scrub(tl, q("[data-format]"), { opacity: 0.45, x: 30 }, { opacity: 1, x: 0, duration: 0.06, stagger: 0.02 }, 0.04);

    // The beam
    scrub(tl, q("[data-beam]"), { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.08);
    scrub(tl, q("[data-beam]"), { y: y0 }, { y: yPlane, duration: 0.567 }, 0.1);
    tl.to(q("[data-beam]"), { y: y1, duration: 0.18 }, 0.667);
    tl.to(q("[data-beam]"), { opacity: 0, duration: 0.07 }, 0.83);

    // Each format lights up as the beam passes its centre
    const cards = q("[data-format]") as HTMLElement[];
    cards.forEach((card) => {
      const cy = card.getBoundingClientRect().top + card.offsetHeight / 2 - card.closest(".scene-stage")!.getBoundingClientRect().top;
      const p = 0.1 + 0.567 * Math.min(1, Math.max(0, (cy - y0) / (yPlane - y0)));
      const glow = card.querySelector("[data-format-glow]");
      scrub(tl, glow, { opacity: 0 }, { opacity: 1, duration: 0.04 }, p - 0.02);
      scrub(tl, card.querySelector("[data-format-icon]"), { scale: 1 }, { scale: 1.25, duration: 0.02, yoyo: true, repeat: 1 }, p - 0.02);
    });

    // Far side of the beam: the plane becomes the SI sheet; the BL sheet joins it; fields resolve out
    scrub(tl, q("[data-caption]"), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.04, stagger: 0.03 }, 0.82);
    scrub(tl, q("[data-bl-sheet]"), { opacity: 0, x: -40, scale: 0.85 }, { opacity: 1, x: 0, scale: 1, duration: 0.1, ease: "power2.out" }, 0.8);
    scrub(tl, q("[data-field]"), { opacity: 0, y: -26, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.05, stagger: 0.03 }, 0.86);
  });

  return (
    <SceneShell id="formats" pin={SCENE_VH.scanner.pin} ref={ref}>
      <div data-copy data-avoid className="story:col-span-5">
        <SceneEyebrow>{cap.step}</SceneEyebrow>
        <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{cap.title}</h2>
        <p className="mt-3 text-fg-muted">{cap.text}</p>

        <div className="mt-7">
          <SceneEyebrow>{FORMATS_INTRO.eyebrow}</SceneEyebrow>
          <h3 className="mt-1.5 text-lg font-bold leading-snug">{FORMATS_INTRO.heading}</h3>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-warn-soft p-4 text-sm">
          <Icon name="scan" size={22} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-fg-muted">
            <strong className="text-fg">{SCANNED_WARNING.strong}</strong> {SCANNED_WARNING.rest}
          </p>
        </div>
      </div>

      <div className="story:col-span-7 story:self-start story:pt-[12vh]">
        <ul className="mx-auto flex w-full max-w-[360px] flex-col gap-2 story:mr-0">
          {FORMATS.map((f) => (
            <li key={f.name} data-format data-avoid className="card relative flex items-center gap-3.5 p-3">
              <span
                data-format-glow
                className="pointer-events-none absolute inset-0 hidden rounded-3xl border border-accent bg-accent/10 story:block"
              />
              <span
                data-format-icon
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-strong"
              >
                <Icon name={f.icon} size={22} />
              </span>
              <div className="relative">
                <div className="font-bold">
                  {f.name} <span className="font-mono text-xs font-medium text-fg-faint">{f.ext}</span>
                </div>
                {/* On short screens the description would push the list into the labels below it, so only the name and extension stay */}
                <p className="mt-0.5 text-xs leading-relaxed text-fg-muted [@media(max-height:800px)]:hidden">{f.note}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Beam and sheets are positioned in viewport fractions on desktop so they line up with the plane's route */}
        <div
          data-beam
          aria-hidden="true"
          className="pointer-events-none absolute left-[42%] right-[2%] top-0 hidden h-28 -translate-y-1/2 story:block"
          style={{
            background:
              "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--accent) 34%, transparent) 46%, color-mix(in srgb, var(--accent) 70%, white) 50%, color-mix(in srgb, var(--accent) 34%, transparent) 54%, transparent)",
          }}
        />

        <div className="mt-8 flex flex-col items-center gap-4 story:mt-0 story:block">
          <div
            data-bl-sheet
            className="relative h-[169px] w-[130px] rounded-md border border-line-strong bg-[var(--plane,#fff)] p-3.5 story:absolute story:left-[78.5%] story:top-[68%] story:-translate-x-1/2 story:-translate-y-1/2"
          >
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="mb-3 h-[3px] rounded-full bg-fg-faint" style={{ width: n % 3 === 2 ? "62%" : "88%" }} />
            ))}
          </div>

          <span
            data-caption
            className="chip story:absolute story:left-[66%] story:top-[53%] story:-translate-x-1/2"
          >
            SI (reference)
          </span>
          <span
            data-caption
            className="chip story:absolute story:left-[78.5%] story:top-[53%] story:-translate-x-1/2"
          >
            Draft BL
          </span>

          <ul className="flex max-w-[520px] flex-wrap justify-center gap-2 story:absolute story:left-[72%] story:top-[81%] story:w-[520px] story:-translate-x-1/2">
            {cap.points.map((p) => (
              <li key={p} data-field className="chip !bg-surface-solid !py-1.5 !text-[13px] !text-fg">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SceneShell>
  );
}
