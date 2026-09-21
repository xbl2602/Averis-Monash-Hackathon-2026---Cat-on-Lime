/** Shimmering placeholder shown while data loads. Size it with className (h-4 w-24, etc.). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Stack of table-like skeleton rows. */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 shrink-0 !rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-7 w-24 !rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}
