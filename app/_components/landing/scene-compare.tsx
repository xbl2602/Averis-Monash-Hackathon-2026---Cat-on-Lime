"use client";

import { useRef } from "react";
import { Icon } from "../icon";
import { SCENE_VH } from "../scroll/scene-config";
import { scrub, useScene } from "../scroll/use-scene";
import { CAPABILITIES, MESSY_INPUTS, MESSY_INTRO, REPORT } from "./content";
import { SceneEyebrow, SceneShell } from "./scene-shell";

/** When each row resolves, as a fraction of the scene (the storyboard's table) */
const ROW_AT = [0.1, 0.2, 0.3, 0.42, 0.54, 0.7, 0.84];
const MISMATCH_ROW = REPORT.rows.findIndex((r) => !r.ok);
const PORT_ROW = REPORT.rows.findIndex((r) => r.field === "Port of loading");
const GRID = "grid-cols-[32%_31%_31%_6%]";
/** How far the two sheets start apart, in px each way */
const SHEET_GAP = 92;

/**
 * Scene 3, "The Comparison" (440-640vh, pinned 200vh). The product demo.
 * Two sheets slide together into one table, the seven rows resolve one at a time, the formatting
 * quirk is called out at "Singapore vs SINGAPORE", and the container-count row turns red and stays.
 */
export function SceneCompare() {
  const ref = useRef<HTMLElement>(null);
  const cap = CAPABILITIES[2];
  const flagText = REPORT.flag;

  useScene(
    ref,
    (tl, { q }) => {
      const vh = window.innerHeight;
      const at = (p: number) => p;
      const row = (i: number) => q(`[data-row="${i}"]`);

      // -- Copy on the left
      scrub(tl, q("[data-copy] > *"), { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.05, stagger: 0.012 }, 0.02);

      // -- The report: sheets slide together and become one table
      scrub(tl, 
        q("[data-report]"),
        { scale: 0.64, y: vh * 0.1, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.1, ease: "power2.out" },
        0.0
      );
      scrub(tl, q('[data-cell="si"]'), { x: -SHEET_GAP }, { x: 0, duration: 0.1, ease: "power2.inOut" }, 0.02);
      scrub(tl, q('[data-cell="bl"]'), { x: SHEET_GAP }, { x: 0, duration: 0.1, ease: "power2.inOut" }, 0.02);
      scrub(tl, q('[data-sheet="si"]'), { x: -SHEET_GAP, opacity: 1 }, { x: 0, opacity: 0, duration: 0.1, ease: "power2.inOut" }, 0.02);
      scrub(tl, q('[data-sheet="bl"]'), { x: SHEET_GAP, opacity: 1 }, { x: 0, opacity: 0, duration: 0.1, ease: "power2.inOut" }, 0.02);
      scrub(tl, q("[data-card-bg]"), { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.08);
      scrub(tl, q("[data-head] [data-cell]"), { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.08);

      // -- Seven rows resolve, one at a time
      ROW_AT.forEach((p, i) => {
        const r = row(i);
        scrub(tl, 
          r[0]?.querySelectorAll("[data-val]") ?? [],
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.05 },
          at(p - 0.05)
        );
        scrub(tl, r[0]?.querySelector('[data-cell="field"]') ?? [], { opacity: 0 }, { opacity: 1, duration: 0.05 }, at(p - 0.05));
        scrub(tl, 
          r[0]?.querySelector("[data-status] svg") ?? [],
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.03, ease: "back.out(2.4)" },
          at(p - 0.005)
        );
      });

      // -- The casing callout, pinned to "Port of loading"
      const portAt = ROW_AT[PORT_ROW];
      scrub(tl, q("[data-callout]"), { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.03 }, portAt);
      tl.to(q("[data-callout]"), { opacity: 0, duration: 0.03 }, portAt + 0.13);
      scrub(tl, q("[data-glow]"), { opacity: 0 }, { opacity: 1, duration: 0.03 }, portAt);
      tl.to(q("[data-glow]"), { opacity: 0, duration: 0.03 }, portAt + 0.13);

      // -- The mismatch: row flushes red, shakes 4px, the 3 and the 4 scale up, and it stays
      const badAt = ROW_AT[MISMATCH_ROW];
      scrub(tl, q("[data-row-bg]"), { opacity: 0 }, { opacity: 1, duration: 0.03 }, badAt);
      tl.to(row(MISMATCH_ROW), { keyframes: { x: [4, -4, 3, -3, 0] }, duration: 0.05 }, badAt);
      scrub(tl, 
        q('[data-row="' + MISMATCH_ROW + '"] [data-cell="si"] [data-val], [data-row="' + MISMATCH_ROW + '"] [data-cell="bl"] [data-val]'),
        { scale: 1 },
        { scale: 1.4, duration: 0.05, ease: "back.out(2)", transformOrigin: "left center" },
        badAt
      );
      scrub(tl, q("[data-badge]"), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.03, ease: "back.out(2)" }, badAt);

      // -- The flag summary writes itself out below the table
      const flagEl = q("[data-typed]")[0] as HTMLElement | undefined;
      const typed = { n: 0 };
      if (flagEl) flagEl.textContent = "";
      scrub(tl, 
        typed,
        { n: 0 },
        {
          n: flagText.length,
          duration: 0.06,
          onUpdate: () => {
            if (flagEl) flagEl.textContent = flagText.slice(0, Math.round(typed.n));
          },
        },
        0.92
      );
      scrub(tl, q("[data-note]"), { opacity: 0 }, { opacity: 1, duration: 0.03 }, 0.965);

      // -- The formatting item on the left lights up while the callout is on screen
      scrub(tl, q("[data-messy-glow]"), { opacity: 0 }, { opacity: 1, duration: 0.03 }, portAt);
      tl.to(q("[data-messy-glow]"), { opacity: 0, duration: 0.03 }, portAt + 0.13);

      return () => {
        if (flagEl) flagEl.textContent = flagText;
      };
    },
    { fadeIn: 0.04, fadeOut: 0.03 }
  );

  return (
    <SceneShell id="compare" pin={SCENE_VH.compare.pin} ref={ref}>
      <div data-copy className="story:col-span-5">
        <SceneEyebrow>{cap.step}</SceneEyebrow>
        <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{cap.title}</h2>
        <p className="mt-3 text-fg-muted">{cap.text}</p>
        <ul className="mt-4 space-y-1.5 text-sm">
          {cap.points.map((p) => (
            <li key={p} className="flex items-start gap-2.5">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent-strong" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7">
          <SceneEyebrow>{MESSY_INTRO.eyebrow}</SceneEyebrow>
          <h3 className="mt-1.5 text-lg font-bold leading-snug">{MESSY_INTRO.heading}</h3>
          <ul className="mt-3 space-y-2">
            {MESSY_INPUTS.map((m) => {
              const isFormatting = m.title === "Formatting differences";
              return (
                <li key={m.title} className="relative rounded-2xl px-3 py-1.5">
                  {isFormatting && (
                    <span
                      data-messy-glow
                      className="pointer-events-none absolute inset-0 hidden rounded-2xl border border-accent/50 bg-accent/10 story:block"
                    />
                  )}
                  <div className="relative text-sm font-semibold">{m.title}</div>
                  <p className="relative text-xs leading-relaxed text-fg-muted">{m.text}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="story:col-span-7">
        <div data-report className="relative mx-auto w-full max-w-[640px]">
          <div data-card-bg className="card absolute inset-0" />

          <div className="relative p-3">
            <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
              <div className="min-w-0">
                <div className="eyebrow">{REPORT.eyebrow}</div>
                <div className="mt-1 truncate text-sm font-semibold">{REPORT.subject}</div>
              </div>
              <span
                data-badge
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bad-soft px-3 py-1 text-xs font-semibold text-bad"
              >
                <Icon name="alert" size={13} />
                {REPORT.badge}
              </span>
            </div>

            <div role="table" aria-label={REPORT.subject} className="relative rounded-2xl bg-sunken text-[13px]">
              <div
                data-sheet="si"
                className="absolute inset-y-0 z-0 hidden rounded-xl border border-line-strong bg-surface-solid story:block"
                style={{ left: "32%", width: "31%" }}
              />
              <div
                data-sheet="bl"
                className="absolute inset-y-0 z-0 hidden rounded-xl border border-line-strong bg-surface-solid story:block"
                style={{ left: "63%", width: "31%" }}
              />

              <div role="row" data-head className={`relative z-10 grid ${GRID} items-center px-2 py-2.5 text-[11px] uppercase tracking-wider text-fg-faint`}>
                <div role="columnheader" data-cell="field" className="px-2">Field</div>
                <div role="columnheader" data-cell="si" className="px-2">SI (reference)</div>
                <div role="columnheader" data-cell="bl" className="px-2">Draft BL</div>
                <div data-cell="status" />
              </div>

              {REPORT.rows.map((r, i) => (
                <div
                  key={r.field}
                  role="row"
                  data-row={i}
                  className={`relative z-10 grid ${GRID} min-h-[52px] items-center border-t border-line px-2`}
                >
                  {!r.ok && <div data-row-bg className="pointer-events-none absolute inset-0 rounded-md bg-bad-soft" />}
                  <div role="cell" data-cell="field" className="relative px-2 font-medium">
                    {r.field}
                  </div>
                  <div role="cell" data-cell="si" className="relative px-2">
                    <span data-val className="inline-block text-fg-muted">{r.si}</span>
                  </div>
                  <div role="cell" data-cell="bl" className="relative px-2">
                    <span data-val className={`inline-block ${r.ok ? "text-fg-muted" : "font-bold text-bad"}`}>{r.bl}</span>
                  </div>
                  <div role="cell" data-cell="status" data-status className="relative flex justify-center">
                    <Icon name={r.ok ? "check" : "alert"} size={16} className={r.ok ? "text-ok" : "text-bad"} />
                  </div>

                  {i === PORT_ROW && (
                    <div
                      data-callout
                      className="absolute right-2 top-full z-30 mt-1 hidden w-[250px] rounded-2xl border border-accent/40 bg-surface-solid px-3.5 py-2 text-xs font-medium shadow-lg story:block"
                    >
                      <span
                        data-glow
                        className="pointer-events-none absolute -top-[5px] right-10 h-2.5 w-2.5 rotate-45 border-l border-t border-accent/40 bg-surface-solid"
                      />
                      {REPORT.casingCallout}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-2 pb-1 pt-3 text-xs text-fg-muted">
              <div className="min-h-[1.25rem] font-medium">
                <strong className="text-bad" data-typed>
                  {flagText}
                </strong>
              </div>
              <div data-note className="mt-0.5 text-fg-faint">
                {REPORT.formattingNote}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SceneShell>
  );
}
