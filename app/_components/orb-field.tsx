/**
 * Decorative floating aurora blobs, pure CSS animation (see .orb / drift in globals.css).
 * Visual only, no business logic. The parent needs position: relative + overflow: hidden.
 *  - tone="auto" (default): colours follow the active theme
 *  - tone="dark": always the dark-palette colours (for panels that are dark in both themes)
 */
export function OrbField({ tone = "auto" }: { tone?: "auto" | "dark" }) {
  const a = tone === "dark" ? "var(--color-halo)" : "var(--orb-1)";
  const b = tone === "dark" ? "var(--color-indigo)" : "var(--orb-2)";
  const c = tone === "dark" ? "var(--color-royal)" : "var(--orb-3)";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="orb animate-drift-a"
        style={{
          width: 460,
          height: 460,
          top: -140,
          right: -100,
          background: `radial-gradient(circle, ${a}, transparent 70%)`,
        }}
      />
      <div
        className="orb animate-drift-b"
        style={{
          width: 360,
          height: 360,
          bottom: -120,
          left: -80,
          background: `radial-gradient(circle, ${b}, transparent 70%)`,
        }}
      />
      <div
        className="orb animate-drift-c"
        style={{
          width: 280,
          height: 280,
          top: "45%",
          left: "55%",
          opacity: 0.35,
          background: `radial-gradient(circle, ${c}, transparent 70%)`,
        }}
      />
    </div>
  );
}
