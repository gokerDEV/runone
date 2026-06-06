import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GameFrame } from "@/components/GameFrame";
import { Avatar } from "@/components/Avatar";
import { useLocalProfile } from "@/lib/profile/useLocalProfile";
import type { BgSession, BgState, Color } from "@/lib/games/backgammon/types";
import { colorOf } from "@/lib/games/backgammon/types";
import { exportBackgammonVideo } from "@/components/video/BackgammonVideoExporter";

const WINNER_MESSAGES = [
  "Cubes and luck on my side.",
  "Pip count perfection.",
  "Bear-off champion.",
  "Dice obeyed me today.",
  "Strategy beats variance.",
  "Another clean run-off.",
  "Rematch when you're ready.",
  "Doubling cube delivered.",
  "Board controlled, points secured.",
  "Victory in 15 checkers.",
];
const LOSER_MESSAGES = [
  "Dice betrayed me.",
  "I want a rematch.",
  "Fine, you rolled well.",
  "Variance giveth, variance taketh.",
  "Next one is mine.",
  "Lucky doubles.",
  "Revenge loading.",
  "My cube decision was right…",
  "One bad roll cost me.",
  "Okay that bear-off was clean.",
];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const Route = createFileRoute("/b/$sessionId/result")({
  head: () => ({ meta: [{ title: "Match result · play.withme" }] }),
  component: ResultPage,
});

function ResultPage() {
  const { sessionId } = Route.useParams();
  const { localUserId, ready } = useLocalProfile();
  const navigate = useNavigate();
  const [session, setSession] = useState<BgSession | null>(null);
  const [snapshots, setSnapshots] = useState<BgState[]>([]);
  const [winnerMsg, setWinnerMsg] = useState(() => pick(WINNER_MESSAGES));
  const [loserMsg, setLoserMsg] = useState(() => pick(LOSER_MESSAGES));
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const raw = localStorage.getItem(`pwm:bg-session:${sessionId}`);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as BgSession);
      } catch {
        /* noop */
      }
    }
    const snapsRaw = window.sessionStorage.getItem(`pwm:bg-snaps:${sessionId}`);
    if (snapsRaw) {
      try {
        setSnapshots(JSON.parse(snapsRaw) as BgState[]);
      } catch {
        /* noop */
      }
    }
  }, [ready, sessionId]);

  const myColor: Color | null = useMemo(() => {
    if (!session) return null;
    if (session.host.localUserId === localUserId) return colorOf("host");
    if (session.player?.localUserId === localUserId) return colorOf("player");
    return null;
  }, [session, localUserId]);

  async function onExport() {
    if (!session) return;
    setExporting(true);
    try {
      const { blob, ext } = await exportBackgammonVideo({
        session,
        snapshots: snapshots.length > 0 ? snapshots : [session.state],
        winnerMessage: winnerMsg,
        loserMessage: loserMsg,
      });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `play-withme-bg-${sessionId}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  if (!session) {
    return (
      <GameFrame>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading result…
        </div>
      </GameFrame>
    );
  }

  const winner = session.state.winner;
  const outcome = !winner ? "pending" : myColor && winner === myColor ? "win" : "loss";
  const cube = session.state.cube.value;
  const reason = session.state.endReason;
  const isWinner = outcome === "win";
  const isLoser = outcome === "loss";

  return (
    <GameFrame>
      <div className="px-4 pt-3 pb-1 flex items-center justify-between shrink-0">
        <div className="text-sm font-semibold">
          play.withme <span className="text-muted-foreground font-normal">· Backgammon</span>
        </div>
      </div>

      <div className="grid grid-cols-3 items-center px-4 pt-2">
        <div className="flex flex-col items-center gap-1">
          <Avatar nickname={session.host.nickname} tone="host" />
          <span className="text-xs font-semibold truncate max-w-[100px]">
            {session.host.nickname}
          </span>
          <span className="text-[9px] uppercase text-muted-foreground">White</span>
        </div>
        <div className="text-center text-muted-foreground text-sm font-bold">VS</div>
        <div className="flex flex-col items-center gap-1">
          <Avatar nickname={session.player?.nickname ?? "?"} tone="player" />
          <span className="text-xs font-semibold truncate max-w-[100px]">
            {session.player?.nickname ?? "—"}
          </span>
          <span className="text-[9px] uppercase text-muted-foreground">Black</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3 text-center">
        <h1 className="text-3xl font-black">
          {outcome === "win" ? "You won!" : outcome === "loss" ? "You lost!" : "Match finished"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {reason === "resign"
            ? "by resignation"
            : reason === "decline"
              ? "double declined"
              : `bear-off complete`}
          {cube > 1 && ` · cube ${cube}×`}
        </p>

        <div className="grid grid-cols-2 gap-3 w-full text-xs">
          <div className="bg-muted rounded p-3">
            <div className="font-bold text-base">{session.state.off.white}</div>
            <div className="text-muted-foreground">White borne off</div>
          </div>
          <div className="bg-muted rounded p-3">
            <div className="font-bold text-base">{session.state.off.black}</div>
            <div className="text-muted-foreground">Black borne off</div>
          </div>
        </div>

        {isWinner && (
          <div className="w-full flex flex-col gap-2 text-left">
            <Label htmlFor="msg">Victory message</Label>
            <Textarea
              id="msg"
              value={winnerMsg}
              maxLength={120}
              onChange={(e) => setWinnerMsg(e.target.value.slice(0, 120))}
              rows={2}
            />
          </div>
        )}
        {isLoser && (
          <div className="w-full flex flex-col gap-2 text-left">
            <Label htmlFor="msg">Celebrate message</Label>
            <Textarea
              id="msg"
              value={loserMsg}
              maxLength={120}
              onChange={(e) => setLoserMsg(e.target.value.slice(0, 120))}
              rows={2}
            />
          </div>
        )}

        <Button
          size="lg"
          className="w-full bg-amber-600 hover:bg-amber-500 text-white"
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? "Preparing…" : "Export as Video"}
        </Button>
        {downloadUrl && (
          <a
            href={downloadUrl}
            download={`play-withme-bg-${sessionId}.mp4`}
            className="text-xs underline text-muted-foreground"
          >
            Download again
          </a>
        )}

        <Button variant="outline" className="w-full" onClick={() => void navigate({ to: "/" })}>
          New match
        </Button>
      </div>

      {exporting && (
        <div className="absolute inset-0 bg-black/80 z-30 flex flex-col items-center justify-center gap-4 text-white">
          <div className="h-12 w-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="font-medium">Preparing your replay video…</p>
        </div>
      )}
    </GameFrame>
  );
}
