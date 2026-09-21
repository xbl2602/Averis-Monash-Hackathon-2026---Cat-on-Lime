"use client";

/** Plain on/off switch for settings that don't need the animated theme switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors duration-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent/50 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "border-accent bg-accent" : "border-line-strong bg-sunken"
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}
