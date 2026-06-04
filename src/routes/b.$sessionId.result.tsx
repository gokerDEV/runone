import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GameFrame } from "@/components/GameFrame";
import { Avatar } from "@/components/Avatar";
import { useLocalProfile } from "@/lib/profile/useLocalProfile";
import type { BgSession, Color } from "@/lib/games/backgammon/types";
import { colorOf } from "@/lib/games/backgammon/types";

export const Route = createFileRoute("/b/$sessionId/result")({
  head: () => ({ meta: [{ title: "Match result · play.withme" }] }),
  component: ResultPage,
});

function ResultPage() {
  const { sessionId } = Route.useParams();
  const { localUserId, ready } = useLocalProfile();
  const navigate = useNavigate();
  const [session, setSession] = useState<BgSession | null>(null);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const raw = localStorage.getItem(`pwm:bg-session:${sessionId}`);
    if (raw) {
      try { setSession(JSON.parse(raw) as BgSession); } catch { /* noop */ }
    }
  }, [ready, sessionId]);

  const myColor: Color | null = useMemo(() => {
    if (!session) return null;
    if (session.host.localUserId === localUserId) return colorOf("host");
    if (session.player?.localUserId === localUserId) return colorOf("player");
    return null;
  }, [session, localUserId]);

  if (!session) {
    return (
      <GameFrame>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading result…</div>
      </GameFrame>
    );
  }

  const winner = session.state.winner;
  const outcome = !winner ? "pending" : myColor && winner === myColor ? "win" : "loss";
  const cube = session.state.cube.value;
  const reason = session.state.endReason;

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
          <span className="text-xs font-semibold truncate max-w-[100px]">{session.host.nickname}</span>
          <span className="text-[9px] uppercase text-muted-foreground">White</span>
        </div>
        <div className="text-center text-muted-foreground text-sm font-bold">VS</div>
        <div className="flex flex-col items-center gap-1">
          <Avatar nickname={session.player?.nickname ?? "?"} tone="player" />
          <span className="text-xs font-semibold truncate max-w-[100px]">{session.player?.nickname ?? "—"}</span>
          <span className="text-[9px] uppercase text-muted-foreground">Black</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3 text-center">
        <h1 className="text-3xl font-black">
          {outcome === "win" ? "You won!" : outcome === "loss" ? "You lost!" : "Match finished"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {reason === "resign" ? "by resignation" : reason === "decline" ? "double declined" : `bear-off complete`}
          {cube > 1 && ` · cube ${cube}×`}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 w-full text-xs">
          <div className="bg-muted rounded p-3">
            <div className="font-bold text-base">{session.state.off.white}</div>
            <div className="text-muted-foreground">White borne off</div>
          </div>
          <div className="bg-muted rounded p-3">
            <div className="font-bold text-base">{session.state.off.black}</div>
            <div className="text-muted-foreground">Black borne off</div>
          </div>
        </div>

        <Button className="w-full mt-6" onClick={() => void navigate({ to: "/" })}>
          New match
        </Button>
      </div>
    </GameFrame>
  );
}
