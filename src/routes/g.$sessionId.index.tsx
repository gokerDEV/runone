import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GameFrame } from "@/components/GameFrame";
import { Avatar } from "@/components/Avatar";
import { WinnerProgressBar } from "@/components/WinnerProgressBar";
import { TimeProgressBar } from "@/components/TimeProgressBar";
import { AdSlot } from "@/components/AdSlot";
import { TicTacToeBoard } from "@/components/board/TicTacToeBoard";
import { ExitConfirm } from "@/components/exit/ExitConfirm";
import { useLocalProfile } from "@/lib/profile/useLocalProfile";
import { useChannel } from "@/lib/realtime/usePusher";
import {
  forfeitSession,
  getSession,
  joinSession,
  playMove,
  tickTimeout,
} from "@/lib/games/tictactoe/session.functions";
import { advantage, symbolFor } from "@/lib/games/tictactoe/engine";
import type { GameSession, PlayerRole, SymbolMark } from "@/lib/games/tictactoe/types";
import { DEFAULT_TURN_SECONDS } from "@/lib/games/tictactoe/types";

export const Route = createFileRoute("/g/$sessionId/")({
  head: () => ({
    meta: [
      { title: "play.withme · Tic Tac Toe" },
      { name: "description", content: "Join a Tic Tac Toe match on play.withme." },
    ],
  }),
  component: GamePage,
});

type Role = "host" | "player" | "spectator" | "open" | "full" | "missing" | "expired" | "closed";

type ReplayMove = { role: PlayerRole; symbol: SymbolMark; cellIndex: number };

function GamePage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const { localUserId, nickname, setNickname, ready } = useLocalProfile();
  const [draftName, setDraftName] = useState("");
  const [session, setSession] = useState<GameSession | null>(null);
  const [role, setRole] = useState<Role>("missing");
  const [loading, setLoading] = useState(true);
  const [exitOpen, setExitOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moves, setMoves] = useState<ReplayMove[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);

  const getFn = useServerFn(getSession);
  const joinFn = useServerFn(joinSession);
  const playFn = useServerFn(playMove);
  const forfeitFn = useServerFn(forfeitSession);
  const timeoutFn = useServerFn(tickTimeout);

  // Initial load + auto-join when slot is open
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const res = await getFn({ data: { sessionId, localUserId } });
      if (cancelled) return;
      if (res.role === "open" && nickname) {
        const joined = await joinFn({
          data: { sessionId, localUserId, nickname },
        });
        if (cancelled) return;
        setSession(joined.session);
        setRole(joined.role as Role);
      } else {
        setSession(res.session);
        setRole(res.role as Role);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, sessionId, localUserId, nickname, getFn, joinFn]);

  // Realtime updates
  useChannel(session ? `game-${sessionId}` : null, {
    "state:update": (data) => {
      const next = (data as { session: GameSession }).session;
      setSession(next);
    },
    "player:joined": (data) => {
      const next = (data as { session: GameSession }).session;
      setSession(next);
    },
    "game:finished": (data) => {
      const next = (data as { session: GameSession }).session;
      setSession(next);
    },
  });

  // Track moves locally for replay
  useEffect(() => {
    if (!session) return;
    setMoves((prev) => {
      // Reconstruct from board if mismatch
      const board = session.state.board;
      const filled: ReplayMove[] = [];
      for (let i = 0; i < 9; i++) {
        const sym = board[i];
        if (sym) {
          const existing = prev.find((m) => m.cellIndex === i);
          if (existing) {
            filled.push(existing);
          } else {
            const role: PlayerRole = sym === "X" ? "host" : "player";
            filled.push({ role, symbol: sym, cellIndex: i });
          }
        }
      }
      // Sort by previous order if available, otherwise by cell order
      filled.sort((a, b) => {
        const ai = prev.findIndex((p) => p.cellIndex === a.cellIndex);
        const bi = prev.findIndex((p) => p.cellIndex === b.cellIndex);
        if (ai === -1 && bi === -1) return a.cellIndex - b.cellIndex;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      return filled;
    });
  }, [session]);

  // Persist moves so /result can read them
  useEffect(() => {
    if (typeof window !== "undefined" && session) {
      window.sessionStorage.setItem(`pwm:moves:${sessionId}`, JSON.stringify(moves));
    }
  }, [moves, sessionId, session]);

  // Navigate to result when finished
  useEffect(() => {
    if (session?.status === "finished") {
      void navigate({ to: "/g/$sessionId/result", params: { sessionId } });
    }
  }, [session?.status, sessionId, navigate]);

  // Turn timer (timed mode)
  const turnSeconds = session?.settings.turnSeconds ?? DEFAULT_TURN_SECONDS;
  const isMyTurn = useMemo(() => {
    if (!session || (role !== "host" && role !== "player")) return false;
    return session.state.currentTurn === role && session.status !== "finished";
  }, [session, role]);

  useEffect(() => {
    if (!session || session.settings.timingMode !== "timed" || session.status === "finished") {
      setRemaining(null);
      return;
    }
    setRemaining(turnSeconds);
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const left = Math.max(0, turnSeconds - elapsed);
      setRemaining(left);
      if (left <= 0 && isMyTurn) {
        window.clearInterval(id);
        void timeoutFn({ data: { sessionId, localUserId } }).catch(console.error);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [session?.state.currentTurn, session?.status, session?.settings.timingMode, turnSeconds, isMyTurn, sessionId, localUserId, timeoutFn]);

  const adv = useMemo(
    () => (session ? advantage(session.state, session.result) : 0.5),
    [session],
  );

  const onCell = useCallback(
    async (i: number) => {
      if (!isMyTurn || !session) return;
      // Optimistic: record symbol locally
      const sym: SymbolMark = symbolFor(role as PlayerRole);
      setMoves((prev) => [...prev, { role: role as PlayerRole, symbol: sym, cellIndex: i }]);
      try {
        const res = await playFn({ data: { sessionId, localUserId, cellIndex: i } });
        setSession(res.session);
      } catch (e) {
        console.error(e);
        setMoves((prev) => prev.filter((m) => m.cellIndex !== i));
      }
    },
    [isMyTurn, session, role, sessionId, localUserId, playFn],
  );

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/g/${sessionId}` : "";

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  async function onConfirmExit() {
    setExitOpen(false);
    if (role === "host" || role === "player") {
      try {
        const res = await forfeitFn({ data: { sessionId, localUserId } });
        setSession(res.session);
      } catch (e) {
        console.error(e);
      }
    } else {
      void navigate({ to: "/" });
    }
  }

  if (!ready || loading) {
    return <CenterMessage>Loading…</CenterMessage>;
  }

  // Nickname gate for guests
  if (!nickname && (role === "open" || role === "spectator" || role === "full")) {
    return (
      <GameFrame>
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <h2 className="text-xl font-semibold">Join the match</h2>
          <div className="w-full flex flex-col gap-2">
            <Label htmlFor="nick">Nickname</Label>
            <Input
              id="nick"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              maxLength={24}
              placeholder="Your nickname"
            />
          </div>
          <Button
            disabled={!draftName.trim()}
            className="w-full"
            onClick={() => {
              setNickname(draftName);
            }}
          >
            Continue
          </Button>
        </div>
      </GameFrame>
    );
  }

  if (role === "missing") return <CenterMessage>Match not found</CenterMessage>;
  if (role === "expired") return <CenterMessage>This invite has expired</CenterMessage>;
  if (role === "closed") return <CenterMessage>This match has ended</CenterMessage>;
  if (role === "full") {
    return (
      <GameFrame>
        <Header onExit={() => void navigate({ to: "/" })} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-xl font-semibold">Game already in progress</h2>
          {session && (
            <p className="text-muted-foreground text-sm">
              {session.host.nickname} vs {session.player?.nickname ?? "—"} · Tic Tac Toe
            </p>
          )}
          <AdSlot className="w-full h-32 my-4" label="Ad placeholder" />
          <Button onClick={() => void navigate({ to: "/" })}>Start your own match</Button>
        </div>
      </GameFrame>
    );
  }

  if (!session) return <CenterMessage>Loading…</CenterMessage>;

  const waiting = !session.player;

  return (
    <GameFrame>
      <Header onExit={() => setExitOpen(true)} />

      {/* Player row */}
      <div className="grid grid-cols-3 items-center px-4 pt-2">
        <div className="flex flex-col items-center gap-1">
          <Avatar nickname={session.host.nickname} tone="host" />
          <span className="text-xs font-semibold truncate max-w-[100px]">{session.host.nickname}</span>
        </div>
        <div className="text-center text-muted-foreground text-sm font-bold">VS</div>
        <div className="flex flex-col items-center gap-1">
          {session.player ? (
            <>
              <Avatar nickname={session.player.nickname} tone="player" />
              <span className="text-xs font-semibold truncate max-w-[100px]">{session.player.nickname}</span>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full border-2 border-dashed border-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">waiting…</span>
            </>
          )}
        </div>
      </div>

      <WinnerProgressBar advantage={adv} />
      {session.settings.timingMode === "timed" && remaining !== null && (
        <TimeProgressBar remaining={remaining} total={turnSeconds} />
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {waiting && role === "host" ? (
          <div className="w-full max-w-xs flex flex-col gap-3 items-center">
            <p className="text-sm text-muted-foreground text-center">Share this link to invite a friend</p>
            <div className="w-full flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs" />
              <Button onClick={onCopy} size="icon" variant="outline" aria-label="Copy invite">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <TicTacToeBoard
            board={session.state.board}
            winningLine={session.state.winningLine}
            disabled={!isMyTurn || waiting}
            onCell={(i) => void onCell(i)}
          />
        )}
        {!waiting && (
          <p className="mt-3 text-xs text-muted-foreground">
            {session.status === "finished"
              ? "Game over"
              : isMyTurn
              ? "Your turn"
              : "Opponent's turn"}
          </p>
        )}
      </div>

      <div className="px-4 pb-3">
        <AdSlot className="w-full h-14" />
      </div>

      <ExitConfirm open={exitOpen} onCancel={() => setExitOpen(false)} onConfirm={onConfirmExit} />
    </GameFrame>
  );
}

function Header({ onExit }: { onExit: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
      <div className="text-sm font-semibold">
        play.withme <span className="text-muted-foreground font-normal">· TicTacToe</span>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
        aria-label="Exit"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function CenterMessage({ children }: { children: React.ReactNode }) {
  return (
    <GameFrame>
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <p className="text-lg font-medium">{children}</p>
        <Button asChild variant="outline">
          <a href="/">Back home</a>
        </Button>
      </div>
    </GameFrame>
  );
}
