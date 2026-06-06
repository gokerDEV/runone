import type { BgState, Color, Move, Point } from "./types";

export function startingState(): BgState {
  const points: Point[] = Array.from({ length: 24 }, () => ({ color: null, count: 0 }));
  // White moves from high indices toward 0; home = 0..5
  points[23] = { color: "white", count: 2 };
  points[12] = { color: "white", count: 5 };
  points[7] = { color: "white", count: 3 };
  points[5] = { color: "white", count: 5 };
  // Black moves from low indices toward 23; home = 18..23
  points[0] = { color: "black", count: 2 };
  points[11] = { color: "black", count: 5 };
  points[16] = { color: "black", count: 3 };
  points[18] = { color: "black", count: 5 };
  return {
    points,
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn: "white",
    dice: [],
    rolled: false,
    cube: { value: 1, owner: "center" },
  };
}

export function rollDice(state: BgState, isCheat: boolean = false): BgState {
  if (state.rolled || state.winner || state.pendingDouble) return state;
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = isCheat ? d1 : 1 + Math.floor(Math.random() * 6);
  const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  return { ...state, dice, rolled: true };
}

function barCount(state: BgState, color: Color): number {
  return color === "white" ? state.bar.white : state.bar.black;
}

function canLand(state: BgState, idx: number, color: Color): boolean {
  if (idx < 0 || idx > 23) return false;
  const p = state.points[idx];
  if (p.color === null || p.color === color) return true;
  return p.count <= 1; // blot — can hit
}

export function allInHome(state: BgState, color: Color): boolean {
  if (barCount(state, color) > 0) return false;
  if (color === "white") {
    for (let i = 6; i < 24; i++) {
      const p = state.points[i];
      if (p.color === "white" && p.count > 0) return false;
    }
  } else {
    for (let i = 0; i < 18; i++) {
      const p = state.points[i];
      if (p.color === "black" && p.count > 0) return false;
    }
  }
  return true;
}

function highestOccupied(state: BgState, color: Color): number {
  if (color === "white") {
    for (let i = 5; i >= 0; i--) {
      const p = state.points[i];
      if (p.color === "white" && p.count > 0) return i;
    }
    return -1;
  }
  for (let i = 18; i <= 23; i++) {
    const p = state.points[i];
    if (p.color === "black" && p.count > 0) return i;
  }
  return -1;
}

export function legalMoves(state: BgState, color: Color): Move[] {
  if (state.turn !== color || !state.rolled || state.winner || state.pendingDouble) return [];
  const moves: Move[] = [];
  const dice = Array.from(new Set(state.dice));
  if (barCount(state, color) > 0) {
    for (const d of dice) {
      const dest = color === "white" ? 24 - d : d - 1;
      if (canLand(state, dest, color)) moves.push({ from: "bar", to: dest, die: d });
    }
    return moves;
  }
  const inHome = allInHome(state, color);
  const highest = inHome ? highestOccupied(state, color) : -1;
  for (let i = 0; i < 24; i++) {
    const p = state.points[i];
    if (p.color !== color || p.count === 0) continue;
    for (const d of dice) {
      const tgt = color === "white" ? i - d : i + d;
      if (tgt >= 0 && tgt <= 23 && canLand(state, tgt, color)) {
        moves.push({ from: i, to: tgt, die: d });
      }
    }
    if (inHome) {
      for (const d of dice) {
        if (color === "white") {
          const req = i + 1; // point 0 needs die 1
          if (d === req) moves.push({ from: i, to: "off", die: d });
          else if (d > req && i === highest) moves.push({ from: i, to: "off", die: d });
        } else {
          const req = 24 - i; // point 23 needs die 1
          if (d === req) moves.push({ from: i, to: "off", die: d });
          else if (d > req && i === highest) moves.push({ from: i, to: "off", die: d });
        }
      }
    }
  }
  return moves;
}

export function applyMove(state: BgState, color: Color, mv: Move): BgState {
  const points = state.points.map((p) => ({ ...p }));
  const bar = { ...state.bar };
  const off = { ...state.off };

  if (mv.from === "bar") {
    if (color === "white") bar.white--;
    else bar.black--;
  } else {
    const p = points[mv.from];
    p.count--;
    if (p.count === 0) p.color = null;
  }

  if (mv.to === "off") {
    if (color === "white") off.white++;
    else off.black++;
  } else {
    const dest = points[mv.to];
    if (dest.color && dest.color !== color) {
      if (dest.color === "white") bar.white++;
      else bar.black++;
      dest.count = 0;
      dest.color = null;
    }
    dest.color = color;
    dest.count++;
  }

  const dice = state.dice.slice();
  const di = dice.indexOf(mv.die);
  if (di >= 0) dice.splice(di, 1);

  const next: BgState = { ...state, points, bar, off, dice };
  if (off.white === 15) {
    next.winner = "white";
    next.endReason = "win";
  } else if (off.black === 15) {
    next.winner = "black";
    next.endReason = "win";
  }
  return next;
}

export function endTurn(state: BgState): BgState {
  return {
    ...state,
    dice: [],
    rolled: false,
    turn: state.turn === "white" ? "black" : "white",
  };
}

export function canOfferDouble(state: BgState, color: Color): boolean {
  if (state.winner || state.pendingDouble) return false;
  if (state.turn !== color) return false;
  if (state.rolled) return false;
  if (state.cube.owner !== "center" && state.cube.owner !== color) return false;
  if (state.cube.value >= 64) return false;
  return true;
}

export function offerDouble(state: BgState, color: Color): BgState {
  if (!canOfferDouble(state, color)) return state;
  return { ...state, pendingDouble: color };
}

export function acceptDouble(state: BgState): BgState {
  if (!state.pendingDouble) return state;
  const owner: Color = state.pendingDouble === "white" ? "black" : "white";
  return { ...state, cube: { value: state.cube.value * 2, owner }, pendingDouble: undefined };
}

export function declineDouble(state: BgState): BgState {
  if (!state.pendingDouble) return state;
  const winner: Color = state.pendingDouble;
  return { ...state, pendingDouble: undefined, winner, endReason: "decline" };
}

export function resign(state: BgState, color: Color): BgState {
  return { ...state, winner: color === "white" ? "black" : "white", endReason: "resign" };
}

// advantage 0..1 (0 = white winning fully, 1 = black winning fully)
// Standard pip count comparison.
export function advantage(state: BgState): number {
  let wPips = state.bar.white * 25;
  let bPips = state.bar.black * 25;
  for (let i = 0; i < 24; i++) {
    const p = state.points[i];
    if (p.color === "white") wPips += (i + 1) * p.count;
    if (p.color === "black") bPips += (24 - i) * p.count;
  }
  const total = wPips + bPips;
  if (total === 0) return 0.5;
  // lower pip = closer to winning. white winning => low w/total. we want 0 for white winning.
  return wPips / total;
}
