import { useEffect, useState, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { GameFrame } from "@/components/GameFrame";
import { Avatar } from "@/components/Avatar";
import { WinnerProgressBar } from "@/components/WinnerProgressBar";
import { GameHeader } from "@/components/GameHeader";
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

    // Wait for React to unmount controls and DOM to expand to 9:16 layout
    await new Promise(r => setTimeout(r, 200));

    try {
      const baseWidth = containerRef.current.offsetWidth || 400;
      const scale = 2; // 2x High Quality Export

      // WebCodecs H264 requires dimensions to be even numbers
      const targetW = baseWidth * scale;
      const outW = targetW % 2 === 0 ? targetW : targetW + 1;
      const rawOutH = Math.round((outW * 16) / 9);
      const outH = rawOutH % 2 === 0 ? rawOutH : rawOutH + 1;

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: outW,
          height: outH,
        },
        fastStart: 'in-memory',
      });

      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error("Encoder error:", e),
      });

      videoEncoder.configure({
        codec: 'avc1.420028',
        width: outW,
        height: outH,
        bitrate: 5_000_000,
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
          canvasWidth: outW,
          canvasHeight: outH,
          backgroundColor: "#ffffff",
          pixelRatio: scale,
          style: {
            margin: "0",
            padding: "0"
          }
        });
        lastBoardCanvas = canvas;

        const frame = new VideoFrame(canvas, { timestamp: timestampUs });
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

      const outroCanvas = document.createElement("canvas");
      outroCanvas.width = outW;
      outroCanvas.height = outH;
      const ctx = outroCanvas.getContext("2d");

      const scaleMult = outW / 400;

      for (let j = 0; j < outroFrames; j++) {
        setExportProgress(0.8 + (j / outroFrames) * 0.2);

        if (ctx) {
          ctx.fillStyle = "#f3f4f6";
          ctx.fillRect(0, 0, outW, outH);

          if (lastBoardCanvas) {
            ctx.drawImage(lastBoardCanvas, 0, 0);
          }

          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.fillRect(0, 0, outW, outH);

          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          ctx.font = `bold ${32 * scaleMult}px sans-serif`;
          ctx.fillStyle = "#0a84ff";
          ctx.fillText(`WINNER: ${winnerName.toUpperCase()}`, outW / 2, outH * 0.2);

          ctx.font = `bold ${20 * scaleMult}px sans-serif`;
          ctx.fillStyle = "#6b7280";
          ctx.fillText(`LOSER: ${loserName.toUpperCase()}`, outW / 2, outH * 0.25);

          let textY = outH * 0.35;

          if (vidEl && vidEl.videoWidth) {
            const aspect = vidEl.videoWidth / vidEl.videoHeight;
            const finalW = Math.min(300 * scaleMult, outW * 0.8);
            const finalH = finalW / aspect;
            const drawY = outH * 0.35;

            ctx.shadowColor = "rgba(0,0,0,0.2)";
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 10;
            ctx.fillStyle = "#e5e7eb";
            ctx.fillRect(outW / 2 - finalW / 2 - (4 * scaleMult), drawY - (4 * scaleMult), finalW + (8 * scaleMult), finalH + (8 * scaleMult));

            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.drawImage(vidEl, outW / 2 - finalW / 2, drawY, finalW, finalH);

            textY = drawY + finalH + (40 * scaleMult);
          }

          ctx.font = `italic 500 ${20 * scaleMult}px sans-serif`;
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
      setExportProgress(0);
      setIsPlaying(false);
      setState(startingState());
      setEventIdx(0);
      setPhase("playing");
    }
  }

  // Use .mp4 for Giphy instead of .gif so we can play it in a <video> tag
  const winnerVideoUrl = winnerGif.replace(".gif", ".mp4");

  return (
    <GameFrame>
      <div className="flex-1 flex flex-col pt-0 relative overflow-hidden bg-background">

        {/* VIDEO RECORDING AREA */}
        <div ref={containerRef} className="flex-1 flex flex-col pt-0 relative bg-background overflow-hidden">
          <GameHeader
            whitePlayer={sampleRecord.metadata.whitePlayer}
            whiteStatus="connected"
            blackPlayer={sampleRecord.metadata.blackPlayer}
            blackStatus="connected"
            showControls={false}
          />

          <div className="mt-1 mx-4 h-4 p-1 bg-muted rounded-full">
            <WinnerProgressBar advantage={adv} />
          </div>
          <div className="mt-1 mx-4 h-4 p-1">
            {/* TODO: Timer for  time based playing */}
            {/* <TimerProgressBar /> */}
          </div>

          <div className="flex-1 flex flex-col items-center justify-start px-2 py-4 overflow-hidden">
            <div className="w-full max-w-xl mx-auto px-2 relative pointer-events-none">
              <BackgammonBoard
                state={state}
                myColor="white"
                selected={null}
                onSelect={() => { }}
                onApply={() => { }}
                onRoll={() => { }}
                onEndTurn={() => { }}
                onOfferDouble={() => { }}
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

          {/* Export Progress Bar directly inside recorded area at bottom */}
          {isExporting && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-muted">
              <div className="h-full bg-[#34d399] transition-all duration-75" style={{ width: `${exportProgress * 100}%` }} />
            </div>
          )}
        </div>

        {/* CONTROLS (NOT RECORDED) */}
        {!isExporting && (
          <div className="p-4 w-full flex flex-col gap-3 items-center shrink-0 bg-background border-t">
            <div className="flex gap-1 text-[10px] bg-muted/50 rounded-full px-2 py-0.5 border">
              <button onClick={() => setTargetDuration(15)} className={`px-2 py-0.5 rounded ${targetDuration === 15 ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}>15s</button>
              <button onClick={() => setTargetDuration(30)} className={`px-2 py-0.5 rounded ${targetDuration === 30 ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}>30s</button>
              <button onClick={() => setTargetDuration(45)} className={`px-2 py-0.5 rounded ${targetDuration === 45 ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground"}`}>45s</button>
            </div>

            <div className="w-full bg-muted h-2 rounded-full overflow-hidden relative">
              <div className="bg-[#0a84ff] h-full transition-all duration-300 ease-linear" style={{ width: `${(eventIdx / totalEvents) * 100}%` }} />
            </div>

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
          </div>
        )}
      </div>
    </GameFrame>
  );
}
