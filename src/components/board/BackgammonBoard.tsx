import { useMemo, type ReactNode } from "react";
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

type Pip = readonly [number, number];

const topIdx = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] as const;
const bottomIdx = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] as const;

const diePips: Record<number, readonly Pip[]> = {
  1: [[50, 50]],
  2: [[32, 32], [68, 68]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 27], [70, 27], [30, 50], [70, 50], [30, 73], [70, 73]],
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
      candidates.sort((a, b) => a.die - b.die);
      onApply(candidates[0]);
      onSelect(null);
      return;
    }
    const point = state.points[idx];
    if (point.color === myColor && point.count > 0 && moves.some((m) => m.from === idx)) {
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
    const point = state.points[idx];
    const isSel = selected === idx;
    const isLegal = legalDests.includes(idx);
    const tone = idx % 2 === 0 ? "#8e8e93" : "#d1d1d6";

    return (
      <button
        key={idx}
        type="button"
        onClick={() => clickPoint(idx)}
        className={`relative h-full min-w-0 overflow-hidden rounded-[18px] outline-none transition duration-150 ${
          isMyTurn ? "hover:bg-white/45 active:scale-[0.985]" : "cursor-default"
        } ${isSel ? "ring-2 ring-[#0a84ff] ring-offset-2 ring-offset-[#e5e5e7]" : ""} ${
          isLegal ? "ring-2 ring-[#0a84ff]/70 ring-offset-2 ring-offset-[#e5e5e7]" : ""
        }`}
        aria-label={`Point ${idx + 1}`}
      >
        <PointSlot top={top} fill={tone} />
        <div className={`absolute inset-x-0 ${top ? "top-2" : "bottom-2"} flex flex-col items-center ${top ? "justify-start" : "justify-end"} gap-1`}>
          {Array.from({ length: Math.min(point.count, 5) }).map((_, i) => (
            <Checker key={i} color={point.color} />
          ))}
        </div>
        {point.count > 5 && (
          <span className={`absolute ${top ? "top-2" : "bottom-2"} left-1/2 -translate-x-1/2 rounded-full bg-[#1c1c1e]/85 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm`}>
            {point.count}
          </span>
        )}
        {isLegal && <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a84ff] shadow-[0_0_0_7px_rgba(10,132,255,0.18)]" />}
      </button>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto rounded-[34px] border border-[#c7c7cc] bg-[#f2f2f4] p-3 shadow-[0_24px_64px_rgba(28,28,30,0.20),inset_0_1px_0_rgba(255,255,255,0.85)]">
      <div className="relative overflow-hidden rounded-[26px] border border-[#c7c7cc] bg-[#e5e5e7] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),inset_0_-1px_0_rgba(28,28,30,0.08)]">
        <div className="pointer-events-none absolute left-1/2 top-3 bottom-3 z-10 w-[4px] -translate-x-1/2 rounded-full bg-[#8e8e93] shadow-[1px_0_0_rgba(255,255,255,0.75),-1px_0_0_rgba(28,28,30,0.15)]" />

        <div className="relative z-0 grid grid-rows-[1fr_1fr] gap-5">
          <BoardRow indices={topIdx} top renderPoint={renderPoint} />
          <BoardRow indices={bottomIdx} top={false} renderPoint={renderPoint} />
        </div>

        <div className="pointer-events-none absolute inset-x-4 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between">
          <BarStack
            color="black"
            count={state.bar.black}
            selected={myColor === "black" && selected === "bar"}
            onClick={clickBar}
          />
          <div className="pointer-events-auto flex items-center gap-2 rounded-[18px] border border-[#c7c7cc]/80 bg-[#f9f9fb]/88 px-2.5 py-2 shadow-[0_14px_32px_rgba(28,28,30,0.16),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur">
            {state.rolled ? (
              <div className="flex items-center gap-2">
                {state.dice.map((d, i) => <Die key={`${d}-${i}`} v={d} />)}
              </div>
            ) : isMyTurn && !state.pendingDouble && !state.winner ? (
              <button
                type="button"
                onClick={onRoll}
                className="rounded-full bg-[#0a84ff] px-4 py-2 text-xs font-bold text-white shadow-[0_8px_20px_rgba(10,132,255,0.28)] transition hover:bg-[#0071e3] active:scale-95"
              >
                Roll
              </button>
            ) : (
              <span className="px-2 text-[11px] font-semibold text-[#636366]">waiting…</span>
            )}
            <button
              type="button"
              disabled={!canOffer}
              onClick={onOfferDouble}
              className={`rounded-[14px] outline-none transition ${canOffer ? "hover:scale-105 active:scale-95" : "opacity-45"}`}
              aria-label="Doubling cube"
            >
              <DoublingCube value={state.cube.value} />
            </button>
          </div>
          <BarStack
            color="white"
            count={state.bar.white}
            selected={myColor === "white" && selected === "bar"}
            onClick={clickBar}
          />
        </div>

        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-[18px] border border-[#c7c7cc]/80 bg-[#f9f9fb]/88 px-2.5 py-2 shadow-[0_12px_28px_rgba(28,28,30,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur">
          <OffTray color="white" count={state.off.white} />
          <OffTray color="black" count={state.off.black} />
        </div>

        <div className="relative z-30 mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={clickOff}
            disabled={!isMyTurn || selected === null || !moves.some((m) => m.from === selected && m.to === "off")}
            className="rounded-full border border-[#c7c7cc] bg-[#f9f9fb] px-3 py-1.5 text-[11px] font-semibold text-[#1c1c1e] shadow-sm transition hover:bg-white disabled:opacity-35 disabled:hover:bg-[#f9f9fb]"
          >
            Bear off
          </button>
          <span className="rounded-full bg-[#d1d1d6]/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#636366]">
            {isMyTurn ? "Your turn" : "Opponent"}
          </span>
          <button
            type="button"
            onClick={onEndTurn}
            disabled={!canEndTurn}
            className="rounded-full border border-[#c7c7cc] bg-[#f9f9fb] px-3 py-1.5 text-[11px] font-semibold text-[#1c1c1e] shadow-sm transition hover:bg-white disabled:opacity-35 disabled:hover:bg-[#f9f9fb]"
          >
            End turn
          </button>
        </div>
      </div>
    </div>
  );
}

function BoardRow({
  indices,
  top,
  renderPoint,
}: {
  indices: readonly number[];
  top: boolean;
  renderPoint: (idx: number, top: boolean) => ReactNode;
}) {
  return (
    <div className="grid h-48 grid-cols-[repeat(6,minmax(0,1fr))_1.45rem_repeat(6,minmax(0,1fr))] gap-1.5 rounded-[22px] border border-[#c7c7cc]/80 bg-[#f2f2f4] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
      {indices.slice(0, 6).map((i) => renderPoint(i, top))}
      <div className="rounded-full bg-[#8e8e93]/70 shadow-[inset_1px_0_0_rgba(255,255,255,0.65)]" />
      {indices.slice(6).map((i) => renderPoint(i, top))}
    </div>
  );
}

function PointSlot({ top, fill }: { top: boolean; fill: string }) {
  const path = top
    ? "M12 0 H88 Q98 0 96 10 L58 92 Q50 108 42 92 L4 10 Q2 0 12 0 Z"
    : "M12 100 H88 Q98 100 96 90 L58 8 Q50 -8 42 8 L4 90 Q2 100 12 100 Z";

  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill={fill} />
      <path d={path} fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d={top ? "M15 2 H85" : "M15 98 H85"} stroke="rgba(28,28,30,0.12)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Checker({ color }: { color: Color | null }) {
  if (!color) return null;
  const isWhite = color === "white";
  const fill = isWhite ? "#f9f9fb" : "#1c1c1e";
  const stroke = isWhite ? "#c7c7cc" : "#3a3a3c";
  const highlight = isWhite ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)";
  const inner = isWhite ? "rgba(28,28,30,0.08)" : "rgba(255,255,255,0.08)";

  return (
    <svg className="h-8 w-8 shrink-0 drop-shadow-[0_4px_8px_rgba(28,28,30,0.22)]" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="17.5" fill={fill} />
      <circle cx="20" cy="20" r="16.5" fill="none" stroke={stroke} strokeWidth="2" />
      <circle cx="15" cy="13" r="6.5" fill={highlight} opacity="0.75" />
      <circle cx="20" cy="20" r="10.5" fill="none" stroke={inner} strokeWidth="2" />
    </svg>
  );
}

function Die({ v }: { v: number }) {
  return (
    <svg className="h-9 w-9 shrink-0 drop-shadow-[0_5px_10px_rgba(28,28,30,0.18)]" viewBox="0 0 100 100" aria-label={`Die ${v}`}>
      <rect x="7" y="7" width="86" height="86" rx="22" fill="#f9f9fb" />
      <rect x="8.5" y="8.5" width="83" height="83" rx="20.5" fill="none" stroke="#c7c7cc" strokeWidth="3" />
      <path d="M24 14 H74 Q86 14 86 26" fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth="5" strokeLinecap="round" />
      {(diePips[v] ?? []).map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7.5" fill="#1c1c1e" />
      ))}
    </svg>
  );
}

function DoublingCube({ value }: { value: number }) {
  return (
    <svg className="h-9 w-9 shrink-0 drop-shadow-[0_5px_10px_rgba(28,28,30,0.16)]" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="7" y="7" width="86" height="86" rx="24" fill="#f9f9fb" />
      <rect x="8.5" y="8.5" width="83" height="83" rx="22.5" fill="none" stroke="#c7c7cc" strokeWidth="3" />
      <text x="50" y="54" textAnchor="middle" dominantBaseline="middle" fontSize="34" fontWeight="900" fill="#1c1c1e">
        {value}
      </text>
    </svg>
  );
}

function OffTray({ color, count }: { color: Color; count: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-[#e5e5e7] px-2 py-1 text-[11px] font-bold text-[#1c1c1e] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <MiniChecker color={color} />
      <span>{count}</span>
    </div>
  );
}

function MiniChecker({ color }: { color: Color }) {
  const isWhite = color === "white";
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill={isWhite ? "#f9f9fb" : "#1c1c1e"} stroke={isWhite ? "#c7c7cc" : "#3a3a3c"} strokeWidth="1.5" />
    </svg>
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
      className={`pointer-events-auto flex h-16 w-12 flex-col items-center justify-center gap-0.5 rounded-[18px] border border-[#c7c7cc]/80 bg-[#f9f9fb]/88 shadow-[0_10px_22px_rgba(28,28,30,0.13),inset_0_1px_0_rgba(255,255,255,0.95)] transition disabled:opacity-45 ${
        selected ? "ring-2 ring-[#0a84ff]" : ""
      }`}
      aria-label={`${color} bar`}
    >
      {count > 0 ? (
        <>
          <Checker color={color} />
          <span className="text-[10px] font-bold text-[#1c1c1e]">{count}</span>
        </>
      ) : (
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#8e8e93]">bar</span>
      )}
    </button>
  );
}
