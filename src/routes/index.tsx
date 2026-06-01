import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocalProfile } from "@/lib/profile/useLocalProfile";
import { emptyState } from "@/lib/games/tictactoe/engine";
import {
  DEFAULT_TURN_SECONDS,
  INVITE_LINK_TTL_MINUTES,
  type GameSession,
} from "@/lib/games/tictactoe/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "play.withme — Play with ME" },
      { name: "description", content: "Play Tic Tac Toe with a friend and share a vertical replay video." },
      { property: "og:title", content: "play.withme" },
      { property: "og:description", content: "Play with ME — two-player Tic Tac Toe with shareable replays." },
    ],
  }),
  component: Landing,
});

function newSessionId(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 7);
}

function Landing() {
  const { nickname, setNickname, localUserId, ready } = useLocalProfile();
  const [draftName, setDraftName] = useState("");
  const [timed, setTimed] = useState<"untimed" | "timed">("untimed");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const effectiveName = nickname || draftName.trim();

  function onCreate() {
    if (!effectiveName) return;
    if (!nickname) setNickname(draftName);
    setCreating(true);
    const sessionId = newSessionId();
    const now = new Date();
    const session: GameSession = {
      _id: sessionId,
      gameId: "tic-tac-toe",
      status: "created",
      host: { localUserId, nickname: effectiveName },
      settings: {
        timingMode: timed,
        turnSeconds: timed === "timed" ? DEFAULT_TURN_SECONDS : undefined,
      },
      state: emptyState(),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + INVITE_LINK_TTL_MINUTES * 60_000).toISOString(),
      updatedAt: now.toISOString(),
    };
    try {
      localStorage.setItem(`pwm:host:${sessionId}`, "1");
      localStorage.setItem(`pwm:session:${sessionId}`, JSON.stringify(session));
    } catch {
      /* noop */
    }
    void navigate({ to: "/g/$sessionId", params: { sessionId } });
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight">play.withme</h1>
          <p className="mt-2 text-lg text-white/70 font-medium">Play with ME</p>
        </header>

        {ready ? (
          <div className="bg-white/5 rounded-2xl p-5 flex flex-col gap-4 border border-white/10">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nick" className="text-white/80">Nickname</Label>
              <Input
                id="nick"
                value={nickname || draftName}
                onChange={(e) =>
                  nickname ? setNickname(e.target.value) : setDraftName(e.target.value)
                }
                placeholder="Enter your nickname"
                className="bg-white/10 border-white/20 text-white"
                maxLength={24}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-white/80">Game</Label>
              <div className="bg-white/10 rounded-md px-3 py-2 text-sm">Tic Tac Toe</div>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-white/80">Timing</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTimed("untimed")}
                  className={`rounded-md py-2 text-sm font-medium ${timed === "untimed" ? "bg-indigo-500 text-white" : "bg-white/10 text-white/70"}`}
                >
                  Untimed
                </button>
                <button
                  type="button"
                  onClick={() => setTimed("timed")}
                  className={`rounded-md py-2 text-sm font-medium ${timed === "timed" ? "bg-indigo-500 text-white" : "bg-white/10 text-white/70"}`}
                >
                  {DEFAULT_TURN_SECONDS}s / turn
                </button>
              </div>
            </div>

            <Button
              size="lg"
              disabled={!effectiveName || creating}
              onClick={onCreate}
              className="bg-indigo-500 hover:bg-indigo-400 text-white font-semibold"
            >
              {creating ? "Creating…" : "Create a Match"}
            </Button>
          </div>
        ) : (
          <div className="text-center text-white/60">Loading…</div>
        )}
      </div>
    </div>
  );
}
