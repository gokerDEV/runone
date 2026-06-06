import { useMemo, useState, type ReactNode } from "react";
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
const diePips: Record<number, readonly Pip[]> = {
  1: [[50, 50]],
  2: [[32, 32], [68, 68]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 27], [70, 27], [30, 50], [70, 50], [30, 73], [70, 73]],
};

const pointX = [6.24, 13.67, 21.09, 28.54, 35.96, 43.39, 56.45, 63.91, 71.33, 78.76, 86.20, 93.63];

function DiePips({ v, x, y, size }: { v: number; x: number; y: number; size: number }) {
  if (!v) return null;
  const scale = size / 100;
  return (
    <>
      {(diePips[v] || []).map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={x + cx * scale} cy={y + cy * scale} r={7.5 * scale} fill="#1c1c1e" />
      ))}
    </>
  );
}

function BoardSVG({ dice, isMyTurn, rolled, rollingDice, onEmptyClick, canRoll }: { dice: number[]; isMyTurn: boolean; rolled: boolean; rollingDice: number[] | null; onEmptyClick?: () => void; canRoll: boolean; }) {
  let d1: number | null = null;
  let d2: number | null = null;
  
  const currentDice = rollingDice || dice;
  if (currentDice.length >= 3) {
    d1 = currentDice[0];
    d2 = currentDice[0];
  } else if (currentDice.length === 2) {
    d1 = currentDice[0];
    d2 = currentDice[1];
  } else if (currentDice.length === 1) {
    d1 = currentDice[0];
  }

  const showMyEmpty = canRoll && !rolled;
  const isAnimating = rollingDice !== null;

  return (
    <svg className="absolute inset-0 h-full w-full pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488.5 581.7">
      <defs>
        <style>{`.st0{fill:#f9f9fb;}.st1{fill:#efefed;}.st2{fill:#e5e5e7;}.st3{fill:#bcbcbc;}.st4{fill:#d8d4cb;}.st5{fill:none;stroke:#c7c7cc;stroke-width:1.9px;}`}</style>
      </defs>
      <rect className="st2" x=".5" y="46.5" width="488" height="488" rx="14.2" ry="14.2"/>
      <g>
        <rect className="st1" x="-114.7" y="177.2" width="471.9" height="226.7" rx="14.2" ry="14.2" transform="translate(-169.3 411.8) rotate(-90)"/>
        <rect className="st1" x="131.2" y="177.2" width="471.9" height="226.7" rx="14.2" ry="14.2" transform="translate(76.6 657.7) rotate(-90)"/>
      </g>
      <g>
        <path className="st3" d="M21.8,60.5h17.4c5,0,9,4.4,8.5,9.4l-8.7,82.6c-1.1,10.2-15.8,10.2-16.9,0l-8.7-82.6c-.5-5,3.4-9.4,8.5-9.4Z"/>
        <path className="st4" d="M56.5,60.5h20.6c4.2,0,7.5,3.6,7,7.8l-10.3,97.6c-.9,8.5-13.2,8.5-14.1,0l-10.3-97.6c-.4-4.2,2.8-7.8,7-7.8Z"/>
        <path className="st3" d="M91.2,60.5h23.7c3.4,0,6,2.9,5.6,6.3l-11.9,112.5c-.7,6.8-10.6,6.8-11.3,0l-11.9-112.5c-.4-3.3,2.3-6.3,5.6-6.3Z"/>
        <path className="st4" d="M127.6,60.5h23.7c3.4,0,6,2.9,5.6,6.3l-11.9,112.5c-.7,6.8-10.6,6.8-11.3,0l-11.9-112.5c-.4-3.3,2.3-6.3,5.6-6.3Z"/>
        <path className="st3" d="M165.4,60.5h20.6c4.2,0,7.5,3.6,7,7.8l-10.3,97.6c-.9,8.5-13.2,8.5-14.1,0l-10.3-97.6c-.4-4.2,2.8-7.8,7-7.8Z"/>
        <path className="st4" d="M203.3,60.5h17.4c5,0,9,4.4,8.5,9.4l-8.7,82.6c-1.1,10.2-15.8,10.2-16.9,0l-8.7-82.6c-.5-5,3.4-9.4,8.5-9.4Z"/>
      </g>
      <g>
        <path className="st3" d="M267.1,60.5h17.4c5,0,9,4.4,8.5,9.4l-8.7,82.6c-1.1,10.2-15.8,10.2-16.9,0l-8.7-82.6c-.5-5,3.4-9.4,8.5-9.4Z"/>
        <path className="st4" d="M301.9,60.5h20.6c4.2,0,7.5,3.6,7,7.8l-10.3,97.6c-.9,8.5-13.2,8.5-14.1,0l-10.3-97.6c-.4-4.2,2.8-7.8,7-7.8Z"/>
        <path className="st3" d="M336.6,60.5h23.7c3.4,0,6,2.9,5.6,6.3l-11.9,112.5c-.7,6.8-10.6,6.8-11.3,0l-11.9-112.5c-.4-3.3,2.3-6.3,5.6-6.3Z"/>
        <path className="st4" d="M372.9,60.5h23.7c3.4,0,6,2.9,5.6,6.3l-11.9,112.5c-.7,6.8-10.6,6.8-11.3,0l-11.9-112.5c-.4-3.3,2.3-6.3,5.6-6.3Z"/>
        <path className="st3" d="M410.8,60.5h20.6c4.2,0,7.5,3.6,7,7.8l-10.3,97.6c-.9,8.5-13.2,8.5-14.1,0l-10.3-97.6c-.4-4.2,2.8-7.8,7-7.8Z"/>
        <path className="st4" d="M448.7,60.5h17.4c5,0,9,4.4,8.5,9.4l-8.7,82.6c-1.1,10.2-15.8,10.2-16.9,0l-8.7-82.6c-.5-5,3.4-9.4,8.5-9.4Z"/>
      </g>
      <g>
        <path className="st3" d="M220.8,520.9h-17.4c-5,0-9-4.4-8.5-9.4l8.7-82.6c1.1-10.2,15.8-10.2,16.9,0l8.7,82.6c.5,5-3.4,9.4-8.5,9.4Z"/>
        <path className="st4" d="M186,520.9h-20.6c-4.2,0-7.5-3.6-7-7.8l10.3-97.6c.9-8.5,13.2-8.5,14.1,0l10.3,97.6c.4,4.2-2.8,7.8-7,7.8Z"/>
        <path className="st3" d="M151.3,520.9h-23.7c-3.4,0-6-2.9-5.6-6.3l11.9-112.5c.7-6.8,10.6-6.8,11.3,0l11.9,112.5c.4,3.3-2.3,6.3-5.6,6.3Z"/>
        <path className="st4" d="M115,520.9h-23.7c-3.4,0-6-2.9-5.6-6.3l11.9-112.5c.7-6.8,10.6-6.8,11.3,0l11.9,112.5c.4,3.3-2.3,6.3-5.6,6.3Z"/>
        <path className="st3" d="M77.1,520.9h-20.6c-4.2,0-7.5-3.6-7-7.8l10.3-97.6c.9-8.5,13.2-8.5,14.1,0l10.3,97.6c.4,4.2-2.8,7.8-7,7.8Z"/>
        <path className="st4" d="M39.2,520.9h-17.4c-5,0-9-4.4-8.5-9.4l8.7-82.6c1.1-10.2,15.8-10.2,16.9,0l8.7,82.6c.5,5-3.4,9.4-8.5,9.4Z"/>
      </g>
      <g>
        <path className="st3" d="M466.7,520.9h-17.4c-5,0-9-4.4-8.5-9.4l8.7-82.6c1.1-10.2,15.8-10.2,16.9,0l8.7,82.6c.5,5-3.4,9.4-8.5,9.4Z"/>
        <path className="st4" d="M431.9,520.9h-20.6c-4.2,0-7.5-3.6-7-7.8l10.3-97.6c.9-8.5,13.2-8.5,14.1,0l10.3,97.6c.4,4.2-2.8,7.8-7,7.8Z"/>
        <path className="st3" d="M397.2,520.9h-23.7c-3.4,0-6-2.9-5.6-6.3l11.9-112.5c.7-6.8,10.6-6.8,11.3,0l11.9,112.5c.4,3.3-2.3,6.3-5.6,6.3Z"/>
        <path className="st4" d="M360.9,520.9h-23.7c-3.4,0-6-2.9-5.6-6.3l11.9-112.5c.7-6.8,10.6-6.8,11.3,0l11.9,112.5c.4,3.3-2.3,6.3-5.6,6.3Z"/>
        <path className="st3" d="M323,520.9h-20.6c-4.2,0-7.5-3.6-7-7.8l10.3-97.6c.9-8.5,13.2-8.5,14.1,0l10.3,97.6c.4,4.2-2.8,7.8-7,7.8Z"/>
        <path className="st4" d="M285.1,520.9h-17.4c-5,0-9-4.4-8.5-9.4l8.7-82.6c1.1-10.2,15.8-10.2,16.9,0l8.7,82.6c.5,5-3.4,9.4-8.5,9.4Z"/>
      </g>
      <rect className="st2" x="323.2" y="542.4" width="164.2" height="39.3" rx="19.6" ry="19.6"/>
      <rect className="st2" x="0" y="0" width="164.2" height="39.3" rx="19.6" ry="19.6"/>

      {/* Left Dice (Opponent's turn) */}
      {!isMyTurn && rolled && (
        <g>
          {d1 !== null && (
            <g>
              <rect className="st0 drop-shadow-[0_4px_8px_rgba(28,28,30,0.2)]" x="61.5" y="248.8" width="53.9" height="53.9" rx="13.8" ry="13.8" transform="translate(-45.3 18.9) rotate(-9.7)"/>
              <rect className="st5" x="62.4" y="249.7" width="52" height="52" rx="12.8" ry="12.8" transform="translate(-45.3 18.9) rotate(-9.7)"/>
              <g transform="translate(-45.3 18.9) rotate(-9.7)">
                <DiePips v={d1} x={61.5} y={248.8} size={53.9} />
              </g>
            </g>
          )}
          {d2 !== null && (
            <g>
              <rect className="st0 drop-shadow-[0_4px_8px_rgba(28,28,30,0.2)]" x="127" y="276.9" width="53.9" height="53.9" rx="13.8" ry="13.8" transform="translate(105.2 -33.3) rotate(18.6)"/>
              <rect className="st5" x="128" y="277.9" width="52" height="52" rx="12.8" ry="12.8" transform="translate(105.2 -33.3) rotate(18.6)"/>
              <g transform="translate(105.2 -33.3) rotate(18.6)">
                <DiePips v={d2} x={127} y={276.9} size={53.9} />
              </g>
            </g>
          )}
        </g>
      )}

      {/* Right Dice (My turn) */}
      {(isMyTurn && rolled) || showMyEmpty || isAnimating ? (
        <g 
          className={showMyEmpty && !isAnimating ? "cursor-pointer pointer-events-auto animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" : ""}
          onClick={(showMyEmpty && !isAnimating) ? onEmptyClick : undefined}
        >
          {(d1 !== null || showMyEmpty) && (
            <g>
              <rect className="st0 drop-shadow-[0_4px_8px_rgba(28,28,30,0.2)]" x="370.5" y="250.7" width="53.9" height="53.9" rx="13.8" ry="13.8" transform="translate(853.6 113.5) rotate(125.3)"/>
              <rect className="st5" x="371.4" y="251.7" width="52" height="52" rx="12.8" ry="12.8" transform="translate(853.6 113.5) rotate(125.3)"/>
              <g transform="translate(853.6 113.5) rotate(125.3)">
                <DiePips v={d1 || 0} x={370.5} y={250.7} size={53.9} />
              </g>
            </g>
          )}
          {(d2 !== null || showMyEmpty) && (
            <g>
              <rect className="st0 drop-shadow-[0_4px_8px_rgba(28,28,30,0.2)]" x="304.2" y="277.1" width="53.9" height="53.9" rx="13.8" ry="13.8" transform="translate(762.9 429.5) rotate(153.6)"/>
              <rect className="st5" x="305.1" y="278.1" width="52" height="52" rx="12.8" ry="12.8" transform="translate(762.9 429.5) rotate(153.6)"/>
              <g transform="translate(762.9 429.5) rotate(153.6)">
                <DiePips v={d2 || 0} x={304.2} y={277.1} size={53.9} />
              </g>
            </g>
          )}
          {showMyEmpty && !isAnimating && (
            <g>
              <g>
                <path className="fill-[#4a5151]" d="M398.1,299.4c-.4-.3-.7-.6-.9-1-5.6-11.7-17.7-12.5-18.2-12.6-1.4,0-2.6-1.3-2.5-2.8,0-1.4,1.3-2.6,2.8-2.5.6,0,15.6,1,22.6,15.5.6,1.3,0,2.9-1.2,3.5-.9.4-1.9.3-2.6-.2Z"/>
                <g>
                  <path className="fill-[#4a5151]" d="M390.4,280.3c-1.2-.8-1.5-2.5-.7-3.7l5.6-8.1c.8-1.2,2.5-1.5,3.7-.7s1.5,2.5.7,3.7l-5.6,8.1c-.8,1.2-2.5,1.5-3.7.7Z"/>
                  <path className="fill-[#4a5151]" d="M398.3,285.7c-1.2-.8-1.5-2.5-.7-3.7l5.6-8.1c.8-1.2,2.5-1.5,3.7-.7s1.5,2.5.7,3.7l-5.6,8.1c-.8,1.2-2.5,1.5-3.7.7Z"/>
                </g>
              </g>
              <g>
                <path className="fill-[#4a5151]" d="M339.8,320c-3.7,1.8-8.4,3-13.9,2.7-1.5,0-2.6-1.4-2.5-2.8,0-1.5,1.4-2.6,2.8-2.5,13.2.9,20-9.3,20.2-9.8.8-1.2,2.5-1.6,3.7-.8,1.2.8,1.6,2.4.8,3.7-.2.4-4,6.1-11.2,9.6Z"/>
                <g>
                  <path className="fill-[#4a5151]" d="M330.6,311.5c-1.3.6-2.9,0-3.6-1.2l-4.4-9c-.6-1.3,0-2.9,1.2-3.6s2.9,0,3.6,1.2l4.4,9c.6,1.3,0,2.9-1.2,3.6Z"/>
                  <path className="fill-[#4a5151]" d="M339.3,307.3c-1.3.6-2.9,0-3.6-1.2l-4.4-9c-.6-1.3,0-2.9,1.2-3.6s2.9,0,3.6,1.2l4.4,9c.6,1.3,0,2.9-1.2,3.6Z"/>
                </g>
              </g>
            </g>
          )}
        </g>
      ) : null}
    </svg>
  );
}

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
  const [rollingDice, setRollingDice] = useState<number[] | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const isBlack = myColor === "black";
  const displayTopIdx = isBlack 
    ? [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] 
    : [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const displayBottomIdx = isBlack 
    ? [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] 
    : [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

  const moves = useMemo(() => (myColor ? legalMoves(state, myColor) : []), [state, myColor]);
  const legalDests = useMemo(
    () => (selected !== null ? moves.filter((m) => m.from === selected).map((m) => m.to) : []),
    [selected, moves],
  );
  const canEndTurn = isMyTurn && state.rolled && moves.length === 0;
  const canRoll = isMyTurn && !state.pendingDouble && !state.winner;

  function handleEmptyClick() {
    if (isRolling) return;
    setIsRolling(true);
    let iterations = 0;
    const maxIterations = 15;
    
    function nextFrame() {
      iterations++;
      setRollingDice([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
      
      if (iterations < maxIterations) {
        setTimeout(nextFrame, 30 + (iterations * 15));
      } else {
        setRollingDice(null);
        setIsRolling(false);
        onRoll();
      }
    }
    nextFrame();
  }

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

  function renderPoint(idx: number, top: boolean, i: number) {
    const point = state.points[idx];
    const isSel = selected === idx;
    const isLegal = legalDests.includes(idx);
    const x = pointX[i];

    return (
      <button
        key={idx}
        type="button"
        onClick={() => clickPoint(idx)}
        style={{
          left: `${x}%`,
          [top ? "top" : "bottom"]: "10.4%",
          width: "6.5%",
          height: "32%",
          transform: "translateX(-50%)",
        }}
        className={`absolute rounded-[10px] outline-none transition duration-150 flex flex-col items-center ${top ? "justify-start" : "justify-end"} gap-[2px] ${
          isMyTurn ? "hover:bg-black/5" : "cursor-default"
        } ${isSel ? "ring-2 ring-[#0a84ff] ring-offset-2 ring-offset-transparent bg-black/5" : ""} ${
          isLegal ? "ring-2 ring-[#0a84ff]/70 ring-offset-2 ring-offset-transparent bg-black/5" : ""
        } pointer-events-auto`}
        aria-label={`Point ${idx + 1}`}
      >
        <div className="flex flex-col items-center gap-[1px] w-full mt-1 mb-1 relative h-full">
          {Array.from({ length: Math.min(point.count, 5) }).map((_, idxInner) => (
            <div key={idxInner} className={`absolute w-full flex justify-center ${top ? "top-0" : "bottom-0"}`} style={{ [top ? "top" : "bottom"]: `${idxInner * 20}%` }}>
              <Checker color={point.color} />
            </div>
          ))}
          {point.count > 5 && (
            <span className={`absolute z-10 ${top ? "top-full mt-1" : "bottom-full mb-1"} left-1/2 -translate-x-1/2 rounded-full bg-[#1c1c1e]/85 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm`}>
              {point.count}
            </span>
          )}
        </div>
        {isLegal && <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a84ff] shadow-[0_0_0_7px_rgba(10,132,255,0.18)]" />}
      </button>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto relative aspect-[488.5/581.7] select-none">
      <BoardSVG 
        dice={state.dice} 
        isMyTurn={isMyTurn} 
        rolled={state.rolled} 
        rollingDice={rollingDice} 
        onEmptyClick={handleEmptyClick} 
        canRoll={canRoll} 
      />

      <div className="absolute inset-0 z-10 pointer-events-none">
        {displayTopIdx.map((idx, i) => renderPoint(idx, true, i))}
        {displayBottomIdx.map((idx, i) => renderPoint(idx, false, i))}

        {/* Center Bar */}
        <div className="absolute top-[10.4%] bottom-[10.4%] left-[50%] w-12 -translate-x-1/2 flex flex-col justify-between py-4 pointer-events-none">
          <BarStack color={isBlack ? "black" : "white"} count={isBlack ? state.bar.black : state.bar.white} selected={selected === "bar"} onClick={clickBar} />
          
          <div className="pointer-events-auto flex flex-col items-center gap-2">
            {!state.rolled && (!isMyTurn || state.winner) ? (
              <span className="px-1 py-2 text-[9px] font-semibold text-[#8e8e93] rotate-90 whitespace-nowrap">wait</span>
            ) : null}
            <button
              type="button"
              disabled={!canOffer}
              onClick={onOfferDouble}
              className={`rounded-[10px] outline-none scale-75 transition ${canOffer ? "hover:scale-90 active:scale-75" : "opacity-45"}`}
              aria-label="Doubling cube"
            >
              <DoublingCube value={state.cube.value} />
            </button>
          </div>

          <BarStack color={isBlack ? "white" : "black"} count={isBlack ? state.bar.white : state.bar.black} selected={false} onClick={clickBar} />
        </div>

        {/* Roll Button Area (Right half) */}

        {/* Top Left Tray - Opponent's tray */}
        <div className="absolute top-0 left-0 w-[33.6%] h-[6.75%] flex items-center justify-center px-4 pointer-events-auto">
          <div className="flex w-full items-center justify-center h-full">
            <OffTray color={isBlack ? "white" : "black"} count={isBlack ? state.off.white : state.off.black} />
          </div>
        </div>

        {/* Bottom Right Tray - My tray */}
        <div className="absolute bottom-0 right-0 w-[33.6%] h-[6.75%] flex items-center justify-center px-4 pointer-events-auto">
          <div className="flex w-full items-center justify-center h-full cursor-pointer hover:bg-black/5 rounded-[19px] transition" onClick={clickOff}>
            <OffTray color={isBlack ? "black" : "white"} count={isBlack ? state.off.black : state.off.white} />
          </div>
        </div>

        {/* Turn indicator Top Right */}
        <div className="absolute top-0 right-0 w-[33.6%] h-[6.75%] flex items-center justify-center pointer-events-auto">
          <span className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${isMyTurn ? "text-[#0a84ff] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" : "text-[#8e8e93]"}`}>
            {isMyTurn ? "Your turn" : "Opponent"}
          </span>
        </div>

        {/* Action Buttons Bottom Left (Left of Tray) */}
        <div className="absolute bottom-0 left-0 right-[33.6%] h-[6.75%] flex items-center justify-start px-4 gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={clickOff}
            disabled={!isMyTurn || selected === null || !moves.some((m) => m.from === selected && m.to === "off")}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-bold text-[#1c1c1e] shadow-sm transition hover:bg-[#f2f2f4] disabled:opacity-30"
          >
            Bear off
          </button>
          <button
            type="button"
            onClick={onEndTurn}
            disabled={!canEndTurn}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[11px] font-bold text-[#1c1c1e] shadow-sm transition hover:bg-[#f2f2f4] disabled:opacity-30"
          >
            End turn
          </button>
        </div>
      </div>
    </div>
  );
}

function Checker({ color }: { color: Color | null }) {
  if (!color) return null;
  const isWhite = color === "white";
  const circleFill = isWhite ? "#f7f1e7" : "#000000";
  const pathOpacity = isWhite ? "0.5" : "0.1";

  return (
    <svg className="w-[110%] shrink-0 drop-shadow-[0_3px_5px_rgba(28,28,30,0.3)]" viewBox="0 0 35 35" aria-hidden="true">
      <circle cx="17.5" cy="17.5" r="17.5" fill={circleFill} />
      <path fill="#fff" opacity={pathOpacity} d="M17.5,1C8.4,1,1,8.4,1,17.5s7.4,16.5,16.5,16.5,16.5-7.4,16.5-16.5S26.6,1,17.5,1ZM17.5,26.2c-4.8,0-8.7-3.9-8.7-8.7s3.9-8.7,8.7-8.7,8.7,3.9,8.7,8.7-3.9,8.7-8.7,8.7Z"/>
    </svg>
  );
}

function Die({ v }: { v: number }) {
  return (
    <svg className="h-14 w-14 shrink-0 drop-shadow-[0_4px_8px_rgba(28,28,30,0.2)]" viewBox="0 0 100 100" aria-label={`Die ${v}`}>
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
    <svg className="h-8 w-8 shrink-0 drop-shadow-[0_4px_8px_rgba(28,28,30,0.2)]" viewBox="0 0 100 100" aria-hidden="true">
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
    <div className="flex items-center gap-2">
      <MiniChecker color={color} />
      <span className="text-[14px] font-bold text-[#1c1c1e]">{count}</span>
    </div>
  );
}

function MiniChecker({ color }: { color: Color }) {
  const isWhite = color === "white";
  const circleFill = isWhite ? "#f7f1e7" : "#000000";
  const pathOpacity = isWhite ? "0.5" : "0.1";

  return (
    <svg className="h-5 w-5" viewBox="0 0 35 35" aria-hidden="true">
      <circle cx="17.5" cy="17.5" r="17.5" fill={circleFill} />
      <path fill="#fff" opacity={pathOpacity} d="M17.5,1C8.4,1,1,8.4,1,17.5s7.4,16.5,16.5,16.5,16.5-7.4,16.5-16.5S26.6,1,17.5,1ZM17.5,26.2c-4.8,0-8.7-3.9-8.7-8.7s3.9-8.7,8.7-8.7,8.7,3.9,8.7,8.7-3.9,8.7-8.7,8.7Z"/>
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
      className={`pointer-events-auto flex flex-col items-center justify-center gap-1 p-1 rounded-xl transition disabled:opacity-45 ${
        selected ? "ring-2 ring-[#0a84ff] bg-black/5" : "hover:bg-black/5"
      }`}
      aria-label={`${color} bar`}
    >
      {count > 0 ? (
        <>
          <div className="w-8 h-8"><Checker color={color} /></div>
          <span className="text-[11px] font-bold text-[#1c1c1e] bg-white/60 px-1.5 rounded-full">{count}</span>
        </>
      ) : null}
    </button>
  );
}
