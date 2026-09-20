/**
 * Scroll budget of the landing story, in vh (1 = one viewport height of scrolling).
 * The scene wrappers get their CSS height from these numbers and the plane's master
 * timeline reads the same numbers, so layout and animation can never drift apart.
 *
 *   0    100  hero / "The Fold"          natural height = 100vh, not pinned
 *   100  270  "The Inbox"       pinned 170
 *   270  440  "The Scanner"     pinned 170
 *   440  640  "The Comparison"  pinned 200   <- the product demo
 *   640  760  "The Handoff"     pinned 120
 *   760  ...  "The Landing"     natural flow (its height decides where the story ends)
 */
export const SCENE_VH = {
  fold: { start: 0, length: 100 },
  inbox: { start: 100, pin: 170 },
  scanner: { start: 270, pin: 170 },
  compare: { start: 440, pin: 200 },
  handoff: { start: 640, pin: 120 },
  landing: { start: 760 },
} as const;

export type SceneName = keyof typeof SCENE_VH;

/** Below this width the story is flattened to a normal vertical page (plane becomes a corner sprite). */
export const STORY_MIN_WIDTH = 768;
