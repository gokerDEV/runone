import type { TicTacToeCell } from "@/lib/games/tictactoe/types";

type Props = {
  board: TicTacToeCell[];
  winningLine?: number[];
  disabled: boolean;
  onCell: (index: number) => void;
};

export function TicTacToeBoard({ board, winningLine, disabled, onCell }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 aspect-square w-full max-w-[min(85%,360px)] mx-auto">
      {board.map((cell, i) => {
        const isWin = winningLine?.includes(i);
        const clickable = !disabled && cell === null;
        return (
          <button
            key={i}
            type="button"
            disabled={!clickable}
            onClick={() => onCell(i)}
            className={`aspect-square rounded-xl flex items-center justify-center text-5xl font-black select-none transition-all
              ${isWin ? "bg-emerald-500/20 ring-2 ring-emerald-500" : "bg-muted hover:bg-muted/70"}
              ${cell === "X" ? "text-indigo-600" : "text-rose-600"}
              ${clickable ? "cursor-pointer" : "cursor-default"}`}
          >
            {cell}
          </button>
        );
      })}
    </div>
  );
}
