import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X, Copy, Check, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GameFrame } from "@/components/GameFrame";
import { GameHeader } from "@/components/GameHeader";
import { Avatar, type ConnStatus } from "@/components/Avatar";
import { WinnerProgressBar } from "@/components/WinnerProgressBar";
import { AdSlot } from "@/components/AdSlot";
import { BackgammonBoard } from "@/components/board/BackgammonBoard";
import { ExitConfirm } from "@/components/exit/ExitConfirm";
import { useLocalProfile } from "@/lib/profile/useLocalProfile";
import { useChannel } from "@/lib/realtime/usePusher";
import { relay } from "@/lib/games/tictactoe/session.functions";
import {
  startingState,
  rollDice,
  applyMove,
  endTurn,
  legalMoves,
  canOfferDouble as canOfferDoubleFn,
  offerDouble,
  acceptDouble,
  declineDouble,
  resign,
  advantage,
} from "@/lib/games/backgammon/engine";
import { sfx, isMuted, setMuted } from "@/lib/sound";
import type { BgSession, Color, Move } from "@/lib/games/backgammon/types";
import { colorOf } from "@/lib/games/backgammon/types";

export const Route = createFileRoute("/b/$sessionId/")({
  head: () => ({
    meta: [
      { title: "play.withme · Backgammon" },
      { name: "description", content: "Join a Backgammon match on play.withme." },
    ],
  }),
  component: BgPage,
});

type Role = "host" | "player" | "spectator" | "open" | "full" | "missing";

function BgPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const { localUserId, nickname, setNickname, challengeMsg, giphyUrl, ready } = useLocalProfile();
  const [draftName, setDraftName] = useState("");
  const [session, setSession] = useState<BgSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [selected, setSelected] = useState<number | "bar" | null>(null);
  const [peerLastSeen, setPeerLastSeen] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const sessionRef = useRef<BgSession | null>(null);
  sessionRef.current = session;
  const prevPeerConnectedRef = useRef<boolean | null>(null);
  const prevDiceLenRef = useRef(0);

  const relayFn = useServerFn(relay);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    setIsHost(!!localStorage.getItem(`pwm:bg-host:${sessionId}`));
    const raw = localStorage.getItem(`pwm:bg-session:${sessionId}`);
    if (raw) {
      try {
        setSession(JSON.parse(raw) as BgSession);
      } catch {
        /* noop */
      }
    }
    setLoaded(true);
  }, [ready, sessionId]);

  useEffect(() => {
    if (session && typeof window !== "undefined") {
      try {
        localStorage.setItem(`pwm:bg-session:${sessionId}`, JSON.stringify(session));
        // Append snapshot if state changed
        const key = `pwm:bg-snaps:${sessionId}`;
        const raw = window.sessionStorage.getItem(key);
        const arr: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
        const last = arr[arr.length - 1] as { _t?: string } | undefined;
        if (!last || last._t !== session.updatedAt) {
          arr.push({ ...session.state, _t: session.updatedAt });
          if (arr.length > 400) arr.splice(0, arr.length - 400);
          window.sessionStorage.setItem(key, JSON.stringify(arr));
        }
      } catch {
        /* noop */
      }
    }
  }, [session, sessionId]);

  const role: Role = useMemo(() => {
    if (!loaded) return "missing";
    if (isHost) return "host";
    if (!session) return "open";
    if (session.player?.localUserId === localUserId) return "player";
    if (session.player) return "full";
    return "open";
  }, [loaded, isHost, session, localUserId]);

  const myColor: Color | null =
    role === "host" || role === "player" ? colorOf(role as "host" | "player") : null;

  const broadcast = useCallback(
    async (
      event: "player:hello" | "state:update" | "peer:ping" | "peer:leave",
      payload: unknown,
    ) => {
      try {
        await relayFn({ data: { sessionId, kind: "bg", event, payload } });
      } catch (e) {
        console.error("relay failed", e);
      }
    },
    [relayFn, sessionId],
  );

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  useChannel(loaded ? `bg-${sessionId}` : null, {
    "player:hello": (data) => {
      const hello = data as {
        localUserId: string;
        nickname: string;
        challengeMsg?: string;
        giphyUrl?: string;
      };
      setPeerLastSeen(Date.now());
      if (!isHost) return;
      const prev = sessionRef.current;
      if (!prev) return;
      if (prev.player && prev.player.localUserId !== hello.localUserId) {
        void broadcast("state:update", { session: prev, from: localUserId });
        return;
      }
      if (prev.player && prev.player.localUserId === hello.localUserId) {
        void broadcast("state:update", { session: prev, from: localUserId });
        return;
      }
      const nowIso = new Date().toISOString();
      const next: BgSession = {
        ...prev,
        player: {
          localUserId: hello.localUserId,
          nickname: hello.nickname,
          challengeMsg: hello.challengeMsg,
          giphyUrl: hello.giphyUrl,
        },
        status: "playing",
        updatedAt: nowIso,
      };
      setSession(next);
      toast.success(`${hello.nickname} joined`);
      sfx.join();
      void broadcast("state:update", { session: next, from: localUserId });
    },
    "state:update": (data) => {
      const payload = data as { session: BgSession; from?: string };
      if (payload.from && payload.from !== localUserId) setPeerLastSeen(Date.now());
      setSession((prev) => {
        if (prev && prev.updatedAt > payload.session.updatedAt) return prev;
        return payload.session;
      });
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

  const helloSentRef = useRef(false);
  useEffect(() => {
    if (!loaded || isHost || !nickname) return;
    if (session?.player?.localUserId === localUserId) return;
    if (helloSentRef.current) return;
    helloSentRef.current = true;
    void broadcast("player:hello", { localUserId, nickname, challengeMsg, giphyUrl });
  }, [
    loaded,
    isHost,
    nickname,
    challengeMsg,
    giphyUrl,
    session?.player?.localUserId,
    localUserId,
    broadcast,
  ]);

  useEffect(() => {
    if (!loaded || !session?.player || session.status === "finished") return;
    const id = window.setInterval(() => {
      void broadcast("peer:ping", { from: localUserId });
    }, 5000);
    void broadcast("peer:ping", { from: localUserId });
    return () => window.clearInterval(id);
  }, [loaded, session?.player, session?.status, broadcast, localUserId]);

  useEffect(() => {
    if (!session?.player || session.status === "finished") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session?.player, session?.status]);

  useEffect(() => {
    if (!loaded) return;
    const handler = () => {
      try {
        void broadcast("peer:leave", { from: localUserId, nickname });
      } catch {
        /* noop */
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loaded, broadcast, localUserId, nickname]);

  // Peer status + connect/disconnect/reconnect sounds
  const peerStatus: ConnStatus = useMemo(() => {
    if (!session?.player) return "waiting";
    if (peerLastSeen === null) return "disconnected";
    return now - peerLastSeen < 12000 ? "connected" : "disconnected";
  }, [session?.player, peerLastSeen, now]);

  useEffect(() => {
    if (!session?.player) return;
    const connected = peerStatus === "connected";
    if (prevPeerConnectedRef.current === null) {
      prevPeerConnectedRef.current = connected;
      return;
    }
    if (prevPeerConnectedRef.current && !connected) {
      sfx.disconnect();
      toast.warning("Connection lost");
    } else if (!prevPeerConnectedRef.current && connected) {
      sfx.reconnect();
      toast.success("Reconnected");
    }
    prevPeerConnectedRef.current = connected;
  }, [peerStatus, session?.player]);

  // Dice roll sound (whenever dice count grows for the active player)
  useEffect(() => {
    const len = session?.state.dice.length ?? 0;
    if (len > prevDiceLenRef.current) sfx.dice();
    prevDiceLenRef.current = len;
  }, [session?.state.dice]);

  // Finish navigation
  useEffect(() => {
    if (session?.status !== "finished" || !session.state.winner) return;
    const mine = myColor && session.state.winner === myColor;
    if (mine) {
      sfx.win();
      toast.success("You won!");
    } else {
      sfx.lose();
      toast.error("You lost");
    }
    const t = window.setTimeout(() => {
      void navigate({ to: "/replay", search: { s: sessionId } });
    }, 1400);
    return () => window.clearTimeout(t);
  }, [session?.status, session?.state.winner, myColor, sessionId, navigate]);

  const hostStatus: ConnStatus = isHost ? "connected" : peerStatus;
  const playerStatus: ConnStatus = !session?.player ? "waiting" : isHost ? peerStatus : "connected";

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    if (!next) sfx.notify();
  }

  const isMyTurn = useMemo(() => {
    if (!session || !myColor) return false;
    if (session.status === "finished") return false;
    return session.state.turn === myColor;
  }, [session, myColor]);

  const canOffer =
    !!session && !!myColor && canOfferDoubleFn(session.state, myColor) && !!session.player;
  const adv = useMemo(() => (session ? advantage(session.state) : 0.5), [session]);

  const pushState = useCallback(
    (next: BgSession) => {
      setSession(next);
      void broadcast("state:update", { session: next, from: localUserId });
    },
    [broadcast, localUserId],
  );

  function handleRoll(isCheat?: boolean) {
    if (!session || !myColor) return;
    if (!isMyTurn || session.state.rolled || session.state.pendingDouble) return;
    const ns = rollDice(session.state, isCheat);
    pushState({ ...session, state: ns, updatedAt: new Date().toISOString() });
  }

  function handleApply(mv: Move) {
    if (!session || !myColor || !isMyTurn) return;
    sfx.move();
    let ns = applyMove(session.state, myColor, mv);
    // auto-end turn if no remaining legal moves and dice consumed
    if (!ns.winner && ns.dice.length === 0) {
      ns = endTurn(ns);
    } else if (!ns.winner && legalMoves(ns, myColor).length === 0) {
      // no more usable dice — auto-end
      ns = endTurn(ns);
    }
    const nowIso = new Date().toISOString();
    const next: BgSession = { ...session, state: ns, updatedAt: nowIso };
    if (ns.winner) {
      next.status = "finished";
      next.finishedAt = nowIso;
    }
    pushState(next);
  }

  function handleEndTurn() {
    if (!session || !myColor || !isMyTurn || !session.state.rolled) return;
    if (legalMoves(session.state, myColor).length > 0) return;
    const ns = endTurn(session.state);
    pushState({ ...session, state: ns, updatedAt: new Date().toISOString() });
  }

  function handleOfferDouble() {
    if (!session || !myColor || !canOffer) return;
    const ns = offerDouble(session.state, myColor);
    pushState({ ...session, state: ns, updatedAt: new Date().toISOString() });
  }

  function handleAcceptDouble() {
    if (!session) return;
    const ns = acceptDouble(session.state);
    pushState({ ...session, state: ns, updatedAt: new Date().toISOString() });
  }

  function handleDeclineDouble() {
    if (!session) return;
    const ns = declineDouble(session.state);
    const nowIso = new Date().toISOString();
    pushState({
      ...session,
      state: ns,
      status: ns.winner ? "finished" : session.status,
      finishedAt: ns.winner ? nowIso : session.finishedAt,
      updatedAt: nowIso,
    });
  }

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/b/${sessionId}` : "";

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      sfx.copy();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  function onConfirmExit() {
    setExitOpen(false);
    if (!session || !myColor || session.status === "finished") {
      void navigate({ to: "/" });
      return;
    }
    const ns = resign(session.state, myColor);
    const nowIso = new Date().toISOString();
    pushState({ ...session, state: ns, status: "finished", finishedAt: nowIso, updatedAt: nowIso });
  }

  if (!ready || !loaded) return <CenterMessage>Loading…</CenterMessage>;

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

  if (!isHost && !session) return <CenterMessage>Connecting…</CenterMessage>;

  if (role === "full") {
    return (
      <GameFrame>
        <GameHeader onExit={() => void navigate({ to: "/" })} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-xl font-semibold">Game already in progress</h2>
          {session && (
            <p className="text-muted-foreground text-sm">
              {session.host.nickname} vs {session.player?.nickname ?? "—"} · Backgammon
            </p>
          )}
          <Button onClick={() => void navigate({ to: "/" })}>Start your own match</Button>
        </div>
      </GameFrame>
    );
  }

  if (!session) return <CenterMessage>Loading…</CenterMessage>;

  const waiting = !session.player;
  const opponentOfferedToMe =
    session.state.pendingDouble && myColor && session.state.pendingDouble !== myColor;

  return (
    <GameFrame>
      <GameHeader
        whitePlayer={session.host.nickname}
        whiteStatus={hostStatus}
        blackPlayer={session.player?.nickname}
        blackStatus={playerStatus}
        showControls={true}
        onExit={() => setExitOpen(true)}
        muted={muted}
        onToggleMute={toggleMute}
      />

      <div className="mt-1 mx-4 h-4 p-1 bg-muted rounded-full">
        <WinnerProgressBar advantage={adv} />
      </div>
      <div className="mt-1 mx-4 h-4 p-1">
        {/* TODO: Timer for  time based playing */}
        {/* <TimerProgressBar /> */}
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-2 py-4 overflow-hidden">
        {waiting && isHost ? (
          <div className="w-full max-w-xs flex flex-col gap-3 items-center px-4 mt-8">
            <p className="text-sm text-muted-foreground text-center">
              Share this link to invite a friend
            </p>
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
          <div className="w-full max-w-xl mx-auto px-2">
            <BackgammonBoard
              state={session.state}
              myColor={myColor}
              selected={selected}
              onSelect={setSelected}
              onApply={handleApply}
              onRoll={handleRoll}
              onEndTurn={handleEndTurn}
              onOfferDouble={handleOfferDouble}
              isMyTurn={isMyTurn}
              canOffer={canOffer}
            />
          </div>
        )}
        {!waiting && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <p className="text-xs text-muted-foreground text-center">
              {session.status === "finished"
                ? "Game over"
                : isMyTurn
                  ? session.state.rolled
                    ? "Your turn — move"
                    : "Your turn — roll or double"
                  : "Opponent's turn"}
            </p>
            {session.status === "finished" && (
              <Button
                onClick={() => void navigate({ to: "/replay", search: { s: sessionId } })}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-6 py-2 rounded-full shadow-lg"
              >
                <Download className="w-4 h-4 mr-2" /> Export Replay Video
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-3 mt-auto w-full shrink-0">
        <AdSlot className="w-full h-14" />
      </div>

      {opponentOfferedToMe && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6">
          <div className="bg-background rounded-xl p-5 w-full max-w-xs text-center shadow-2xl">
            <h3 className="text-lg font-semibold">Double offered</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Opponent doubles to {session.state.cube.value * 2}. Accept or resign at{" "}
              {session.state.cube.value}?
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleDeclineDouble}>
                Decline (lose)
              </Button>
              <Button className="flex-1" onClick={handleAcceptDouble}>
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}

      <ExitConfirm open={exitOpen} onCancel={() => setExitOpen(false)} onConfirm={onConfirmExit} />
    </GameFrame>
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
