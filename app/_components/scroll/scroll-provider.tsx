"use client";

import Lenis from "lenis";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap, ScrollTrigger } from "./gsap";
import { STORY_MIN_WIDTH } from "./scene-config";
import { StoryProvider, type StoryMode } from "./story-context";

function decideMode(): StoryMode {
  const params = new URLSearchParams(window.location.search);
  // ?motion=off is the demo kill switch: if the projector stutters, reload with it.
  if (params.get("motion") === "off") return "static";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "static";
  if (document.documentElement.getAttribute("data-motion") === "reduced") return "static";
  return window.innerWidth >= STORY_MIN_WIDTH ? "story" : "mobile";
}

/**
 * Mounted once around the landing page. Owns the ONE smooth-scroll loop:
 * one Lenis instance, driven by GSAP's ticker, feeding ScrollTrigger. Nothing else may
 * add its own scroll listener.
 */
export function ScrollProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<StoryMode>("static");
  const lenisRef = useRef<Lenis | null>(null);

  // Decide the mode after mount (the server render is always the plain "static" document).
  // The <html data-story> flag is set in the SAME step as the state change: children' effects run before
  // this component's own effects, so if the flag waited for an effect the scenes would measure their scroll
  // ranges against the not-yet-pinned layout.
  useEffect(() => {
    const apply = () => {
      const next = decideMode();
      const root = document.documentElement;
      if (next === "static") root.removeAttribute("data-story");
      else root.setAttribute("data-story", next === "story" ? "on" : "mobile");
      setMode(next);
    };
    apply();
    const queries = [
      window.matchMedia(`(min-width: ${STORY_MIN_WIDTH}px)`),
      window.matchMedia("(prefers-reduced-motion: reduce)"),
    ];
    queries.forEach((q) => q.addEventListener("change", apply));
    return () => {
      queries.forEach((q) => q.removeEventListener("change", apply));
      document.documentElement.removeAttribute("data-story");
    };
  }, []);

  // Once the layout has switched, re-measure every trigger; fonts change text heights, so again when they load
  useEffect(() => {
    if (mode === "static") return;
    const refresh = () => ScrollTrigger.refresh();
    const frame = requestAnimationFrame(refresh);
    void document.fonts?.ready.then(refresh);
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  // Smooth scroll only for the full story; phones keep native touch scrolling
  useEffect(() => {
    if (mode !== "story") return;

    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    lenisRef.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // In-page anchors must go through Lenis, otherwise the browser's instant jump fights it
    const onAnchorClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]');
      if (!link) return;
      const target = document.querySelector(link.getAttribute("href") ?? "");
      if (!target) return;
      event.preventDefault();
      // Pinned scenes start blank, so land a little way into them
      const into = Number(target.getAttribute("data-jump") ?? 0) * window.innerHeight;
      lenis.scrollTo(target as HTMLElement, { offset: into, duration: 1.6 });
    };
    document.addEventListener("click", onAnchorClick);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
      window.history.scrollRestoration = previousRestoration;
    };
  }, [mode]);

  return <StoryProvider value={{ mode, lenis: lenisRef }}>{children}</StoryProvider>;
}
