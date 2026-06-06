export function WinnerProgressBar({ advantage }: { advantage: number }) {
  // 0 = host wins (left), 1 = player wins (right)
  const hostPct = Math.round((1 - advantage) * 100);
  const playerPct = 100 - hostPct;
  return (
    <>
      <div className="h-full w-full rounded-full overflow-hidden flex border shadow-sm">
        <div
          className="transition-all duration-500 border-r border-gray-300"
          style={{ width: `${hostPct}%`, backgroundColor: "rgb(251,249,244)" }}
        />
        <div
          className="transition-all duration-500"
          style={{ width: `${playerPct}%`, backgroundColor: "rgb(37,37,37)" }}
        />
      </div>
    </>
  );
}
