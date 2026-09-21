"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  // The Settings switch writes data-motion="reduced" on <html>
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches || document.documentElement.getAttribute("data-motion") === "reduced";
}

/** True when the visitor asked for less motion (OS setting or the switch in Settings). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
