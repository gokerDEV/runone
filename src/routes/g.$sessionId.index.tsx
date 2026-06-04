import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X, Copy, Check, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GameFrame } from "@/components/GameFrame";
import { Avatar, type ConnStatus } from "@/components/Avatar";
import { WinnerProgressBar } from "@/components/WinnerProgressBar";
import { TimeProgressBar } from "@/components/TimeProgressBar";
import { AdSlot } from "@/components/AdSlot";
import { TicTacToeBoard } from "@/components/board/TicTacToeBoard";
import { ExitConfirm } from "@/components/exit/ExitConfirm";
import { useLocalProfile } from "@/lib/profile/useLocalProfile";
import { useChannel } from "@/lib/realtime/usePusher";
import { relay } from "@/lib/games/tictactoe/session.functions";
import { advantage, applyMove, isDraw, symbolFor } from "@/lib/games/tictactoe/engine";
import { sfx, isMuted, setMuted } from "@/lib/sound";
import type { GameSession, PlayerRole, SymbolMark } from "@/lib/games/tictactoe/types";
import { DEFAULT_TURN_SECONDS, MAX_TIMEOUTS_BEFORE_LOSS } from "@/lib/games/tictactoe/types";

export const Route = createFileRoute("/g/$sessionId/")({
  head: () => ({
    meta: [
      { title: "play.withme · Tic Tac Toe" },
      { name: "description", content: "Join a Tic Tac Toe match on play.withme." },
    ],
  }),
  component: GamePage,
});

type Role = "host" | "player" | "spectator" | "open" | "full" | "missing";

type ReplayMove = { role: PlayerRole; symbol: SymbolMark; cellIndex: number };

function GamePage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const { localUserId, nickname, setNickname, ready } = useLocalProfile();
  const [draftName, setDraftName] = useState("");
  const [session, setSession] = useState<GameSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [moves, setMoves] = useState<ReplayMove[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [muted, setMutedState] = useState(false);
  const [peerLastSeen, setPeerLastSeen] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const sessionRef = useRef<GameSession | null>(null);
  sessionRef.current = session;
  const movesRef = useRef<ReplayMove[]>([]);
  movesRef.current = moves;
  const prevMovesLenRef = useRef(0);
  const prevPlayerIdRef = useRef<string | null>(null);
  const prevPeerConnectedRef = useRef<boolean | null>(null);
  const peerLastSeenRef = useRef<number | null>(null);
  peerLastSeenRef.current = peerLastSeen;

  const relayFn = useServerFn(relay);

  // Boot: hydrate from localStorage
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    setIsHost(!!localStorage.getItem(`pwm:host:${sessionId}`));
    const raw = localStorage.getItem(`pwm:session:${sessionId}`);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as GameSession);
      } catch {
        /* noop */
      }
    }
    setLoaded(true);
  }, [ready, sessionId]);

  // Persist session
  useEffect(() => {
    if (session && typeof window !== "undefined") {
      try {
        localStorage.setItem(`pwm:session:${sessionId}`, JSON.stringify(session));
      } catch {
        /* noop */
      }
    }
  }, [session, sessionId]);

  // Derived role
  const role: Role = useMemo(() => {
    if (!loaded) return "missing";
    if (isHost) return "host";
    if (!session) return "open";
    if (session.player?.localUserId === localUserId) return "player";
    if (session.player) return "full";
    return "open";
  }, [loaded, isHost, session, localUserId]);

  // Broadcast helper
  const broadcast = useCallback(
    async (
      event: "player:hello" | "state:update" | "game:finished" | "peer:ping" | "peer:leave",
      payload: unknown,
    ) => {
      try {
        await relayFn({ data: { sessionId, event, payload } });
      } catch (e) {
        console.error("relay failed", e);
      }
    },
    [relayFn, sessionId],
  );

  // Init mute state
  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  // Realtime
  useChannel(loaded ? `game-${sessionId}` : null, {
    "player:hello": (data) => {
      const hello = data as { localUserId: string; nickname: string };
      setPeerLastSeen(Date.now());
      if (!isHost) return;
      const prev = sessionRef.current;
      if (!prev) return;
      // Same guest re-announcing: just resend state.
      if (prev.player && prev.player.localUserId !== hello.localUserId) {
        void broadcast("state:update", { session: prev, moves: movesRef.current, from: localUserId });
        return;
      }
      if (prev.player && prev.player.localUserId === hello.localUserId) {
        void broadcast("state:update", { session: prev, moves: movesRef.current, from: localUserId });
        return;
      }
      const nowIso = new Date().toISOString();
      const next: GameSession = {
        ...prev,
        player: { localUserId: hello.localUserId, nickname: hello.nickname },
        status: "playing",
        startedAt: nowIso,
        updatedAt: nowIso,
      };
      setSession(next);
      toast.success(`${hello.nickname} joined`);
      sfx.join();
      void broadcast("state:update", { session: next, moves: movesRef.current, from: localUserId });
    },
    "state:update": (data) => {
      const payload = data as { session: GameSession; moves?: ReplayMove[]; from?: string };
      const next = payload.session;
      if (payload.from && payload.from !== localUserId) setPeerLastSeen(Date.now());
      setSession((prev) => {
        if (prev && prev.updatedAt > next.updatedAt) return prev;
        return next;
      });
      if (payload.moves) setMoves(payload.moves);
    },
    "peer:ping": (data) => {
      const p = data as { from: string };
      if (p.from !== localUserId) setPeerLastSeen(Date.now());
    },
    "peer:leave": (data) => {
      const p = data as { from: string; nickname?: string };
      if (p.from === localUserId) return;
      setPeerLastSeen(null);
      if (p.nickname) toast.warning(`${p.nickname} disconnected`);
      sfx.leave();
    },
  });

  // Guest: announce self once nickname is known and we haven't been admitted yet.
  const helloSentRef = useRef(false);
  useEffect(() => {
    if (!loaded || isHost || !nickname) return;
    if (session?.player?.localUserId === localUserId) return;
    if (helloSentRef.current) return;
    helloSentRef.current = true;
    void broadcast("player:hello", { localUserId, nickname });
  }, [loaded, isHost, nickname, session?.player?.localUserId, localUserId, broadcast]);

  // Heartbeat ping every 5s when there's an opponent
  useEffect(() => {
    if (!loaded || !session?.player || session.status === "finished") return;
    const id = window.setInterval(() => {
      void broadcast("peer:ping", { from: localUserId });
    }, 5000);
    void broadcast("peer:ping", { from: localUserId });
    return () => window.clearInterval(id);
  }, [loaded, session?.player, session?.status, broadcast, localUserId]);

  // Tick "now" once per second to evaluate peer freshness
  useEffect(() => {
    if (!session?.player || session.status === "finished") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session?.player, session?.status]);

  // Announce leave on unload
  useEffect(() => {
    if (!loaded) return;
    const handler = () => {
      try {
        void broadcast("peer:leave", { from: localUserId, nickname });
      } catch { /* noop */ }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loaded, broadcast, localUserId, nickname]);

  // Toasts + sounds on opponent joining / leaving / moves
  useEffect(() => {
    const playerId = session?.player?.localUserId ?? null;
    if (playerId && playerId !== prevPlayerIdRef.current && !isHost && playerId === localUserId) {
      // We were just admitted — celebrate the connection.
      toast.success("Connected to host");
      sfx.join();
    }
    prevPlayerIdRef.current = playerId;
  }, [session?.player?.localUserId, isHost, localUserId]);

  useEffect(() => {
    const len = moves.length;
    const prev = prevMovesLenRef.current;
    if (len > prev) {
      const last = moves[len - 1];
      const mine = last.role === (isHost ? "host" : "player");
      if (mine) sfx.move();
      else sfx.opponentMove();
    }
    prevMovesLenRef.current = len;
  }, [moves, isHost]);

  // Persist moves for the result page
  useEffect(() => {
    if (typeof window !== "undefined" && session) {
      window.sessionStorage.setItem(`pwm:moves:${sessionId}`, JSON.stringify(moves));
    }
  }, [moves, sessionId, session]);


  // Finish: sound + toast, then navigate
  useEffect(() => {
    if (session?.status !== "finished" || !session.result) return;
    const r = session.result;
    const me = (isHost ? "host" : "player") as PlayerRole;
    if (r.reason === "draw") {
      sfx.draw();
      toast("It's a draw");
    } else if (r.winnerRole === me) {
      sfx.win();
      toast.success("You won!");
    } else {
      sfx.lose();
      toast.error(r.reason === "timeout" ? "You lost on time" : r.reason === "forfeit" ? "Opponent forfeited" : "You lost");
    }
    const t = window.setTimeout(() => {
      void navigate({ to: "/g/$sessionId/result", params: { sessionId } });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [session?.status, session?.result, isHost, sessionId, navigate]);

  // Peer connection status
  const peerStatus: ConnStatus = useMemo(() => {
    if (!session?.player) return "waiting";
    if (peerLastSeen === null) return "disconnected";
    return now - peerLastSeen < 12000 ? "connected" : "disconnected";
  }, [session?.player, peerLastSeen, now]);

  const hostStatus: ConnStatus = isHost ? "connected" : peerStatus;
  const playerStatus: ConnStatus = !session?.player ? "waiting" : isHost ? peerStatus : "connected";

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    if (!next) sfx.notify();
  }


  // Turn timer
  const turnSeconds = session?.settings.turnSeconds ?? DEFAULT_TURN_SECONDS;
  const isMyTurn = useMemo(() => {
    if (!session || (role !== "host" && role !== "player")) return false;
    if (!session.player) return false;
    return session.state.currentTurn === role && session.status !== "finished";
  }, [session, role]);

  const handleTimeoutRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (
      !session ||
      session.settings.timingMode !== "timed" ||
      session.status === "finished" ||
      !session.player
    ) {
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
        handleTimeoutRef.current();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [
    session?.state.currentTurn,
    session?.status,
    session?.settings.timingMode,
    session?.player,
    turnSeconds,
    isMyTurn,
  ]);

  handleTimeoutRef.current = () => {
    const cur = sessionRef.current;
    if (!cur) return;
    if (role !== "host" && role !== "player") return;
    const r = role as PlayerRole;
    const now = new Date().toISOString();
    const hostTimeouts = cur.state.hostTimeouts + (r === "host" ? 1 : 0);
    const playerTimeouts = cur.state.playerTimeouts + (r === "player" ? 1 : 0);
    const nextState = {
      ...cur.state,
      hostTimeouts,
      playerTimeouts,
      currentTurn: r === "host" ? ("player" as const) : ("host" as const),
    };
    const updated: GameSession = { ...cur, state: nextState, updatedAt: now };
    if (hostTimeouts >= MAX_TIMEOUTS_BEFORE_LOSS) {
      updated.status = "finished";
      updated.finishedAt = now;
      updated.result = { winnerRole: "player", loserRole: "host", reason: "timeout" };
    } else if (playerTimeouts >= MAX_TIMEOUTS_BEFORE_LOSS) {
      updated.status = "finished";
      updated.finishedAt = now;
      updated.result = { winnerRole: "host", loserRole: "player", reason: "timeout" };
    }
    setSession(updated);
    void broadcast("state:update", { session: updated, moves: movesRef.current, from: localUserId });
  };

  const adv = useMemo(
    () => (session ? advantage(session.state, session.result) : 0.5),
    [session],
  );

  const onCell = useCallback(
    (i: number) => {
      if (!isMyTurn || !session) return;
      let nextState;
      try {
        nextState = applyMove(session.state, role as PlayerRole, i);
      } catch (e) {
        console.error(e);
        return;
      }
      const sym: SymbolMark = symbolFor(role as PlayerRole);
      const newMove: ReplayMove = { role: role as PlayerRole, symbol: sym, cellIndex: i };
      const nextMoves = [...movesRef.current, newMove];
      setMoves(nextMoves);
      const now = new Date().toISOString();
      const updated: GameSession = { ...session, state: nextState, updatedAt: now };
      if (nextState.winningLine) {
        updated.status = "finished";
        updated.finishedAt = now;
        updated.result = {
          winnerRole: role as PlayerRole,
          loserRole: role === "host" ? "player" : "host",
          reason: "win",
          winningLine: nextState.winningLine,
        };
      } else if (isDraw(nextState)) {
        updated.status = "finished";
        updated.finishedAt = now;
        updated.result = { reason: "draw" };
      }
      setSession(updated);
      void broadcast("state:update", { session: updated, moves: nextMoves, from: localUserId });
    },
    [isMyTurn, session, role, broadcast],
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

  function onConfirmExit() {
    setExitOpen(false);
    if (!session || (role !== "host" && role !== "player") || session.status === "finished") {
      void navigate({ to: "/" });
      return;
    }
    const r = role as PlayerRole;
    const winner: PlayerRole = r === "host" ? "player" : "host";
    const now = new Date().toISOString();
    const updated: GameSession = {
      ...session,
      status: "finished",
      finishedAt: now,
      updatedAt: now,
      result: { winnerRole: winner, loserRole: r, reason: "forfeit" },
    };
    setSession(updated);
    void broadcast("state:update", { session: updated, moves: movesRef.current, from: localUserId });
  }

  if (!ready || !loaded) {
    return <CenterMessage>Loading…</CenterMessage>;
  }

  // Nickname gate for guests
  if (!nickname && !isHost) {
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
            onClick={() => setNickname(draftName)}
          >
            Continue
          </Button>
        </div>
      </GameFrame>
    );
  }

  // Guest waiting for host's state echo
  if (!isHost && !session) {
    return <CenterMessage>Connecting…</CenterMessage>;
  }

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
      <Header onExit={() => setExitOpen(true)} muted={muted} onToggleMute={toggleMute} />

      <div className="grid grid-cols-3 items-center px-4 pt-2">
        <div className="flex flex-col items-center gap-1">
          <Avatar nickname={session.host.nickname} tone="host" status={hostStatus} />
          <span className="text-xs font-semibold truncate max-w-[100px]">{session.host.nickname}</span>
        </div>
        <div className="text-center text-muted-foreground text-sm font-bold">VS</div>
        <div className="flex flex-col items-center gap-1">
          {session.player ? (
            <>
              <Avatar nickname={session.player.nickname} tone="player" status={playerStatus} />
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
        {waiting && isHost ? (
          <div className="w-full max-w-xs flex flex-col gap-3 items-center">
            <p className="text-sm text-muted-foreground text-center">Share this link to invite a friend</p>
            <div className="w-full flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs" />
              <Button onClick={onCopy} size="icon" variant="outline" aria-label="Copy invite">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Keep this tab open — closing it ends the match.
            </p>
          </div>
        ) : (
          <TicTacToeBoard
            board={session.state.board}
            winningLine={session.state.winningLine}
            disabled={!isMyTurn || waiting}
            onCell={(i) => onCell(i)}
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

function Header({
  onExit,
  muted,
  onToggleMute,
}: {
  onExit: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
      <div className="text-sm font-semibold">
        play.withme <span className="text-muted-foreground font-normal">· TicTacToe</span>
      </div>
      <div className="flex items-center gap-1">
        {onToggleMute && (
          <button
            type="button"
            onClick={onToggleMute}
            className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        )}
        <button
          type="button"
          onClick={onExit}
          className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
          aria-label="Exit"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
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
