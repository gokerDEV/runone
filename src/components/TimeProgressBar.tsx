export function TimeProgressBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  return (
    <div className="px-4 pb-2">
      <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted">
        <div
          className="h-full bg-amber-500 transition-[width] duration-200 linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
