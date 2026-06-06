import { useEffect, useState, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GameFrame } from "@/components/GameFrame";
import { Avatar } from "@/components/Avatar";
import { WinnerProgressBar } from "@/components/WinnerProgressBar";
import { BackgammonBoard } from "@/components/board/BackgammonBoard";
import { startingState, applyMove, endTurn, advantage } from "@/lib/games/backgammon/engine";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download, Loader2 } from "lucide-react";
import sampleRecord from "@/assets/backgammon/sample_record.json";
import type { BgState, Color, Move } from "@/lib/games/backgammon/types";
import { toCanvas } from "html-to-image";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export const Route = createFileRoute("/replay")({
  component: ReplayPage,
});

function ReplayPage() {
  const [phase, setPhase] = useState<"playing" | "outro">("playing");
  const [state, setState] = useState<BgState>(startingState());
  const [eventIdx, setEventIdx] = useState(0);
  const [targetDuration, setTargetDuration] = useState(30); // 15, 30, or 45 seconds

  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const winnerColor = sampleRecord.metadata.winner as Color;
  const winnerName = winnerColor === "white" ? sampleRecord.metadata.whitePlayer : sampleRecord.metadata.blackPlayer;
  const winnerMessage = winnerColor === "white" ? sampleRecord.metadata.whiteMessage : sampleRecord.metadata.blackMessage;
  const winnerGif = winnerColor === "white" ? sampleRecord.metadata.whiteGif : sampleRecord.metadata.blackGif;
  const loserName = winnerColor === "white" ? sampleRecord.metadata.blackPlayer : sampleRecord.metadata.whitePlayer;

  const adv = useMemo(() => advantage(state), [state]);
  const totalEvents = sampleRecord.events.length;
  // Calculate ms per event to fit the target duration exactly
  const delayMs = (targetDuration * 1000) / Math.max(1, totalEvents);

  useEffect(() => {
    if (isExporting || !isPlaying) return; // Halt auto-play if exporting or paused
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
  }, [phase, eventIdx, totalEvents, delayMs, isExporting, isPlaying]);

  function handleRestart() {
    setState(startingState());
    setEventIdx(0);
    setPhase("playing");
    setIsPlaying(true);
  }

  function togglePlay() {
    if (phase === "outro") {
      handleRestart();
    } else {
      setIsPlaying(!isPlaying);
    }
  }

  async function handleExport() {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      const width = containerRef.current.offsetWidth || 400;
      const height = containerRef.current.offsetHeight || 800;
      
      // WebCodecs H264 requires dimensions to be even numbers
      const encWidth = width % 2 === 0 ? width : width + 1;
      const encHeight = height % 2 === 0 ? height : height + 1;

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: encWidth,
          height: encHeight,
        },
        fastStart: 'in-memory',
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error("Encoder error:", e),
      });

      videoEncoder.configure({
        codec: 'avc1.420028',
        width: encWidth,
        height: encHeight,
        bitrate: 2_000_000,
        framerate: 30, 
      });

      let timestampUs = 0;
      const delayUs = Math.floor((targetDuration * 1000 * 1000) / Math.max(1, totalEvents));
      
      // Reset game state for export
      let simState = startingState();
      setState(simState);
      setEventIdx(0);
      setPhase("playing");

      await new Promise(r => setTimeout(r, 100));

      let lastBoardCanvas: HTMLCanvasElement | null = null;

      // 1. Render all game moves
      for (let i = 0; i < totalEvents; i++) {
        setExportProgress((i / totalEvents) * 0.8);
        
        const canvas = await toCanvas(containerRef.current, {
           width: encWidth,
           height: encHeight,
           backgroundColor: "#ffffff",
           pixelRatio: 1,
           style: {
             margin: "0",
             padding: "0"
           }
        });
        lastBoardCanvas = canvas;
        
        // We ensure the output is exactly 9:16
        const outCanvas = document.createElement("canvas");
        const outW = encWidth;
        const outH = Math.round((encWidth * 16) / 9);
        const finalOutH = outH % 2 === 0 ? outH : outH + 1;
        outCanvas.width = outW;
        outCanvas.height = finalOutH;
        const outCtx = outCanvas.getContext("2d");
        
        if (outCtx) {
           outCtx.fillStyle = "#f3f4f6"; // background
           outCtx.fillRect(0, 0, outW, finalOutH);
           // draw centered
           const yOffset = (finalOutH - encHeight) / 2;
           outCtx.drawImage(canvas, 0, yOffset);
        }
        
        const frame = new VideoFrame(outCanvas, { timestamp: timestampUs });
        videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
        frame.close();
        
        timestampUs += delayUs;
        
        const ev = sampleRecord.events[i] as any;
        if (ev.type === "roll") simState = { ...simState, dice: ev.dice, turn: ev.color, rolled: true };
        else if (ev.type === "move") simState = applyMove(simState, ev.color, ev.move);
        else if (ev.type === "endTurn") simState = endTurn(simState);
        
        setState(simState);
        setEventIdx(i + 1);
        
        await new Promise(requestAnimationFrame);
        await new Promise(r => setTimeout(r, 5));
      }

      // 2. Render Outro screen manually to capture GIF animation
      setPhase("outro");
      await new Promise(r => setTimeout(r, 200)); 
      
      const vidEl = document.getElementById("winner-video") as HTMLVideoElement;
      if (vidEl && vidEl.readyState < 2) {
        await new Promise((res) => {
           vidEl.oncanplay = res;
           vidEl.onerror = res;
           setTimeout(res, 2000); // 2s timeout
        });
      }
      if (vidEl) vidEl.play().catch(e => console.error("play failed", e));

      const outroFrames = 30 * 4; // 4 seconds at 30fps
      const outroDelayUs = 1_000_000 / 30;
      
      const outW = encWidth;
      const outH = Math.round((encWidth * 16) / 9);
      const finalOutH = outH % 2 === 0 ? outH : outH + 1;

      const outroCanvas = document.createElement("canvas");
      outroCanvas.width = outW;
      outroCanvas.height = finalOutH;
      const ctx = outroCanvas.getContext("2d");

      for (let j = 0; j < outroFrames; j++) {
         setExportProgress(0.8 + (j / outroFrames) * 0.2);
         
         if (ctx) {
             ctx.fillStyle = "#f3f4f6";
             ctx.fillRect(0, 0, outW, finalOutH);
             
             if (lastBoardCanvas) {
                 const yOffset = (finalOutH - encHeight) / 2;
                 ctx.drawImage(lastBoardCanvas, 0, yOffset);
             }
             
             ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
             ctx.fillRect(0, 0, outW, finalOutH);
             
             ctx.textAlign = "center";
             ctx.textBaseline = "middle";
             
             ctx.font = "bold 32px sans-serif";
             ctx.fillStyle = "#0a84ff";
             ctx.fillText(`WINNER: ${winnerName.toUpperCase()}`, outW / 2, finalOutH * 0.2);
             
             ctx.font = "bold 20px sans-serif";
             ctx.fillStyle = "#6b7280";
             ctx.fillText(`LOSER: ${loserName.toUpperCase()}`, outW / 2, finalOutH * 0.25);

             let textY = finalOutH * 0.35;

             if (vidEl && vidEl.videoWidth) {
                 const aspect = vidEl.videoWidth / vidEl.videoHeight;
                 const finalW = Math.min(300, outW * 0.8);
                 const finalH = finalW / aspect;
                 const drawY = finalOutH * 0.35;
                 
                 ctx.shadowColor = "rgba(0,0,0,0.2)";
                 ctx.shadowBlur = 20;
                 ctx.shadowOffsetY = 10;
                 ctx.fillStyle = "#e5e7eb";
                 ctx.fillRect(outW / 2 - finalW / 2 - 4, drawY - 4, finalW + 8, finalH + 8);
                 
                 ctx.shadowColor = "transparent";
                 ctx.shadowBlur = 0;
                 ctx.drawImage(vidEl, outW / 2 - finalW / 2, drawY, finalW, finalH);
                 
                 textY = drawY + finalH + 40;
             }

             ctx.font = "italic 500 20px sans-serif";
             ctx.fillStyle = "#111827";
             ctx.fillText(`"${winnerMessage}"`, outW / 2, textY);
         }
         
         const frame = new VideoFrame(outroCanvas, { timestamp: timestampUs });
         videoEncoder.encode(frame, { keyFrame: j % 30 === 0 });
         frame.close();
         timestampUs += outroDelayUs;
         
         await new Promise(r => setTimeout(r, 33));
      }

      await videoEncoder.flush();
      muxer.finalize();
      
      const { buffer } = muxer.target as ArrayBufferTarget;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backgammon-export-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (e: any) {
      console.error(e);
      alert("Export failed: " + e.message);
    } finally {
      setIsExporting(false);
      handleRestart();
    }
  }

  // Use .mp4 for Giphy instead of .gif so we can play it in a <video> tag
  const winnerVideoUrl = winnerGif.replace(".gif", ".mp4");

  return (
    <GameFrame>
      <div className="flex-1 flex flex-col pt-0 relative overflow-hidden bg-background">
        
        {/* VIDEO RECORDING AREA */}
        <div ref={containerRef} className="flex-1 flex flex-col pt-4 relative bg-background">
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
              <video id="winner-video" crossOrigin="anonymous" src={winnerVideoUrl} autoPlay loop muted playsInline className="w-full max-w-sm rounded-xl shadow-2xl border-4 border-muted object-cover" />
              <p className="text-xl font-medium italic text-center px-4">"{winnerMessage}"</p>
              {!isExporting && (
                <Button variant="secondary" size="sm" onClick={togglePlay} className="mt-4 h-8 text-xs px-4">
                  <Play className="w-3 h-3 mr-1" />
                  Watch Again
                </Button>
              )}
            </div>
          )}
        </div>

        {/* CONTROLS (NOT RECORDED) */}
        <div className="p-4 w-full flex flex-col gap-3 items-center shrink-0 bg-background border-t">
           {!isExporting && (
             <div className="flex gap-1 text-[10px] bg-muted/50 rounded-full px-2 py-0.5 border">
               <button onClick={() => setTargetDuration(15)} className={`px-2 py-0.5 rounded ${targetDuration === 15 ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}>15s</button>
               <button onClick={() => setTargetDuration(30)} className={`px-2 py-0.5 rounded ${targetDuration === 30 ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}>30s</button>
               <button onClick={() => setTargetDuration(45)} className={`px-2 py-0.5 rounded ${targetDuration === 45 ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}>45s</button>
             </div>
           )}
           
           <div className="w-full bg-muted h-2 rounded-full overflow-hidden relative">
             <div className="bg-[#0a84ff] h-full transition-all duration-300 ease-linear" style={{ width: `${(eventIdx / totalEvents) * 100}%` }} />
             {isExporting && (
               <div className="absolute inset-0 bg-[#0a84ff] h-full transition-all duration-75" style={{ width: `${exportProgress * 100}%`, backgroundColor: '#34d399' }} />
             )}
           </div>
           
           {!isExporting && (
             <div className="flex w-full justify-between items-center px-1">
               <Button variant="secondary" size="sm" onClick={togglePlay} className="h-8 text-xs px-3">
                 {isPlaying ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                 {isPlaying ? "Pause" : eventIdx === 0 ? "Play" : "Resume"}
               </Button>
               
               <p className="text-[10px] text-muted-foreground font-medium">
                 {`Frame ${eventIdx}/${totalEvents}`}
               </p>
               
               <Button variant="default" size="sm" onClick={handleExport} className="h-8 text-xs px-3 bg-[#0a84ff] hover:bg-[#0a84ff]/90">
                 <Download className="w-3 h-3 mr-1" />
                 Export
               </Button>
             </div>
           )}
        </div>
      </div>
    </GameFrame>
  );
}
