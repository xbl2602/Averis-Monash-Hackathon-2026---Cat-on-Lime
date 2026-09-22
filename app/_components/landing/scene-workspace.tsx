"use client";

import Link from "next/link";
import { useRef } from "react";
import { Icon } from "../icon";
import { SCENE_VH } from "../scroll/scene-config";
import { scrub, useScene } from "../scroll/use-scene";
import { WORKSPACE_FEATURES, WORKSPACE_INTRO } from "./content";
import { SceneEyebrow, SceneShell } from "./scene-shell";
import { WorkspaceVisual } from "./workspace-visuals";

/** Each card starts this much later than the one before (fraction of the scene) */
const CARD_STEP = 0.075;

/**
 * Scene 5, "The Workspace" (800-950vh, pinned 150vh). What the user gets once the check has run.
 * Six cards rise in one after another, and inside each card its little illustration plays: rows
 * appear, marks light up, buttons get pressed, checks tick off. The plane has left by now (it is
 * flying back for the call-to-action), so nothing covers these cards.
 */
export function SceneWorkspace() {
  const ref = useRef<HTMLElement>(null);

  useScene(ref, (tl, { q }) => {
    scrub(tl, q("[data-copy] > *"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.07, stagger: 0.02 }, 0.02);

    WORKSPACE_FEATURES.forEach((_, i) => {
      const start = 0.08 + i * CARD_STEP;
      const card = q(`[data-ws-card="${i}"]`);
      scrub(tl, card, { opacity: 0, y: 34, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.1, ease: "power2.out" }, start);

      // The illustration plays once its card is up
      const items = q(`[data-ws-card="${i}"] [data-ws-item]`);
      scrub(tl, items, { opacity: 0, y: 10, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.05, stagger: 0.045, ease: "power2.out" }, start + 0.08);
      scrub(tl, q(`[data-ws-card="${i}"] [data-ws-bar]`), { scaleX: 0 }, { scaleX: 1, duration: 0.14, stagger: 0.03 }, start + 0.1);
    });
  });

  return (
    <SceneShell id="workspace" pin={SCENE_VH.workspace.pin} ref={ref}>
      <div data-copy data-avoid className="story:col-span-4">
        <SceneEyebrow>{WORKSPACE_INTRO.eyebrow}</SceneEyebrow>
        <h2 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{WORKSPACE_INTRO.heading}</h2>
        <p className="mt-4 text-fg-muted">{WORKSPACE_INTRO.text}</p>
        <Link href="/dashboard" className="btn btn-primary btn-shine mt-7 !px-7 !py-3.5">
          Open the workspace
          <Icon name="arrowRight" size={16} />
        </Link>
      </div>

      <div className="story:col-span-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKSPACE_FEATURES.map((f, i) => (
            <li key={f.key} data-ws-card={i}>
              <Link href={f.href} className="card card-hover spot group flex h-full flex-col gap-3 p-4">
                <WorkspaceVisual kind={f.key} />
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent-strong transition duration-300 group-hover:scale-110 group-hover:-rotate-6">
                    <Icon name={f.icon} size={17} />
                  </span>
                  <h3 className="text-[15px] font-bold leading-snug">{f.title}</h3>
                </div>
                <p className="text-xs leading-relaxed text-fg-muted">{f.text}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SceneShell>
  );
}
