"use client";

import { createContext, useContext, type RefObject } from "react";
import type Lenis from "lenis";

/**
 * story  = full scroll-driven experience (desktop, motion allowed)
 * mobile = flat vertical page + a small corner plane sprite
 * static = plain vertical page, no motion at all (reduced motion, ?motion=off, no JS yet)
 */
export type StoryMode = "story" | "mobile" | "static";

interface StoryContextValue {
  mode: StoryMode;
  lenis: RefObject<Lenis | null>;
}

const StoryContext = createContext<StoryContextValue | null>(null);

export const StoryProvider = StoryContext.Provider;

export function useStory(): StoryContextValue {
  const ctx = useContext(StoryContext);
  if (!ctx) throw new Error("useStory must be used inside <ScrollProvider>");
  return ctx;
}
