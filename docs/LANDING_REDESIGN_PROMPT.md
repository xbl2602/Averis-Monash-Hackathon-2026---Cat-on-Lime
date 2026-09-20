# Prompt: Scroll-driven landing page for Shipping Doc Verifier

> Replaces `lusion-style-ui-prompt.md`. Rewritten against the actual repo
> (`shipping-doc-verifier`, Next.js 16 / React 19 / Tailwind v4) and against a
> specific complaint: the current landing page is a stack of static sections that
> fade in once. It reads as generated. It does not.
>
> **Decisions already made — do not re-open them:**
> protagonist = paper plane · stack = GSAP + SVG, no WebGL · look = scene-driven
> light→dark→light · length ≈ 900vh across 5 scenes.

---

## 1. What exists today (read this before touching anything)

**Stack:** Next.js 16 App Router, React 19.3, Tailwind v4 (`@theme` tokens in
`app/globals.css`), TypeScript. Fonts: Plus Jakarta Sans + JetBrains Mono.
**Zero animation dependencies installed.**

**Landing page** is `app/page.tsx` rendering nine components in a column:

```
MarketingNav → Hero → Capabilities → Formats → Access
→ Reliability → ModelsDeploy → HowItWorks → FinalCta → Footer
```

**The two components doing all the "motion" today:**

- `app/_components/reveal.tsx` — IntersectionObserver, fires once, disconnects,
  translate-y-8 + opacity. Every section uses it with staggered `delay` props.
- `app/_components/orb-field.tsx` — three CSS radial-gradient blobs on infinite
  `drift` keyframes.

**Why it looks generic:** both effects are *scroll-triggered*, not
*scroll-linked*. They play once and are done. Scrolling back up does nothing.
Nothing in the page responds to where the user actually is. The orbs drift on
their own clock, unrelated to the user. That combination — fade-up sections over
gradient blobs — is the exact house style of AI-generated landing pages in 2026,
which is why it disappears.

**Theming:** `data-theme` on `<html>`, semantic tokens (`--page`, `--fg`,
`--accent`, `--ok`, `--bad`, `--surface`, `--line`). Components use
`bg-page` / `text-fg` / `border-line`, never raw hex. Honour this. The scene
system below drives these same variables — it must not fight the theme toggle.

**Do not lose:** all existing section copy, the `ReportPreview` card, the light
and dark palettes, the `Icon` set, or the `/dashboard` CTA.

---

## 2. The idea

One object crosses the entire page: **a sheet of paper that folds into a paper
plane, flies the shipment route, gets inspected, and lands as a discrepancy
report.**

It is the right protagonist because it is not a metaphor. The product reads
paper — Shipping Instructions and Bills of Lading. The plane *is* the document.
It flies Singapore → Hamburg because that is the route in the demo data. It
finds the container-count mismatch because that is the real mismatch in
`email_001`. Nothing is decorative; the animation is the product demo.

**The one rule that makes it feel like Lusion:** the plane is a *single element*
that lives in one fixed-position layer for the whole page and is never
unmounted, never duplicated, never re-entered. Its position, rotation, scale and
fold-state are one continuous function of global scroll progress. Scenes are not
separate animations — they are ranges of one timeline that the plane passes
through. Scroll up and the paper unfolds, the red row goes green again, the
plane flies backwards. That reversibility is the whole effect.

---

## 3. The protagonist

### Build it, don't download it

The plane is **inline SVG, three polygons**: left wing, right wing, keel shadow.
Roughly 25 lines. Reasons: it inherits `currentColor` so it re-themes for free
across the light→dark→light shift, it is vector-crisp at any scale, it costs
~0 KB, and it cannot fail to load during judging.

```tsx
// app/_components/scroll/paper-plane.tsx
export function PaperPlane({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <polygon data-part="wing-l" points="50,8 8,86 50,66" fill="currentColor" opacity="0.92" />
      <polygon data-part="wing-r" points="50,8 92,86 50,66" fill="currentColor" opacity="0.62" />
      <polygon data-part="keel"   points="50,66 8,86 50,92"  fill="currentColor" opacity="0.38" />
    </svg>
  );
}
```

### The fold

Do **not** reach for MorphSVG. Wrap the same three polygons in three nested divs
with `transform-style: preserve-3d` and scrub `rotateY` on the two wing panels
from `0deg` (flat page) to `62deg` (folded plane). Pure CSS 3D transforms,
GPU-composited, trivially reversible, no plugin. The keel panel takes `rotateX`.

### If you later upgrade to 3D

Only as a stretch goal, and only behind a dynamic import with a static SVG
fallback:

- **Paper airplane** — Poly by Google, OBJ/glTF, **Creative Commons Attribution**
  — https://poly.pizza/m/75WQH5E29tF
- Alternates in the same search: https://poly.pizza/search/paper%20plane
  (Poly Pizza prints the licence on each model page — check it per model, some
  are CC0 and some are CC-BY, and CC-BY means you owe a credit line in the footer.)
- **Kenney** — every pack is **CC0**, no attribution required, good for scene
  props like crates and conveyor pieces — https://kenney.nl/assets/category:3D

---

## 4. The storyboard

Five scenes, ≈900vh. Each scene is a `ScrollTrigger` with `pin: true` and
`scrub: true`, so scroll distance *is* duration.

### Timing table

| # | Scene | Scroll | Continuous | Real dwell | Pinned | Theme |
|---|-------|--------|-----------|-----------|--------|-------|
| 0 | The Fold | 0–100vh | ~1.2s | 3–5s | no | light |
| 1 | The Inbox | 100–270vh | ~2.0s | 5–8s | yes | light → dusk |
| 2 | The Scanner | 270–440vh | ~2.0s | 5–8s | yes | dark |
| 3 | The Comparison | 440–640vh | ~2.4s | 8–14s | yes | dark |
| 4 | The Handoff | 640–760vh | ~1.4s | 4–6s | yes | dark → dusk |
| 5 | The Landing | 760–900vh | ~1.7s | 4–7s | no | light |

**Reading the timings.** 100vh ≈ 1.0–1.4s of *continuous* scrolling on a
trackpad at a normal pace (~800px/s), and Lenis smoothing adds inertia on top.
But nobody scrolls a landing page continuously — they scroll, stop, read,
scroll. "Real dwell" is the number that matters: budget **30–45 seconds** for a
judge who is actually reading, and make sure the page still makes sense to
someone who blasts to the bottom in eight.

**Scene 3 is the longest on purpose.** It is the product. Everything before it
is setup and everything after is resolution.

---

### Scene 0 — The Fold (0–100vh, not pinned)

The headline is in the DOM and legible at `scrollY = 0`, full stop. A judge must
know what this product is inside two seconds, before any animation has meaning.
No preloader, no percentage counter, no curtain wipe — those buy mystery at the
cost of the only thing you are being scored on.

`ReportPreview` currently sits in the hero's right column. Keep it there, but
behind it place a flat white page (the SI). As scroll goes 0 → 1:

- page lifts off the card, rotates to face the viewer
- wings fold inward (`rotateY: 0 → 62deg`)
- at progress 0.8 the plane detaches into the fixed layer and lifts
- the hero's quick-fact chips stagger out as it goes

The plane's flight path for the whole page is one SVG `<path>` in a hidden
`<svg>`; `MotionPathPlugin` maps global scroll progress to a point on it with
`autoRotate: true`. Author the path once in Figma or by hand — it is the
skeleton of the entire page.

---

### Scene 1 — The Inbox (100–270vh, pinned 170vh)

**Houses:** `Capabilities` copy — the five email categories.

Twenty-four small envelope cards enter as a loose cloud. As progress runs
0 → 1 they sort themselves into five labelled lanes, each lane resolving at a
staggered offset (lane *n* completes at progress `0.35 + n * 0.13`). The plane
threads between the lanes, banking as the path curves.

The point being made: *it reads a messy inbox and sorts it.* The sorting is not
a flourish, it is the first pipeline stage.

Background begins its shift here — `--page` interpolates from `#eef1f6` toward a
dusk mid-tone across the scene's back half.

---

### Scene 2 — The Scanner (270–440vh, pinned 170vh)

**Houses:** `Formats` copy — PDF · Word · Excel · Text.

Full dark now. A horizontal beam crosses the viewport. The plane flies through
it, and on the far side **unfolds back into two sheets**: the SI on the left, the
draft BL on the right (reverse the Scene 0 fold transform — same code, negative
direction, which is the payoff for building the fold as a scrubbed transform
rather than a one-shot).

As the beam passes over each format chip, the chip lights up in sequence. File
icons resolve out of the beam.

This is the visual explanation of extraction: one attachment in, structured
fields out.

---

### Scene 3 — The Comparison (440–640vh, pinned 200vh) ★

**Houses:** `ReportPreview`, promoted from a static card to the centrepiece.

The two sheets slide together and become the comparison table. Seven field rows
resolve one at a time, each locked to a slice of scene progress:

| Progress | Row | Result |
|---|---|---|
| 0.10 | Shipper | ✓ green |
| 0.20 | Consignee | ✓ green |
| 0.30 | Notify party | ✓ green |
| 0.42 | Port of loading | ✓ green — **and a callout pins itself here:** "Singapore vs SINGAPORE — formatting, not a mismatch" |
| 0.54 | Port of discharge | ✓ green |
| **0.70** | **Container count** | **✗ red — row flushes, shakes 4px, the `3` and `4` scale up** |
| 0.84 | Gross weight | ✓ green |
| 0.92 | — | Flag summary writes itself out below the table |

Hold the red row on screen for the remaining 30% of the scene. Do not move on
from it. This is the single frame you want in a judge's memory.

The casing callout at 0.42 is worth the space: it is the detail that separates a
real verifier from a naive string diff, and no competing team will have animated
it.

---

### Scene 4 — The Handoff (640–760vh, pinned 120vh)

**Houses:** `Reliability` copy.

*"When it can't be sure, it asks a person instead of guessing."*

The plane hesitates mid-air — hovers, wobbles on `rotateZ`, a `?` halo pulses
around it. The path forks: one branch auto-resolves, the other rises toward a
simple human marker. The plane takes the human branch and is received.

Four seconds of animation on the one sentence that is a product decision rather
than a feature. Most hackathon landing pages animate throughput. Animate
restraint instead.

Background begins returning toward light.

---

### Scene 5 — The Landing (760–900vh, not pinned)

**Houses:** `ModelsDeploy`, `HowItWorks`, `FinalCta`, `Footer`.

Back to the light palette. The plane unfolds a final time into a flat report
page which settles into the CTA panel and becomes the card behind
"Open the app". The protagonist ends as the thing the user is being asked to go
use.

`Access` (Web / REST API / MCP) folds into this scene as three lanes off the
landing strip. Add one magnetic hover on the primary CTA — pointer offset × 0.25,
eased, radius ~90px, disabled on touch. One magnetic button is elegant; six is a
gimmick.

---

## 5. Technical architecture

### Dependencies to add

```bash
npm i gsap @gsap/react lenis
```

That is the entire list. ~45 KB gzipped combined.

| Package | Role | Licence |
|---|---|---|
| `gsap` + ScrollTrigger, MotionPath, SplitText | scroll choreography | Free for commercial use since v3.13 — the formerly Club-only plugins are included. Re-check https://gsap.com/pricing before shipping. |
| `@gsap/react` | `useGSAP()` — scoped contexts, automatic cleanup on unmount, React 19 safe | MIT |
| `lenis` | smooth/inertia scroll, `lenis/react` binding | MIT © darkroom.engineering |

### Reference implementations

- **https://github.com/lusionltd/WebGL-Scroll-Sync** — MIT, published by Lusion
  themselves. Read it for the canvas-scrolls-with-the-page pattern even though
  you are not shipping WebGL; the scroll-sync discipline transfers directly.
- **https://github.com/darkroomengineering/lenis** — the GSAP ticker wiring is in
  the README. Copy it exactly.

### The single scroll loop — non-negotiable

One Lenis instance, one rAF, GSAP's ticker driving it:

```ts
const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
```

No component may add its own `scroll` listener. `Reveal` is deleted, not kept
alongside — two scroll systems competing is exactly how these pages end up
janky.

### Theme shift

Scenes drive the CSS custom properties directly:

```ts
gsap.to(document.documentElement, {
  "--page": "#0d0b1a", "--fg": "#ffffff",
  scrollTrigger: { trigger: scene2, start: "top bottom", end: "top top", scrub: true },
});
```

Because every component already reads `--page` / `--fg` / `--line`, the whole
page re-themes with no per-component work. **Constraint:** the manual theme
toggle must still win. Gate the scroll-driven shift behind a
`data-scene-theme` attribute and skip it entirely when the user has explicitly
chosen dark — a user who picked dark should not be shoved into light at the CTA.

### File layout

```
app/_components/scroll/
  scroll-provider.tsx     "use client" — Lenis + GSAP ticker, mounted once in layout
  use-scene.ts            hook: registers a pinned ScrollTrigger, returns progress 0–1
  use-magnetic.ts         pointer-follow hook for the CTA
  paper-plane.tsx         the SVG
  plane-layer.tsx         fixed layer, MotionPath along #flight-path, the only mover
  flight-path.tsx         hidden <svg><path id="flight-path"/></svg>
app/_components/landing/
  scene-fold.tsx  scene-inbox.tsx  scene-scanner.tsx
  scene-compare.tsx  scene-handoff.tsx  scene-landing.tsx
```

Every scene component wraps the existing section component — the copy moves, it
is not rewritten.

Client-only: `next/dynamic` with `ssr: false` for `plane-layer`, but **the
section content itself stays server-rendered**. All text must be in the initial
HTML for SEO and for the no-JS case.

### Deleted

- `reveal.tsx` — replaced by scrubbed timelines
- `orb-field.tsx` on the landing page — the generic-ness is concentrated here.
  Keep it in the dashboard if you like it there.

---

## 6. Accessibility, performance, demo safety

**`prefers-reduced-motion: reduce`** — no pinning, no plane, no theme scrub.
Sections render as a plain vertical document with instant opacity. This is not a
degraded mode, it is a correct mode; check it renders sensibly, because someone
on the judging panel may have it on.

**Keyboard** — pinned sections must not trap Tab. Every CTA reachable and
focus-visible. Test the whole page with Tab alone before you call it done.

**Performance budget** — 60fps on integrated graphics. Animate only `transform`
and `opacity` (the CSS-variable scrub is the one deliberate exception and it is
cheap). No `box-shadow`, `filter`, `width` or `top` in any scrubbed timeline.
Cap the envelope cloud at 24 elements; drop to 8 below 768px.

**Mobile (< 768px)** — unpin everything, flatten to vertical sections, keep the
plane but confine it to a small fixed corner sprite that advances on scroll. No
magnetic hover. Target: usable one-handed, no horizontal overflow anywhere.

**Demo kill switch** — support `?motion=off` to force the reduced-motion path.
If the projector at finals stutters, that query param saves the demo. Put it in
the runbook.

---

## 7. Build order

Ship in this sequence so that you always have something demoable:

1. `ScrollProvider` + Lenis + GSAP ticker. Page behaves identically, just smoother. **Commit.**
2. Flight path + fixed plane layer + MotionPath. Plane flies over the unchanged page. **Commit.**
3. Scene 3 (Comparison) — the money shot, built first, in case time runs out. **Commit.**
4. Scenes 0, 2 — fold and unfold. **Commit.**
5. Theme scrub. **Commit.**
6. Scenes 1, 4, 5. **Commit.**
7. Reduced-motion path, mobile, keyboard, `?motion=off`. **Commit.**

After step 3 you already have a landing page nobody will mistake for a template.

---

## 8. Do not

- Add a preloader or a percentage counter. You have 30 seconds of a judge's
  attention; do not spend the first three on a loading bar for a page that
  loads instantly.
- Use fire-once entrance animations anywhere. If it does not scrub backwards,
  it does not ship.
- Add a custom cursor, grain overlay, or chromatic aberration. They were in the
  original agency prompt; they read as costume here and they cost frames.
- Invent copy. Every word comes from the existing sections or from the real
  demo data (booking 4471, Singapore → Hamburg, SI 3 / BL 4).
- Let the scroll-driven theme override an explicit user theme choice.
- Ship more than one magnetic element.

---

## 9. Deliverables

1. File-structure diff against the tree in §5, before writing code.
2. Working code for: `ScrollProvider`, `use-scene`, `plane-layer` + flight path,
   the fold/unfold transform, Scene 3 in full, and one other scene.
3. The reduced-motion and mobile fallbacks, actually tested, not asserted.
4. A note on measured frame time in Scene 3 with the DevTools performance panel
   open — a number, not a claim.

Ask before deviating on: the protagonist, the scene count, or the dependency
list. Everything else is yours.
