/**
 * 背景装饰用的漂浮光晕，纯 CSS 动画（见 globals.css 的 .orb / drift 关键帧）。
 * 只是视觉效果，不含任何业务逻辑，父容器需要 position: relative + overflow: hidden。
 */
export function OrbField({ tone = "light" }: { tone?: "light" | "dark" }) {
  const a = tone === "dark" ? "var(--color-halo)" : "var(--color-indigo)";
  const b = tone === "dark" ? "var(--color-indigo)" : "var(--color-halo)";
  const c = "var(--color-royal)";

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
