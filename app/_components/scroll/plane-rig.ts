import { gsap, ScrollTrigger } from "./gsap";
import { PLANE_H, PLANE_W } from "./paper-plane";
import { SEGMENT_COUNT, U, WAYPOINTS, type Vec } from "./flight-waypoints";
import { applyThemeMix, clearThemeMix, themeScrollAllowed } from "./scene-palette";
import { SCENE_VH, type SceneName } from "./scene-config";

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

const WING_ANGLE = 46;
const BODY_TILT = 36;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export type RigMode = "story" | "mobile";

export class PlaneRig {
  private readonly state: PlaneState = {
    u: 0,
    fold: 0,
    scale: 2.1,
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
    Object.assign(this.state, {
      u: 0,
      fold: 0,
      scale: 2.1,
      alpha: 1,
      wobAmp: 0,
      wobT: 0,
      mix: 0,
      dock: 0,
    } satisfies PlaneState);
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

      const { inbox, scanner, compare, handoff, landing } = SCENE_VH;
      const sceneEnd = (name: Exclude<SceneName, "fold" | "landing">) => {
        const scene = SCENE_VH[name];
        return scene.start + scene.pin;
      };

      // -- Route: which stretch of the path each scene flies
      tween({ u: 0 }, { u: U.heroEnd }, 0, inbox.start, "power1.inOut");
      tween({ u: U.heroEnd }, { u: U.inboxEnd }, inbox.start, sceneEnd("inbox"));
      tween({ u: U.inboxEnd }, { u: U.scannerEnd }, scanner.start, sceneEnd("scanner"));
      tween({ u: U.scannerEnd }, { u: U.compareEnd }, compare.start, sceneEnd("compare"));
      tween({ u: U.compareEnd }, { u: U.handoffHover }, handoff.start, handoff.start + 40);
      tween({ u: U.handoffHover }, { u: U.handoffNode }, handoff.start + 40, handoff.start + 75);
      tween({ u: U.handoffNode }, { u: U.handoffEnd }, handoff.start + 75, sceneEnd("handoff"));
      if (endVH > landing.start) tween({ u: U.handoffEnd }, { u: U.landingEnd }, landing.start, endVH);

      // -- Fold: page -> plane (hero), plane -> two sheets (scanner), sheets -> plane (handoff)
      tween({ fold: 0 }, { fold: 1 }, 0, 70, "power2.inOut");
      tween({ fold: 1 }, { fold: 0 }, scanner.start + 100, scanner.start + 150, "power2.inOut");
      tween({ fold: 0 }, { fold: 1 }, sceneEnd("compare") + 8, sceneEnd("compare") + 50, "power2.inOut");

      // -- Size: big sheet behind the card, plane while flying, sheet again in the scanner
      tween({ scale: 2.1 }, { scale: 1.35 }, 0, 80, "power2.inOut");
      tween({ scale: 1.35 }, { scale: 1.6 }, scanner.start + 100, scanner.start + 150, "power2.inOut");
      tween({ scale: 1.6 }, { scale: 1.35 }, sceneEnd("compare") + 8, sceneEnd("compare") + 50, "power2.inOut");

      // -- Visibility: the comparison scene's own sheets take over from the plane, then hand it back
      tween({ alpha: 1 }, { alpha: 0 }, compare.start - 2, compare.start + 12);
      tween({ alpha: 0 }, { alpha: 1 }, sceneEnd("compare") - 18, sceneEnd("compare"));

      // -- Handoff: the plane hesitates
      tween({ wobAmp: 0 }, { wobAmp: 1 }, handoff.start + 20, handoff.start + 45);
      tween({ wobAmp: 1 }, { wobAmp: 0 }, handoff.start + 78, handoff.start + 100);
      tween({ wobT: 0 }, { wobT: Math.PI * 14 }, handoff.start + 15, handoff.start + 100);

      // -- Theme: light -> dusk (end of the inbox) -> dark -> dusk (end of the handoff) -> light
      tween({ mix: 0 }, { mix: 0.5 }, inbox.start + 85, sceneEnd("inbox"));
      tween({ mix: 0.5 }, { mix: 1 }, scanner.start, scanner.start + 65);
      tween({ mix: 1 }, { mix: 0.5 }, handoff.start + 60, sceneEnd("handoff"));
      const lightAt = Math.max(landing.start + 20, Math.min(landing.start + 70, endVH - 5));
      if (endVH > landing.start) tween({ mix: 0.5 }, { mix: 0 }, landing.start, lightAt);

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
    const alpha = s.alpha * (1 - range(s.dock, 0.86, 1));

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
