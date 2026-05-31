export function WinnerProgressBar({ advantage }: { advantage: number }) {
  // 0 = host wins (left), 1 = player wins (right)
  const hostPct = Math.round((1 - advantage) * 100);
  const playerPct = 100 - hostPct;
  return (
    <div className="px-4 py-2">
      <div className="h-2 w-full rounded-full overflow-hidden flex bg-muted">
        <div className="bg-indigo-500 transition-all duration-500" style={{ width: `${hostPct}%` }} />
        <div className="bg-rose-500 transition-all duration-500" style={{ width: `${playerPct}%` }} />
      </div>
    </div>
  );
}
