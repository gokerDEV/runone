import type { PlayerRole, SymbolMark, TicTacToeCell, TicTacToeState } from "./types";

export const WINNING_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const symbolFor = (role: PlayerRole): SymbolMark => (role === "host" ? "X" : "O");
export const roleFor = (sym: SymbolMark): PlayerRole => (sym === "X" ? "host" : "player");

export function emptyState(): TicTacToeState {
  return {
    board: Array<TicTacToeCell>(9).fill(null),
    currentTurn: "host",
    moveCount: 0,
    hostTimeouts: 0,
    playerTimeouts: 0,
  };
}

export function findWinningLine(
  board: TicTacToeCell[],
): { line: number[]; mark: SymbolMark } | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return { line, mark: v };
  }
  return null;
}

export function applyMove(
  state: TicTacToeState,
  role: PlayerRole,
  cellIndex: number,
): TicTacToeState {
  if (state.winningLine) throw new Error("Game already finished");
  if (state.currentTurn !== role) throw new Error("Not your turn");
  if (cellIndex < 0 || cellIndex > 8) throw new Error("Invalid cell");
  if (state.board[cellIndex] !== null) throw new Error("Cell already taken");

  const board = state.board.slice();
  board[cellIndex] = symbolFor(role);
  const win = findWinningLine(board);
  return {
    ...state,
    board,
    moveCount: state.moveCount + 1,
    currentTurn: role === "host" ? "player" : "host",
    winningLine: win?.line,
  };
}

// 0 = host fully wins (left), 1 = player fully wins (right), 0.5 = neutral.
export function advantage(
  state: TicTacToeState,
  result?: { winnerRole?: PlayerRole; reason: string },
): number {
  if (result?.winnerRole === "host") return 0;
  if (result?.winnerRole === "player") return 1;
  if (result && !result.winnerRole) return 0.5;

  let host = 0;
  let player = 0;
  if (state.board[4] === "X") host += 1;
  if (state.board[4] === "O") player += 1;
  for (const c of [0, 2, 6, 8]) {
    if (state.board[c] === "X") host += 0.5;
    if (state.board[c] === "O") player += 0.5;
  }
  for (const line of WINNING_LINES) {
    const vals = line.map((i) => state.board[i]);
    const xs = vals.filter((v) => v === "X").length;
    const os = vals.filter((v) => v === "O").length;
    if (xs === 2 && os === 0) host += 2;
    if (os === 2 && xs === 0) player += 2;
  }
  const total = host + player;
  if (total === 0) return 0.5;
  return player / total;
}

export function isDraw(state: TicTacToeState): boolean {
  return state.moveCount >= 9 && !state.winningLine;
}
