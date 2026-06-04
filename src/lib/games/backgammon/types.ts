export type Color = "white" | "black";
export type Point = { color: Color | null; count: number };
export type Move = { from: number | "bar"; to: number | "off"; die: number };

export type BgState = {
  points: Point[]; // length 24
  bar: { white: number; black: number };
  off: { white: number; black: number };
  turn: Color;
  dice: number[]; // remaining die values
  rolled: boolean;
  cube: { value: number; owner: Color | "center" };
  pendingDouble?: Color; // who offered
  winner?: Color;
  endReason?: "win" | "resign" | "decline";
};

export type BgPlayer = { localUserId: string; nickname: string };

export type BgSession = {
  _id: string;
  gameId: "backgammon";
  status: "created" | "playing" | "finished";
  host: BgPlayer; // white
  player?: BgPlayer; // black
  state: BgState;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
};

// host plays white, player plays black
export const colorOf = (role: "host" | "player"): Color => (role === "host" ? "white" : "black");
export const roleOf = (color: Color): "host" | "player" => (color === "white" ? "host" : "player");
