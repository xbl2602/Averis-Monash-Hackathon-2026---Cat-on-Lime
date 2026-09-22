import { gsap, ScrollTrigger } from "./gsap";
import { PLANE_H, PLANE_W } from "./paper-plane";
import { SEGMENT_COUNT, U, WAYPOINTS, type Vec } from "./flight-waypoints";
import { applyThemeMix, clearThemeMix, themeScrollAllowed } from "./scene-palette";
import { SCENE_VH, sceneAt, sceneEnd } from "./scene-config";

/**
 * Everything the plane is, as ONE object that is a function of scroll.
 *
 * The plane is a single element in a fixed layer. Its position, rotation, scale, fold and the page's
 * theme are the fields of `state`; one master timeline (scrubbed by the whole page's scroll) tweens
 * those fields, and one ticker callback turns them into DOM transforms. Scenes never move the plane,
 * they only own their own content. Scrolling back therefore plays everything in reverse, for free.
 */
export interface PlaneState {
  /** Position along the route: 3.4 = 40% of the way from waypoint 3 to 4 */
  u: number;
  /** 0 = flat page, 1 = folded paper plane */
  fold: number;
  scale: number;
  alpha: number;
  /** Hesitation wobble: amplitude (0..1) and phase (radians) */
  wobAmp: number;
  wobT: number;
  /** Where the page theme sits: 0 light, 0.5 dusk, 1 dark */
  mix: number;
  /** 0..1 progress of docking into the final call-to-action card */
  dock: number;
}

/** The sheet behind the hero card, and the plane in flight, are deliberately small: the protagonist must never crowd the copy */
const SHEET_SCALE = 1.6;
const FLIGHT_SCALE = 0.9;
const STAGE_SHEET_SCALE = 1.3;
/** How faint the plane gets while it passes over text (0 = invisible) */
const GHOST_ALPHA = 0.2;

const WING_ANGLE = 46;
const BODY_TILT = 36;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export type RigMode = "story" | "mobile";

/**
 * A block of text (or a card with text) that the plane fades out of the way of. Blocks inside a pinned
 * scene are measured once relative to their stage, which fills the viewport while the scene shows;
 * blocks in normal flow (hero, final section) have no stage and are measured live.
 */
interface Avoid {
  el: HTMLElement;
  stage: HTMLElement | null;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class PlaneRig {
  private readonly state: PlaneState = {
    u: 0,
    fold: 0,
    scale: SHEET_SCALE,
    alpha: 1,
    wobAmp: 0,
    wobT: 0,
    mix: 0,
    dock: 0,
  };

  private ctx: gsap.Context | null = null;
  private segments: SVGPathElement[] = [];
  private lengths: number[] = [];
  private lastAngle = 0;
  private lastKey = "";
  private themeActive = false;
  /** Last theme position written to the page: setting ~25 custom properties restyles the whole document, so only when it moved */
  private lastMix = Number.NaN;
  private lastZ = "";
  private hidden = false;
  private cta: HTMLElement | null = null;
  private lastFill = "";
  /** Regions of readable text the plane must not hide (elements marked data-avoid) */
  private avoids: Avoid[] = [];
  /** 1 = solid, GHOST_ALPHA = faint: eases towards whichever the plane needs right now */
  private ghost = 1;

  private readonly plane: HTMLElement;
  private readonly body: HTMLElement;
  private readonly wingL: SVGElement;
  private readonly wingR: SVGElement;
  private readonly keel: SVGElement;
  private readonly polyL: SVGPolygonElement;
  private readonly polyR: SVGPolygonElement;
  private readonly lineGroups: SVGElement[];
  private readonly flightSvg: SVGElement;
  private readonly fullPath: SVGPathElement;

  constructor(
    private readonly layer: HTMLElement,
    private readonly mode: RigMode
  ) {
    const q = <T extends Element>(selector: string) => layer.querySelector(selector) as T;
    this.plane = q<HTMLElement>("[data-plane]");
    this.body = q<HTMLElement>("[data-plane-body]");
    this.wingL = q<SVGElement>('[data-part="wing-l"]');
    this.wingR = q<SVGElement>('[data-part="wing-r"]');
    this.keel = q<SVGElement>('[data-part="keel"]');
    this.polyL = q<SVGPolygonElement>('[data-part="poly-l"]');
    this.polyR = q<SVGPolygonElement>('[data-part="poly-r"]');
    this.lineGroups = Array.from(layer.querySelectorAll<SVGElement>('[data-part="lines"]'));
    this.flightSvg = q<SVGElement>("[data-flight-svg]");
    this.fullPath = q<SVGPathElement>("[data-flight-full]");
    this.segments = Array.from(layer.querySelectorAll<SVGPathElement>("[data-flight-seg]"));
  }

  /** Start the rig. Returns the cleanup function. */
  mount(): () => void {
    if (this.mode === "mobile") return this.mountSprite();

    if (new URLSearchParams(window.location.search).get("debug") === "path") {
      this.flightSvg.classList.add("is-debug");
    }

    this.build();
    gsap.ticker.add(this.apply);

    // The route and the master timeline depend on the viewport and on the page height: rebuild on change
    let timer = 0;
    const scheduleRebuild = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => this.build(), 160);
    };
    const resizeObserver = new ResizeObserver(scheduleRebuild);
    resizeObserver.observe(document.body);
    window.addEventListener("resize", scheduleRebuild);
    void document.fonts?.ready.then(scheduleRebuild);

    // The manual theme toggle must win: watch for it and hand the palette back
    const themeObserver = new MutationObserver(() => this.syncThemeGate());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    this.syncThemeGate();

    return () => {
      window.clearTimeout(timer);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("resize", scheduleRebuild);
      gsap.ticker.remove(this.apply);
      this.ctx?.revert();
      this.ctx = null;
      clearThemeMix();
      this.themeActive = false;
      this.cta?.style.removeProperty("--cta-fill");
      this.lastFill = "";
    };
  }

  // ---------------------------------------------------------------- route

  /** Turn the waypoints (viewport fractions) into pixel paths: one smooth Catmull-Rom curve, split per segment */
  private buildPath(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pts: Vec[] = WAYPOINTS.map(([x, y]) => [x * w, y * h]);

    // The route starts behind the hero report card, wherever the layout put it
    const hero = document.getElementById("hero-report");
    if (hero) {
      const r = hero.getBoundingClientRect();
      pts[0] = [r.right - 12, r.top + window.scrollY + 46];
    }

    const last = pts.length - 1;
    const full: string[] = [`M ${pts[0][0]} ${pts[0][1]}`];
    for (let k = 0; k < SEGMENT_COUNT; k++) {
      const p0 = pts[Math.max(k - 1, 0)];
      const p1 = pts[k];
      const p2 = pts[k + 1];
      const p3 = pts[Math.min(k + 2, last)];
      const c1: Vec = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2: Vec = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      const curve = `C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
      this.segments[k].setAttribute("d", `M ${p1[0]} ${p1[1]} ${curve}`);
      full.push(curve);
    }
    this.fullPath.setAttribute("d", full.join(" "));
    this.lengths = this.segments.map((s) => s.getTotalLength());
  }

  private samplePoint(u: number): { x: number; y: number; angle: number } {
    const k = Math.min(SEGMENT_COUNT - 1, Math.max(0, Math.floor(u)));
    const f = clamp01(u - k);
    const path = this.segments[k];
    const len = this.lengths[k];
    const at = f * len;
    const p = path.getPointAtLength(at);
    // Heading from a point a little ahead (or behind, at the very end of a segment)
    const ahead = at + 4 <= len ? path.getPointAtLength(at + 4) : null;
    const dx = ahead ? ahead.x - p.x : p.x - path.getPointAtLength(Math.max(0, at - 4)).x;
    const dy = ahead ? ahead.y - p.y : p.y - path.getPointAtLength(Math.max(0, at - 4)).y;
    return { x: p.x, y: p.y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
  }

  // ------------------------------------------------------- master timeline

  private build(): void {
    this.ctx?.revert();
    this.buildPath();
    this.cta = document.querySelector<HTMLElement>("[data-cta]");
    this.collectAvoids();
    Object.assign(this.state, {
      u: 0,
      fold: 0,
      scale: SHEET_SCALE,
      alpha: 1,
      wobAmp: 0,
      wobT: 0,
      mix: 0,
      dock: 0,
    } satisfies PlaneState);
    this.ghost = 1;
    this.lastKey = "";

    this.ctx = gsap.context(() => {
      const vh = window.innerHeight;
      const max = ScrollTrigger.maxScroll(window);
      if (max <= 0) return;
      // Scene positions are authored in vh-percent (100 = one viewport of scrolling); the page ends at endVH
      const endVH = (max / vh) * 100;
      const s = this.state;

      // Timeline positions are fractions of the page's total scroll
      const at = (v: number) => Math.min(v, endVH) / endVH;
      const span = (a: number, b: number) => Math.max(0.0001, at(b) - at(a));

      const tl = gsap.timeline({
        defaults: { ease: "none", immediateRender: false },
        scrollTrigger: { start: 0, end: "max", scrub: 0.6 },
      });
      const tween = (
        from: Partial<PlaneState>,
        to: Partial<PlaneState>,
        a: number,
        b: number,
        ease = "none"
      ) => {
        tl.fromTo(s, from, { ...to, duration: span(a, b), ease }, at(a));
      };

      // Every event below is placed inside a scene's BUILD (sceneAt(name, 0..1)), so the plane, like the
      // scene's content, has finished moving by the time the scene starts to hold.
      const { inbox, compare } = SCENE_VH;

      // -- Route: which stretch of the path each scene flies
      tween({ u: 0 }, { u: U.heroEnd }, 0, inbox.start, "power1.inOut");
      tween({ u: U.heroEnd }, { u: U.inboxEnd }, sceneAt("inbox", 0), sceneAt("inbox", 1));
      tween({ u: U.inboxEnd }, { u: U.scannerEnd }, sceneAt("scanner", 0), sceneAt("scanner", 1));
      tween({ u: U.scannerEnd }, { u: U.compareEnd }, sceneAt("compare", 0), sceneAt("compare", 1));
      tween({ u: U.compareEnd }, { u: U.handoffHover }, sceneAt("handoff", 0), sceneAt("handoff", 0.333));
      tween({ u: U.handoffHover }, { u: U.handoffNode }, sceneAt("handoff", 0.333), sceneAt("handoff", 0.625));
      tween({ u: U.handoffNode }, { u: U.handoffEnd }, sceneAt("handoff", 0.625), sceneAt("handoff", 1));
      // After the handoff the plane leaves through the top-right corner, so the workspace scene is never covered
      tween({ u: U.handoffEnd }, { u: U.landingEnd }, sceneAt("workspace", 0), sceneAt("workspace", 0.35));

      // -- Fold: page -> plane (hero), plane -> two sheets (scanner), sheets -> plane (handoff)
      tween({ fold: 0 }, { fold: 1 }, 0, 70, "power2.inOut");
      tween({ fold: 1 }, { fold: 0 }, sceneAt("scanner", 0.59), sceneAt("scanner", 0.88), "power2.inOut");
      tween({ fold: 0 }, { fold: 1 }, sceneAt("handoff", 0.07), sceneAt("handoff", 0.42), "power2.inOut");

      // -- Size: a modest sheet behind the card, a small plane in flight, a sheet again in the scanner
      tween({ scale: SHEET_SCALE }, { scale: FLIGHT_SCALE }, 0, 80, "power2.inOut");
      tween({ scale: FLIGHT_SCALE }, { scale: STAGE_SHEET_SCALE }, sceneAt("scanner", 0.59), sceneAt("scanner", 0.88), "power2.inOut");
      tween({ scale: STAGE_SHEET_SCALE }, { scale: FLIGHT_SCALE }, sceneAt("handoff", 0.07), sceneAt("handoff", 0.42), "power2.inOut");

      // -- Visibility: the comparison scene's own sheets take over from the plane, then hand it back
      tween({ alpha: 1 }, { alpha: 0 }, compare.start - 2, compare.start + 12);
      tween({ alpha: 0 }, { alpha: 1 }, sceneEnd("compare") - 10, sceneEnd("compare") + 4);

      // -- Handoff: the plane hesitates
      tween({ wobAmp: 0 }, { wobAmp: 1 }, sceneAt("handoff", 0.167), sceneAt("handoff", 0.375));
      tween({ wobAmp: 1 }, { wobAmp: 0 }, sceneAt("handoff", 0.65), sceneAt("handoff", 0.83));
      tween({ wobT: 0 }, { wobT: Math.PI * 14 }, sceneAt("handoff", 0.125), sceneAt("handoff", 0.83));

      // -- Theme: light -> dusk (end of the inbox) -> dark -> dusk (end of the handoff) -> light (workspace)
      tween({ mix: 0 }, { mix: 0.5 }, sceneAt("inbox", 0.5), sceneAt("inbox", 1));
      tween({ mix: 0.5 }, { mix: 1 }, sceneAt("scanner", 0), sceneAt("scanner", 0.38));
      tween({ mix: 1 }, { mix: 0.5 }, sceneAt("handoff", 0.5), sceneAt("handoff", 1));
      tween({ mix: 0.5 }, { mix: 0 }, sceneAt("workspace", 0.05), sceneAt("workspace", 0.55));

      // Timeline is exactly one unit long so scroll fraction == timeline progress
      tl.set({}, {}, 1);

      // -- Landing: the plane docks into the final call-to-action card
      const cta = this.cta;
      if (cta) {
        ScrollTrigger.create({
          trigger: cta,
          start: "top 92%",
          end: "center 58%",
          onUpdate: (self) => {
            s.dock = self.progress;
          },
          onRefresh: (self) => {
            s.dock = self.progress;
          },
        });
      }
    });
  }

  // ------------------------------------------------------- keeping clear of text

  /** Measure every block marked data-avoid. Blocks in a pinned scene are stored relative to their stage. */
  private collectAvoids(): void {
    const PAD = 10;
    this.avoids = Array.from(document.querySelectorAll<HTMLElement>("[data-avoid]")).map((el) => {
      const stage = el.closest<HTMLElement>(".scene-stage");
      if (!stage) return { el, stage: null, x: 0, y: 0, w: 0, h: 0 };
      const r = el.getBoundingClientRect();
      const s = stage.getBoundingClientRect();
      return { el, stage, x: r.left - s.left - PAD, y: r.top - s.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
    });
  }

  /** 1 when the plane is in clear space, GHOST_ALPHA when it overlaps text that is on screen right now */
  private ghostTarget(px: number, py: number, scale: number): number {
    // Before the first scroll the sheet sits BEHIND the hero card (lower layer), so there is nothing to hide
    if (window.scrollY <= 24) return 1;
    const vh = window.innerHeight;
    const reach = Math.max(PLANE_W, PLANE_H * 0.72) * scale * 0.5;

    for (const a of this.avoids) {
      let { x, y, w, h } = a;
      if (a.stage) {
        // GSAP writes the stage's fade as an inline opacity: a hidden scene has nothing to protect
        if (Number.parseFloat(a.stage.style.opacity || "0") < 0.3) continue;
      } else {
        const r = a.el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        x = r.left - 10;
        y = r.top - 10;
        w = r.width + 20;
        h = r.height + 20;
      }
      const nearestX = Math.min(Math.max(px, x), x + w);
      const nearestY = Math.min(Math.max(py, y), y + h);
      if ((px - nearestX) ** 2 + (py - nearestY) ** 2 < reach * reach) return GHOST_ALPHA;
    }
    return 1;
  }

  // ------------------------------------------------------------ per frame

  private syncThemeGate(): void {
    const allowed = themeScrollAllowed();
    if (allowed === this.themeActive) return;
    this.themeActive = allowed;
    if (!allowed) clearThemeMix();
    this.lastKey = ""; // force the next frame to re-apply
    this.lastMix = Number.NaN;
  }

  private readonly apply = (): void => {
    const s = this.state;
    const key = `${window.scrollY > 24}|${s.u.toFixed(4)}|${s.fold.toFixed(3)}|${s.scale.toFixed(3)}|${s.alpha.toFixed(3)}|${s.wobAmp.toFixed(2)}|${s.wobT.toFixed(2)}|${s.mix.toFixed(3)}|${s.dock.toFixed(3)}|${window.innerWidth}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    if (this.themeActive && (Number.isNaN(this.lastMix) || Math.abs(s.mix - this.lastMix) > 0.00005)) {
      applyThemeMix(s.mix);
      this.lastMix = s.mix;
    }

    // The sheet starts BEHIND the hero card (layer z 20 < hero z 30); the moment it lifts off it flies in front
    const z = window.scrollY > 24 ? "40" : "20";
    if (z !== this.lastZ) {
      this.layer.style.zIndex = z;
      this.lastZ = z;
    }

    // Invisible (the comparison scene's own sheets have taken over): nothing to position or fold
    if (s.alpha < 0.002 && s.dock === 0) {
      if (!this.hidden) this.plane.style.opacity = "0";
      this.hidden = true;
      return;
    }
    this.hidden = false;

    const { x, y, angle } = this.samplePoint(s.u);

    // Docking: blend from the route to the call-to-action card and settle into it
    const cta = s.dock > 0 ? this.cta : null;
    const rect = cta?.getBoundingClientRect();
    const glide = smooth(range(s.dock, 0, 0.62));
    const settle = smooth(range(s.dock, 0.62, 1));

    const px = rect ? lerp(x, rect.left + rect.width / 2, glide) : x;
    const py = rect ? lerp(y, rect.top + rect.height / 2, glide) : y;

    const fold = s.fold * (1 - glide);

    // Rotation: a flat sheet stays upright; a folded plane points along its heading
    const flatTilt = 8 * (1 - range(s.u, 0, 1.5));
    let heading = angle + 90;
    heading += 360 * Math.round((this.lastAngle - heading) / 360);
    this.lastAngle = heading;
    const wobble = s.wobAmp * 7 * Math.sin(s.wobT);
    const rotation = lerp(flatTilt, heading, smooth(fold)) * (1 - glide) + wobble;

    const sx = rect ? lerp(s.scale, rect.width / PLANE_W, settle) : s.scale;
    const sy = rect ? lerp(s.scale, rect.height / PLANE_H, settle) : s.scale;

    // Over readable text the plane fades to a faint ghost and comes back once it is clear of it.
    // Only in the last stretch of docking into the call-to-action does it turn solid: it is about to become the card.
    const ghostTarget = glide > 0.85 ? 1 : this.ghostTarget(px, py, s.scale);
    this.ghost += (ghostTarget - this.ghost) * 0.22;
    if (Math.abs(ghostTarget - this.ghost) < 0.01) this.ghost = ghostTarget;
    else this.lastKey = ""; // still easing: run again next frame even if nothing else moved
    const alpha = s.alpha * this.ghost * (1 - range(s.dock, 0.86, 1));

    this.plane.style.opacity = String(alpha);
    this.plane.style.setProperty("--fold", fold.toFixed(3));
    this.plane.style.transform = `translate3d(${px - PLANE_W / 2}px, ${py - PLANE_H / 2}px, 0) rotate(${rotation}deg) scale(${sx}, ${sy})`;

    // The fold itself: corners walk to the crease, wings tilt up, the body pitches forward
    const corner = 50 * fold;
    this.polyL.setAttribute("points", `50,0 ${corner},0 0,100 50,100`);
    this.polyR.setAttribute("points", `0,0 ${50 - corner},0 50,100 0,100`);
    this.wingL.style.transform = `rotateY(${fold * WING_ANGLE}deg)`;
    this.wingR.style.transform = `rotateY(${-fold * WING_ANGLE}deg)`;
    this.body.style.transform = `rotateX(${fold * BODY_TILT}deg)`;
    this.keel.style.opacity = String(fold * fold);
    const lineOpacity = String(clamp01(1 - fold * 2.4));
    this.lineGroups.forEach((g) => g.style.setProperty("opacity", lineOpacity));

    // Before the plane arrives the call-to-action card has no fill of its own; the plane becomes it
    const fill = cta ? String(settle) : "0";
    if (fill !== this.lastFill) {
      this.cta?.style.setProperty("--cta-fill", fill);
      this.lastFill = fill;
    }
  };

  // --------------------------------------------------------- phone sprite

  /** Phones: no story, just a small plane in the corner that climbs as you scroll */
  private mountSprite(): () => void {
    const setFold = (fold: number) => {
      this.polyL.setAttribute("points", `50,0 ${50 * fold},0 0,100 50,100`);
      this.polyR.setAttribute("points", `0,0 ${50 - 50 * fold},0 50,100 0,100`);
      this.wingL.style.transform = `rotateY(${fold * WING_ANGLE}deg)`;
      this.wingR.style.transform = `rotateY(${-fold * WING_ANGLE}deg)`;
      this.body.style.transform = `rotateX(${fold * BODY_TILT}deg)`;
      this.keel.style.opacity = String(fold * fold);
      this.lineGroups.forEach((g) => g.style.setProperty("opacity", "0"));
    };
    setFold(1);
    this.plane.style.opacity = "1";

    const place = (progress: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = w - 44 - Math.sin(progress * 18) * 6;
      const y = h - 70 - progress * (h - 150);
      this.plane.style.transform = `translate3d(${x - PLANE_W / 2}px, ${y - PLANE_H / 2}px, 0) rotate(${Math.sin(progress * 18) * 8}deg) scale(0.42)`;
    };
    place(0);

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => place(self.progress),
    });
    const onResize = () => place(trigger.progress);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      trigger.kill();
    };
  }
}
