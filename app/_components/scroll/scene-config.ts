/**
 * Scroll budget of the landing story, in vh (1 = one viewport height of scrolling).
 * The scene wrappers get their CSS height from these numbers and the plane's master
 * timeline reads the same numbers, so layout and animation can never drift apart.
 *
 *   0    100  hero / "The Fold"          natural height = 100vh, not pinned
 *   100  280  "The Inbox"       pinned 180
 *   280  460  "The Scanner"     pinned 180
 *   460  670  "The Comparison"  pinned 210   <- the product demo
 *   670  800  "The Handoff"     pinned 130
 *   800  950  "The Workspace"   pinned 150   <- what the user gets after the check
 *   950  ...  "The Landing"     natural flow (its height decides where the story ends)
 */
export const SCENE_VH = {
  fold: { start: 0, length: 100 },
  inbox: { start: 100, pin: 180 },
  scanner: { start: 280, pin: 180 },
  compare: { start: 460, pin: 210 },
  handoff: { start: 670, pin: 130 },
  workspace: { start: 800, pin: 150 },
  landing: { start: 950 },
} as const;

export type SceneName = keyof typeof SCENE_VH;
export type PinnedScene = Exclude<SceneName, "fold" | "landing">;

/**
 * A pinned scene builds itself in the first BUILD of its scroll (its timeline is compressed into that
 * span), then HOLDS: everything stays on screen, complete and readable, and nothing moves until the
 * quick crossfade into the next scene. Without the hold a scene finished at the very moment it faded out.
 */
export const BUILD = 0.68;

/** vh position of a point inside a scene's build, p = 0 (scene pins) .. 1 (fully built) */
export function sceneAt(name: PinnedScene, p: number): number {
  const scene = SCENE_VH[name];
  return scene.start + scene.pin * BUILD * p;
}

/** vh position where a pinned scene lets go */
export function sceneEnd(name: PinnedScene): number {
  const scene = SCENE_VH[name];
  return scene.start + scene.pin;
}

/** Below this width the story is flattened to a normal vertical page (plane becomes a corner sprite). */
export const STORY_MIN_WIDTH = 768;
