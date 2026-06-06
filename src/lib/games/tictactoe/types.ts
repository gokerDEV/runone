export type PlayerRole = "host" | "player";
export type SymbolMark = "X" | "O";
export type TimingMode = "untimed" | "timed";
export type SessionStatus = "created" | "joined" | "playing" | "finished" | "expired";
export type FinishReason = "win" | "draw" | "timeout" | "forfeit";

export type TicTacToeCell = SymbolMark | null;

export type TicTacToeState = {
  board: TicTacToeCell[];
  currentTurn: PlayerRole;
  moveCount: number;
  hostTimeouts: number;
  playerTimeouts: number;
  winningLine?: number[];
};

export type PlayerInfo = {
  localUserId: string;
  nickname: string;
  challengeMsg?: string;
  giphyUrl?: string;
};

export type GameResult = {
  winnerRole?: PlayerRole;
  loserRole?: PlayerRole;
  reason: FinishReason;
  winningLine?: number[];
};

export type GameSession = {
  _id: string;
  gameId: "tic-tac-toe";
  status: SessionStatus;
  host: PlayerInfo;
  player?: PlayerInfo;
  settings: { timingMode: TimingMode; turnSeconds?: number };
  state: TicTacToeState;
  result?: GameResult;
  createdAt: string;
  expiresAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
};

export const DEFAULT_TURN_SECONDS = 15;
export const MAX_TIMEOUTS_BEFORE_LOSS = 3;
export const MAX_POST_GAME_MESSAGE_LENGTH = 80;
export const INVITE_LINK_TTL_MINUTES = 60;
