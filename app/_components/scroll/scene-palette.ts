import { THEME_KEY } from "../theme";

/**
 * Scroll-driven theme for the landing story: light -> dusk -> dark -> dusk -> light.
 * It writes the SAME custom properties the components already read (--page, --fg, --line ...),
 * as inline styles on <html>, so no component needs any per-scene colour logic.
 *
 * Two dials:
 *   m (0..1)  where the PAGE background sits:  0 light, 0.5 dusk, 1 dark
 *   t (0..1)  how "dark-mode" the INK is (text, cards, lines). Derived from the page luminance so
 *             text flips at the point of best contrast and never sinks into a mid-grey page.
 *
 * The manual theme toggle always wins: this only runs while the page is in the light theme AND
 * the visitor has never picked a theme themselves (see themeScrollAllowed).
 */

type RGBA = [number, number, number, number];

function parseColor(value: string): RGBA {
  const v = value.trim();
  if (v.startsWith("#")) {
    const hex = v.slice(1);
    const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const parts = v.replace(/rgba?\(|\)/g, "").split(",").map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

function mixColor(a: RGBA, b: RGBA, t: number): RGBA {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

function toCss([r, g, b, a]: RGBA): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(3)})`;
}

// Page background stops (dark uses the deeper #0d0b1a of the scene, not the app's #120e24)
const PAGE_LIGHT = parseColor("#eef1f6");
const PAGE_DUSK = parseColor("#3b3f6b");
const PAGE_DARK = parseColor("#0d0b1a");

/** [light value, dark value] for every ink token. Mirrors the light and dark palettes in globals.css. */
const INK: Record<string, [string, string]> = {
  "--fg": ["#1c1c1e", "#ffffff"],
  "--fg-muted": ["rgba(28, 28, 30, 0.64)", "rgba(201, 194, 232, 0.72)"],
  "--fg-faint": ["rgba(28, 28, 30, 0.44)", "rgba(201, 194, 232, 0.45)"],
  "--line": ["rgba(28, 28, 30, 0.09)", "rgba(183, 169, 247, 0.16)"],
  "--line-strong": ["rgba(28, 28, 30, 0.2)", "rgba(183, 169, 247, 0.36)"],
  "--surface": ["rgba(255, 255, 255, 0.74)", "rgba(255, 255, 255, 0.07)"],
  "--surface-solid": ["#ffffff", "#1b1730"],
  "--sunken": ["rgba(28, 32, 60, 0.045)", "rgba(255, 255, 255, 0.05)"],
  "--accent": ["#0a7cff", "#6a5cff"],
  "--accent-strong": ["#0867d2", "#b7a9f7"],
  "--ok": ["#167a3a", "#34d3a4"],
  "--ok-soft": ["rgba(52, 199, 89, 0.15)", "rgba(52, 211, 164, 0.14)"],
  "--warn": ["#9a5b00", "#f5b447"],
  "--warn-soft": ["rgba(255, 159, 10, 0.17)", "rgba(245, 180, 71, 0.14)"],
  "--bad": ["#c0281f", "#ff8b8b"],
  "--bad-soft": ["rgba(255, 69, 58, 0.12)", "rgba(255, 107, 107, 0.14)"],
  "--code-bg": ["rgba(28, 32, 60, 0.06)", "rgba(255, 255, 255, 0.06)"],
  "--grad-a": ["#1c1c1e", "#7a6df0"],
  "--grad-b": ["#2a5fb8", "#a396f5"],
  "--grad-c": ["#0a7cff", "#b7a9f7"],
  // The paper plane re-themes with the page: white paper by day, lilac-white at night
  "--plane": ["#ffffff", "#efecff"],
  "--plane-shade": ["#dde3f0", "#b8b2d8"],
  "--plane-deep": ["#bcc4da", "#8580ad"],
};

const INK_PARSED = Object.fromEntries(
  Object.entries(INK).map(([name, [light, dark]]) => [name, [parseColor(light), parseColor(dark)] as const])
);

const LIGHT_ONLY = {
  "--card-shadow":
    "inset 0 1px 0 rgba(255, 255, 255, 0.95), inset -1px -1px 0 rgba(255, 255, 255, 0.4), 0 10px 34px rgba(30, 44, 90, 0.09), 0 1px 3px rgba(30, 44, 90, 0.06)",
  "--btn-bg": "#1c1c1e",
  "--btn-shadow": "inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 6px 16px rgba(28, 28, 30, 0.22)",
};
const DARK_ONLY = {
  "--card-shadow": "none",
  "--btn-bg": "linear-gradient(100deg, #5b4fe8, #241454)",
  "--btn-shadow": "0 8px 20px rgba(91, 79, 232, 0.25)",
};

const ALL_PROPS = ["--page", "--aurora", ...Object.keys(INK), ...Object.keys(LIGHT_ONLY)];

function pageColorAt(m: number): RGBA {
  return m < 0.5 ? mixColor(PAGE_LIGHT, PAGE_DUSK, m / 0.5) : mixColor(PAGE_DUSK, PAGE_DARK, (m - 0.5) / 0.5);
}

/** Perceived brightness 0..1 of a colour (gamma-space luma, good enough to pick the contrast flip point) */
function luma([r, g, b]: RGBA): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Apply the theme for page position m. Cheap enough to call every frame while m is changing. */
export function applyThemeMix(m: number): void {
  const root = document.documentElement;
  const page = pageColorAt(m);
  // Text flips to light within a narrow band around mid-grey (luma .55 -> .50): both text colours have similar
  // contrast there, and a wide blend would leave mid-grey text on a mid-grey page
  const t = clamp01((0.55 - luma(page)) / 0.05);

  root.style.setProperty("--page", toCss(page));
  root.style.setProperty("--aurora", String(clamp01(1 - m * 2.2)));
  for (const [name, [light, dark]] of Object.entries(INK_PARSED)) {
    root.style.setProperty(name, toCss(mixColor(light, dark, t)));
  }
  const discrete = t > 0.5 ? DARK_ONLY : LIGHT_ONLY;
  for (const [name, value] of Object.entries(discrete)) root.style.setProperty(name, value);
  root.setAttribute("data-scene-theme", "on");
}

/** Remove every inline override so the stored theme's own values apply again. */
export function clearThemeMix(): void {
  const root = document.documentElement;
  ALL_PROPS.forEach((name) => root.style.removeProperty(name));
  root.removeAttribute("data-scene-theme");
}

/**
 * The scroll-driven shift is only allowed when the visitor has not chosen a theme and the page is
 * in the light theme. Anyone who picked dark (or light) with the toggle, or whose system is dark,
 * keeps exactly that theme for the whole page.
 */
export function themeScrollAllowed(): boolean {
  const root = document.documentElement;
  if (root.getAttribute("data-theme") !== "light") return false;
  try {
    return localStorage.getItem(THEME_KEY) === null;
  } catch {
    return true;
  }
}
