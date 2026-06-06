import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GameFrame } from "@/components/GameFrame";
import { Avatar } from "@/components/Avatar";
import { WinnerProgressBar } from "@/components/WinnerProgressBar";
import { BackgammonBoard } from "@/components/board/BackgammonBoard";
import { startingState, applyMove, endTurn, advantage } from "@/lib/games/backgammon/engine";
import { Button } from "@/components/ui/button";
import { Play, Download } from "lucide-react";
import sampleRecord from "@/assets/backgammon/sample_record.json";
import type { BgState, Color, Move } from "@/lib/games/backgammon/types";

export const Route = createFileRoute("/replay")({
  component: ReplayPage,
});

function ReplayPage() {
  const [phase, setPhase] = useState<"playing" | "outro">("playing");
  const [state, setState] = useState<BgState>(startingState());
  const [eventIdx, setEventIdx] = useState(0);
  const [targetDuration, setTargetDuration] = useState(30); // 15, 30, or 45 seconds

  const winnerColor = sampleRecord.metadata.winner as Color;
  const winnerName = winnerColor === "white" ? sampleRecord.metadata.whitePlayer : sampleRecord.metadata.blackPlayer;
  const winnerMessage = winnerColor === "white" ? sampleRecord.metadata.whiteMessage : sampleRecord.metadata.blackMessage;
  const winnerGif = winnerColor === "white" ? sampleRecord.metadata.whiteGif : sampleRecord.metadata.blackGif;

  const adv = useMemo(() => advantage(state), [state]);
  const totalEvents = sampleRecord.events.length;
  // Calculate ms per event to fit the target duration exactly
  const delayMs = (targetDuration * 1000) / Math.max(1, totalEvents);

  useEffect(() => {
    if (phase === "playing") {
      if (eventIdx >= totalEvents) {
        // Wait 1.5s after the last move before showing the outro
        const t = setTimeout(() => setPhase("outro"), 1500);
        return () => clearTimeout(t);
      }

      const t = setTimeout(() => {
        const ev = sampleRecord.events[eventIdx] as any;
        
        setState((prev) => {
          if (ev.type === "roll") {
            return { ...prev, dice: ev.dice, turn: ev.color, rolled: true };
          } else if (ev.type === "move") {
            const mv: Move = ev.move;
            return applyMove(prev, ev.color, mv);
          } else if (ev.type === "endTurn") {
            return endTurn(prev);
          }
          return prev;
        });

        setEventIdx(idx => idx + 1);
      }, delayMs);

      return () => clearTimeout(t);
    }
  }, [phase, eventIdx, totalEvents, delayMs]);

  function handleRestart() {
    setState(startingState());
    setEventIdx(0);
    setPhase("playing");
  }

  function handleExport() {
    // TODO: implement video export logic
    alert("Video export will be implemented in Phase 2!");
  }

  const loserName = winnerColor === "white" ? sampleRecord.metadata.blackPlayer : sampleRecord.metadata.whitePlayer;

  return (
    <GameFrame>
      <div className="flex-1 flex flex-col pt-4 relative">
        <div className="grid grid-cols-3 items-center px-4 pt-2">
          <div className="flex flex-col items-center gap-1">
            <Avatar nickname={sampleRecord.metadata.whitePlayer} tone="host" status="connected" />
            <span className="text-xs font-semibold truncate max-w-[100px]">{sampleRecord.metadata.whitePlayer}</span>
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">White</span>
          </div>
          <div className="text-center text-muted-foreground text-sm font-bold flex flex-col gap-1 items-center">
            <span>VS</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Avatar nickname={sampleRecord.metadata.blackPlayer} tone="player" status="connected" />
            <span className="text-xs font-semibold truncate max-w-[100px]">{sampleRecord.metadata.blackPlayer}</span>
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Black</span>
          </div>
        </div>

        <WinnerProgressBar advantage={adv} />

        <div className="flex-1 flex flex-col items-center justify-center px-2 py-2 overflow-hidden mt-4">
          <div className="w-full max-w-xl mx-auto px-2 relative pointer-events-none">
            <BackgammonBoard 
              state={state}
              myColor="white"
              selected={null}
              onSelect={() => {}}
              onApply={() => {}}
              onRoll={() => {}}
              onEndTurn={() => {}}
              onOfferDouble={() => {}}
              isMyTurn={false}
              canOffer={false}
            />
          </div>

          <div className="p-4 w-full flex flex-col gap-3 items-center mt-auto">
             <div className="flex gap-1 text-[10px] bg-muted/50 rounded-full px-2 py-0.5 border">
               <button onClick={() => setTargetDuration(15)} className={`px-2 py-0.5 rounded ${targetDuration === 15 ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}>15s</button>
               <button onClick={() => setTargetDuration(30)} className={`px-2 py-0.5 rounded ${targetDuration === 30 ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}>30s</button>
               <button onClick={() => setTargetDuration(45)} className={`px-2 py-0.5 rounded ${targetDuration === 45 ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}>45s</button>
             </div>
             
             <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
               <div className="bg-[#0a84ff] h-full transition-all duration-300 ease-linear" style={{ width: `${(eventIdx / totalEvents) * 100}%` }} />
             </div>
             
             <div className="flex w-full justify-between items-center px-1">
               <Button variant="secondary" size="sm" onClick={handleRestart} className="h-8 text-xs px-3">
                 <Play className="w-3 h-3 mr-1" />
                 Replay
               </Button>
               
               <p className="text-[10px] text-muted-foreground font-medium">
                 {`Frame ${eventIdx}/${totalEvents}`}
               </p>
               
               <Button variant="default" size="sm" onClick={handleExport} className="h-8 text-xs px-3 bg-[#0a84ff] hover:bg-[#0a84ff]/90">
                 <Download className="w-3 h-3 mr-1" />
                 Export
               </Button>
             </div>
          </div>
        </div>

        {phase === "outro" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-background/90 backdrop-blur-sm text-foreground gap-6">
            <div className="text-center leading-tight">
              <h1 className="text-3xl font-bold uppercase tracking-widest text-[#0a84ff] drop-shadow-md">
                Winner: {winnerName}
              </h1>
              <h2 className="text-xl font-semibold uppercase tracking-wider text-muted-foreground mt-2">
                Loser: {loserName}
              </h2>
            </div>
            <img src={winnerGif} alt="Winner Celebration" className="w-full max-w-sm rounded-xl shadow-2xl border-4 border-muted object-cover" />
            <p className="text-xl font-medium italic text-center px-4">"{winnerMessage}"</p>
            <Button variant="secondary" size="sm" onClick={handleRestart} className="mt-4 h-8 text-xs px-4">
              <Play className="w-3 h-3 mr-1" />
              Watch Again
            </Button>
          </div>
        )}
      </div>
    </GameFrame>
  );
}
