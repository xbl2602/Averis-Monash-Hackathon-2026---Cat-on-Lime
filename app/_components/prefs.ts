"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MOTION_KEY, THEME_KEY } from "./theme";

// Per-viewer conveniences only (nothing here is shared or sensitive), kept in this browser's localStorage.
export const PROVIDER_PREF_KEY = "sdv-pref-provider";
export const LIMIT_PREF_KEY = "sdv-pref-limit";
export const DEFAULT_PROVIDER = "gemini";
export const DEFAULT_LIMIT = "20";

const PREF_EVENT = "sdv-pref-change";
const ALL_PREF_KEYS = [PROVIDER_PREF_KEY, LIMIT_PREF_KEY, MOTION_KEY, THEME_KEY];

function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** A string preference persisted in localStorage; safe on the server (returns the fallback). */
export function usePref(key: string, fallback: string): [string, (value: string) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key || event.key === null) onChange();
      };
      const onLocalChange = (event: Event) => {
        if ((event as CustomEvent<string>).detail === key) onChange();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(PREF_EVENT, onLocalChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(PREF_EVENT, onLocalChange);
      };
    },
    [key]
  );

  const value = useSyncExternalStore(
    subscribe,
    () => readPref(key, fallback),
    () => fallback
  );

  const setValue = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // Storage blocked: the setting simply won't persist beyond this page view.
      }
      window.dispatchEvent(new CustomEvent(PREF_EVENT, { detail: key }));
    },
    [key]
  );

  return [value, setValue];
}

/** Forget every saved preference and go back to the OS colour scheme. */
export function resetAllPreferences(): void {
  try {
    ALL_PREF_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // nothing stored, nothing to reset
  }
  const root = document.documentElement;
  root.removeAttribute("data-motion");
  root.setAttribute("data-theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  ALL_PREF_KEYS.forEach((key) => window.dispatchEvent(new CustomEvent(PREF_EVENT, { detail: key })));
}
