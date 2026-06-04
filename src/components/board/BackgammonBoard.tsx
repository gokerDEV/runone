import { useMemo } from "react";
import type { BgState, Color, Move } from "@/lib/games/backgammon/types";
import { legalMoves } from "@/lib/games/backgammon/engine";

type Props = {
  state: BgState;
  myColor: Color | null;
  selected: number | "bar" | null;
  onSelect: (src: number | "bar" | null) => void;
  onApply: (mv: Move) => void;
  onRoll: () => void;
  onEndTurn: () => void;
  onOfferDouble: () => void;
  isMyTurn: boolean;
  canOffer: boolean;
};

export function BackgammonBoard({
  state,
  myColor,
  selected,
  onSelect,
  onApply,
  onRoll,
  onEndTurn,
  onOfferDouble,
  isMyTurn,
  canOffer,
}: Props) {
  const moves = useMemo(() => (myColor ? legalMoves(state, myColor) : []), [state, myColor]);
  const legalDests = useMemo(
    () => (selected !== null ? moves.filter((m) => m.from === selected).map((m) => m.to) : []),
    [selected, moves],
  );
  const canEndTurn = isMyTurn && state.rolled && moves.length === 0;

  function clickPoint(idx: number) {
    if (!isMyTurn || !myColor) return;
    const bar = myColor === "white" ? state.bar.white : state.bar.black;
    if (bar > 0 && selected !== "bar") {
      onSelect("bar");
      return;
    }
    if (selected !== null && legalDests.includes(idx)) {
      const candidates = moves.filter((m) => m.from === selected && m.to === idx);
      // prefer larger die when bearing off would otherwise waste; otherwise smaller die
      candidates.sort((a, b) => a.die - b.die);
      onApply(candidates[0]);
      onSelect(null);
      return;
    }
    const p = state.points[idx];
    if (p.color === myColor && p.count > 0 && moves.some((m) => m.from === idx)) {
      onSelect(idx);
    } else {
      onSelect(null);
    }
  }

  function clickOff() {
    if (!isMyTurn || !myColor || selected === null) return;
    const cand = moves.filter((m) => m.from === selected && m.to === "off");
    if (cand.length === 0) return;
    cand.sort((a, b) => a.die - b.die);
    onApply(cand[0]);
    onSelect(null);
  }

  function clickBar() {
    if (!isMyTurn || !myColor) return;
    const bar = myColor === "white" ? state.bar.white : state.bar.black;
    if (bar > 0) onSelect("bar");
  }

  function renderPoint(idx: number, top: boolean) {
    const p = state.points[idx];
    const isSel = selected === idx;
    const isLegal = legalDests.includes(idx);
    const dark = idx % 2 === 0;
    return (
      <button
        key={idx}
        type="button"
        onClick={() => clickPoint(idx)}
        className={`relative flex-1 h-full flex flex-col ${top ? "justify-start" : "justify-end"} items-center gap-[1px] py-1
          ${dark ? "bg-amber-800/60" : "bg-amber-950/70"}
          ${isSel ? "ring-2 ring-yellow-300 z-10" : ""}
          ${isLegal ? "ring-2 ring-emerald-400 z-10" : ""}
        `}
        aria-label={`Point ${idx + 1}`}
      >
        {Array.from({ length: Math.min(p.count, 5) }).map((_, i) => (
          <Checker key={i} color={p.color} />
        ))}
        {p.count > 5 && (
          <span className={`absolute ${top ? "top-1" : "bottom-1"} text-[9px] font-bold text-white bg-black/60 px-1 rounded`}>
            {p.count}
          </span>
        )}
      </button>
    );
  }

  const topIdx = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const bottomIdx = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-1 bg-amber-950 p-1.5 rounded-lg shadow-inner">
      {/* Top points */}
      <div className="flex h-28 gap-px">
        {topIdx.slice(0, 6).map((i) => renderPoint(i, true))}
        <div className="w-3 bg-amber-950" />
        {topIdx.slice(6).map((i) => renderPoint(i, true))}
      </div>

      {/* Center bar + dice + cube */}
      <div className="flex items-center justify-between bg-amber-900/80 px-2 py-1.5 rounded">
        <BarStack
          color="black"
          count={state.bar.black}
          selected={myColor === "black" && selected === "bar"}
          onClick={clickBar}
        />
        <div className="flex items-center gap-1.5">
          {state.rolled ? (
            state.dice.map((d, i) => <Die key={i} v={d} />)
          ) : isMyTurn && !state.pendingDouble && !state.winner ? (
            <button
              type="button"
              onClick={onRoll}
              className="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded"
            >
              Roll
            </button>
          ) : (
            <span className="text-[10px] text-amber-200 opacity-60">waiting…</span>
          )}
        </div>
        <button
          type="button"
          disabled={!canOffer}
          onClick={onOfferDouble}
          className={`text-xs font-black h-8 w-8 rounded border-2 flex items-center justify-center
            ${canOffer ? "bg-white text-black border-yellow-300 hover:bg-yellow-100" : "bg-white/50 text-black/50 border-white/40"}`}
          aria-label="Doubling cube"
        >
          {state.cube.value}
        </button>
        <BarStack
          color="white"
          count={state.bar.white}
          selected={myColor === "white" && selected === "bar"}
          onClick={clickBar}
        />
      </div>

      {/* Bottom points */}
      <div className="flex h-28 gap-px">
        {bottomIdx.slice(0, 6).map((i) => renderPoint(i, false))}
        <div className="w-3 bg-amber-950" />
        {bottomIdx.slice(6).map((i) => renderPoint(i, false))}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-1 px-1 pt-0.5">
        <button
          type="button"
          onClick={clickOff}
          disabled={
            !isMyTurn || selected === null || !moves.some((m) => m.from === selected && m.to === "off")
          }
          className="text-[11px] font-semibold bg-emerald-700 disabled:opacity-30 text-white px-2 py-1 rounded"
        >
          Bear off
        </button>
        <div className="text-[10px] text-amber-200 flex gap-2">
          <span>● Off W:{state.off.white}</span>
          <span>● Off B:{state.off.black}</span>
        </div>
        <button
          type="button"
          onClick={onEndTurn}
          disabled={!canEndTurn}
          className="text-[11px] font-semibold bg-amber-600 disabled:opacity-30 text-white px-2 py-1 rounded"
        >
          End turn
        </button>
      </div>
    </div>
  );
}

function Checker({ color }: { color: Color | null }) {
  if (!color) return null;
  return (
    <div
      className={`h-3.5 w-5 rounded-full border ${
        color === "white"
          ? "bg-stone-100 border-stone-400"
          : "bg-stone-900 border-stone-600"
      }`}
    />
  );
}

function Die({ v }: { v: number }) {
  return (
    <div className="h-8 w-8 bg-white rounded text-black font-black text-lg flex items-center justify-center shadow">
      {v}
    </div>
  );
}

function BarStack({
  color,
  count,
  selected,
  onClick,
}: {
  color: Color;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      className={`h-10 w-8 rounded flex flex-col items-center justify-center gap-px disabled:opacity-30
        ${selected ? "ring-2 ring-yellow-300" : ""}
        bg-amber-950/80`}
      aria-label={`${color} bar`}
    >
      {count > 0 ? (
        <>
          <Checker color={color} />
          <span className="text-[10px] font-bold text-white">{count}</span>
        </>
      ) : (
        <span className="text-[9px] text-white/40">bar</span>
      )}
    </button>
  );
}
