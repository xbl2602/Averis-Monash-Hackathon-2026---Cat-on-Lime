"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_KEY = "sdv-theme";
export const MOTION_KEY = "sdv-motion";

/**
 * Runs in <head> before first paint (see app/layout.tsx) so the page never flashes the wrong theme.
 * Saved choice wins; otherwise follow the OS colour scheme.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.setAttribute("data-theme",t);if(localStorage.getItem("${MOTION_KEY}")==="reduced"){d.setAttribute("data-motion","reduced")}}catch(e){d.setAttribute("data-theme","light")}})();`;

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // Keep several open tabs in sync
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY && (event.newValue === "light" || event.newValue === "dark")) {
      document.documentElement.setAttribute("data-theme", event.newValue);
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
  };
}

function prefersReducedMotion(): boolean {
  return (
    document.documentElement.getAttribute("data-motion") === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Current theme + setters. The attribute on <html> is the single source of truth. */
export function useTheme() {
  const theme = useSyncExternalStore<Theme>(subscribeToTheme, readTheme, () => "light");

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement;
    if (readTheme() === next) return;
    if (!prefersReducedMotion()) {
      root.classList.add("theme-switching");
      window.setTimeout(() => root.classList.remove("theme-switching"), 800);
    }
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked (private mode); the theme still changes for this visit.
    }
  }, []);

  const toggleTheme = useCallback(() => setTheme(readTheme() === "dark" ? "light" : "dark"), [setTheme]);

  return { theme, setTheme, toggleTheme };
}
