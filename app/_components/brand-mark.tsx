/** Small logo tile used by the landing nav, dashboard sidebar and auth pages. */
export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-royal text-white shadow-sm ${className}`}
    >
      <svg width="55%" height="55%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5M8.5 13.5l2 2 4-4.5" />
      </svg>
    </span>
  );
}
