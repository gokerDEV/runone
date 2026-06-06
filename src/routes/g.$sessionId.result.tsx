import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GameFrame } from "@/components/GameFrame";
import { Avatar } from "@/components/Avatar";
import { useLocalProfile } from "@/lib/profile/useLocalProfile";
import {
  MAX_POST_GAME_MESSAGE_LENGTH,
  type GameSession,
  type PlayerRole,
  type SymbolMark,
} from "@/lib/games/tictactoe/types";
import { exportReplayVideo } from "@/components/video/VideoExporter";

const WINNER_MESSAGES = [
  "Too easy.",
  "Another clean win.",
  "Next round?",
  "Strategy beats luck.",
  "I saw that coming.",
  "Board controlled.",
  "No mercy, just moves.",
  "That was surgical.",
  "Rematch if you dare.",
  "Victory looks good on me.",
];
const LOSER_MESSAGES = [
  "Lucky round.",
  "I demand a rematch.",
  "Fine. You got this one.",
  "Enjoy it while it lasts.",
  "Next one is mine.",
  "That was suspiciously good.",
  "I was warming up.",
  "One win does not mean anything.",
  "Okay, that move was clean.",
  "Revenge loading.",
];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const Route = createFileRoute("/g/$sessionId/result")({
  head: () => ({ meta: [{ title: "Match result · play.withme" }] }),
  component: ResultPage,
});

type ReplayMove = { role: PlayerRole; symbol: SymbolMark; cellIndex: number };

function ResultPage() {
  const { sessionId } = Route.useParams();
  const { localUserId, ready } = useLocalProfile();
  const navigate = useNavigate();

  const [session, setSession] = useState<GameSession | null>(null);
  const [moves, setMoves] = useState<ReplayMove[]>([]);
  const [winnerMsg, setWinnerMsg] = useState(() => pick(WINNER_MESSAGES));
  const [loserMsg, setLoserMsg] = useState(() => pick(LOSER_MESSAGES));
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const raw = localStorage.getItem(`pwm:session:${sessionId}`);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as GameSession);
      } catch {
        /* noop */
      }
    }
  }, [ready, sessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(`pwm:moves:${sessionId}`);
    if (raw) {
      try {
        setMoves(JSON.parse(raw) as ReplayMove[]);
      } catch {
        /* noop */
      }
    }
  }, [sessionId]);

  const myRole: PlayerRole | null = useMemo(() => {
    if (!session) return null;
    if (session.host.localUserId === localUserId) return "host";
    if (session.player?.localUserId === localUserId) return "player";
    return null;
  }, [session, localUserId]);

  const outcome = useMemo(() => {
    if (!session?.result) return "pending" as const;
    if (!session.result.winnerRole) return "draw" as const;
    if (myRole && session.result.winnerRole === myRole) return "win" as const;
    if (myRole) return "loss" as const;
    return "spectator" as const;
  }, [session, myRole]);

  const isWinner = outcome === "win";
  const isLoser = outcome === "loss";

  async function onExport() {
    if (!session) return;
    setExporting(true);
    try {
      const { blob, ext } = await exportReplayVideo({
        session,
        moves,
        winnerMessage: winnerMsg,
        loserMessage: loserMsg,
      });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = `play-withme-${sessionId}.${ext}`;
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

  const resultText =
    outcome === "win"
      ? "You won!"
      : outcome === "loss"
        ? "You lost!"
        : outcome === "draw"
          ? "Draw game!"
          : "Match finished";

  return (
    <GameFrame>
      <div className="px-4 pt-3 pb-1 flex items-center justify-between shrink-0">
        <div className="text-sm font-semibold">
          play.withme <span className="text-muted-foreground font-normal">· TicTacToe</span>
        </div>
      </div>

      <div className="grid grid-cols-3 items-center px-4 pt-2">
        <div className="flex flex-col items-center gap-1">
          <Avatar nickname={session.host.nickname} tone="host" />
          <span className="text-xs font-semibold truncate max-w-[100px]">
            {session.host.nickname}
          </span>
        </div>
        <div className="text-center text-muted-foreground text-sm font-bold">VS</div>
        <div className="flex flex-col items-center gap-1">
          <Avatar nickname={session.player?.nickname ?? "?"} tone="player" />
          <span className="text-xs font-semibold truncate max-w-[100px]">
            {session.player?.nickname ?? "—"}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-4 text-center">
        <h1 className="text-3xl font-black">{resultText}</h1>
        {session.result?.reason === "forfeit" && (
          <p className="text-xs text-muted-foreground">by forfeit</p>
        )}

        {isWinner && (
          <div className="w-full flex flex-col gap-2 text-left">
            <Label htmlFor="msg">Victory message</Label>
            <Textarea
              id="msg"
              value={winnerMsg}
              maxLength={MAX_POST_GAME_MESSAGE_LENGTH}
              onChange={(e) => setWinnerMsg(e.target.value.slice(0, MAX_POST_GAME_MESSAGE_LENGTH))}
              rows={2}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {winnerMsg.length}/{MAX_POST_GAME_MESSAGE_LENGTH}
            </p>
          </div>
        )}

        {isLoser && (
          <div className="w-full flex flex-col gap-2 text-left">
            <Label htmlFor="msg">Celebrate message</Label>
            <Textarea
              id="msg"
              value={loserMsg}
              maxLength={MAX_POST_GAME_MESSAGE_LENGTH}
              onChange={(e) => setLoserMsg(e.target.value.slice(0, MAX_POST_GAME_MESSAGE_LENGTH))}
              rows={2}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {loserMsg.length}/{MAX_POST_GAME_MESSAGE_LENGTH}
            </p>
          </div>
        )}

        <Button
          size="lg"
          className="w-full bg-indigo-500 hover:bg-indigo-400 text-white"
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? "Preparing…" : "Export as Video"}
        </Button>
        {downloadUrl && (
          <a
            href={downloadUrl}
            download={`play-withme-${sessionId}.mp4`}
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
          <div className="w-3/4 h-32 border border-dashed border-white/30 rounded-md flex items-center justify-center text-xs text-white/60">
            Ad placeholder
          </div>
        </div>
      )}
    </GameFrame>
  );
}
