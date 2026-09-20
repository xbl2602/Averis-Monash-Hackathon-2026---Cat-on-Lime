"use client";

import { useTheme } from "./theme";

// Track + both thumb circles as one continuous outline; see .theme-switch in globals.css
const OUTLINE_PATH =
  "M 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 A 42.24 42.24 90 0 0 84.4992 42.2496 A 42.24 42.24 90 0 0 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 L 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 A 42.24 42.24 90 0 0 128 42.2496 A 42.24 42.24 90 0 0 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 L 42.2496 0";

export function ThemeToggle({ size = "md", className = "" }: { size?: "md" | "lg"; className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Dark theme on. Switch to light theme" : "Light theme on. Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className={`theme-switch ${size === "lg" ? "theme-switch--lg" : ""} ${className}`}
    >
      <svg className="theme-switch__outline" viewBox="0 0 212.4992 84.4688" aria-hidden="true">
        <path pathLength={360} d={OUTLINE_PATH} />
      </svg>
      <span className="theme-switch__thumb">
        <svg className="theme-switch__icon theme-switch__icon--sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5" />
        </svg>
        <svg className="theme-switch__icon theme-switch__icon--moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a.6.6 0 0 0-.8-.7A9.5 9.5 0 1 0 21.2 15a.6.6 0 0 0-.7-.8Z" />
        </svg>
      </span>
    </button>
  );
}
