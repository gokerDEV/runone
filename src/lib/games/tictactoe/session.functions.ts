import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { mongo } from "@/lib/mongo/data-api.server";
import { pusherTrigger } from "@/lib/realtime/pusher.server";
import { applyMove, emptyState, isDraw } from "./engine";
import {
  DEFAULT_TURN_SECONDS,
  INVITE_LINK_TTL_MINUTES,
  MAX_TIMEOUTS_BEFORE_LOSS,
  type GameSession,
  type PlayerRole,
} from "./types";

const COLLECTION = "sessions";

const NicknameSchema = z.string().trim().min(1).max(24);
const UserIdSchema = z.string().min(8).max(64);
const SessionIdSchema = z.string().min(8).max(64);

function newSessionId(): string {
  // 11 chars, URL-safe enough.
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 7);
}

function roleOf(session: GameSession, localUserId: string): PlayerRole | "spectator" | "open" {
  if (session.host.localUserId === localUserId) return "host";
  if (session.player?.localUserId === localUserId) return "player";
  if (!session.player) return "open";
  return "spectator";
}

async function loadSession(id: string): Promise<GameSession> {
  const { document } = await mongo.findOne<GameSession>(COLLECTION, { _id: id });
  if (!document) throw new Error("Session not found");
  return document;
}

async function publishUpdate(session: GameSession) {
  await pusherTrigger(`game-${session._id}`, "state:update", { session });
}

export const createSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        nickname: NicknameSchema,
        localUserId: UserIdSchema,
        timingMode: z.enum(["untimed", "timed"]),
        turnSeconds: z.number().int().min(5).max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_LINK_TTL_MINUTES * 60_000);
    const session: GameSession = {
      _id: newSessionId(),
      gameId: "tic-tac-toe",
      status: "created",
      host: { localUserId: data.localUserId, nickname: data.nickname },
      settings: {
        timingMode: data.timingMode,
        turnSeconds: data.timingMode === "timed" ? data.turnSeconds ?? DEFAULT_TURN_SECONDS : undefined,
      },
      state: emptyState(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      updatedAt: now.toISOString(),
    };
    await mongo.insertOne(COLLECTION, session);
    return { sessionId: session._id };
  });

export const getSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: SessionIdSchema, localUserId: UserIdSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { document } = await mongo.findOne<GameSession>(COLLECTION, { _id: data.sessionId });
    if (!document) return { session: null, role: "missing" as const };
    const expired = new Date(document.expiresAt).getTime() < Date.now() && document.status !== "finished";
    if (expired && document.status !== "expired") {
      return { session: { ...document, status: "expired" as const }, role: "expired" as const };
    }
    return { session: document, role: roleOf(document, data.localUserId) };
  });

export const joinSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: SessionIdSchema,
        localUserId: UserIdSchema,
        nickname: NicknameSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const existing = await loadSession(data.sessionId);
    if (existing.host.localUserId === data.localUserId) {
      return { session: existing, role: "host" as const };
    }
    if (existing.player) {
      if (existing.player.localUserId === data.localUserId) {
        return { session: existing, role: "player" as const };
      }
      return { session: existing, role: "full" as const };
    }
    if (existing.status === "finished" || existing.status === "expired") {
      return { session: existing, role: "closed" as const };
    }
    const now = new Date().toISOString();
    const { document } = await mongo.findOneAndUpdate<GameSession>(
      COLLECTION,
      { _id: data.sessionId, player: { $exists: false } },
      {
        $set: {
          player: { localUserId: data.localUserId, nickname: data.nickname },
          status: "playing",
          startedAt: now,
          updatedAt: now,
        },
      },
      { returnNewDocument: true },
    );
    if (!document) {
      const refreshed = await loadSession(data.sessionId);
      const role =
        refreshed.player?.localUserId === data.localUserId ? ("player" as const) : ("full" as const);
      return { session: refreshed, role };
    }
    await pusherTrigger(`game-${document._id}`, "player:joined", { session: document });
    return { session: document, role: "player" as const };
  });

export const playMove = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: SessionIdSchema,
        localUserId: UserIdSchema,
        cellIndex: z.number().int().min(0).max(8),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const session = await loadSession(data.sessionId);
    if (session.status !== "playing" && session.status !== "joined") {
      throw new Error("Game is not in progress");
    }
    const role = roleOf(session, data.localUserId);
    if (role !== "host" && role !== "player") throw new Error("Not a participant");

    const nextState = applyMove(session.state, role, data.cellIndex);
    const now = new Date().toISOString();
    let status = session.status;
    let result = session.result;
    let finishedAt = session.finishedAt;
    if (nextState.winningLine) {
      status = "finished";
      finishedAt = now;
      result = {
        winnerRole: role,
        loserRole: role === "host" ? "player" : "host",
        reason: "win",
        winningLine: nextState.winningLine,
      };
    } else if (isDraw(nextState)) {
      status = "finished";
      finishedAt = now;
      result = { reason: "draw" };
    } else if (status === "joined") {
      status = "playing";
    }

    const updated: GameSession = {
      ...session,
      state: nextState,
      status,
      result,
      finishedAt,
      updatedAt: now,
    };
    await mongo.updateOne(COLLECTION, { _id: session._id }, { $set: {
      state: updated.state,
      status: updated.status,
      result: updated.result ?? null,
      finishedAt: updated.finishedAt ?? null,
      updatedAt: updated.updatedAt,
    } });

    await publishUpdate(updated);
    if (status === "finished") {
      await pusherTrigger(`game-${session._id}`, "game:finished", { session: updated });
    }
    return { session: updated };
  });

export const forfeitSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: SessionIdSchema, localUserId: UserIdSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const session = await loadSession(data.sessionId);
    if (session.status === "finished" || session.status === "expired") {
      return { session };
    }
    const role = roleOf(session, data.localUserId);
    if (role !== "host" && role !== "player") throw new Error("Not a participant");
    const winner: PlayerRole = role === "host" ? "player" : "host";
    const now = new Date().toISOString();
    const updated: GameSession = {
      ...session,
      status: "finished",
      finishedAt: now,
      updatedAt: now,
      result: { winnerRole: winner, loserRole: role, reason: "forfeit" },
    };
    await mongo.updateOne(COLLECTION, { _id: session._id }, { $set: {
      status: updated.status,
      result: updated.result,
      finishedAt: updated.finishedAt,
      updatedAt: updated.updatedAt,
    } });
    await publishUpdate(updated);
    await pusherTrigger(`game-${session._id}`, "game:finished", { session: updated });
    return { session: updated };
  });

export const tickTimeout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ sessionId: SessionIdSchema, localUserId: UserIdSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const session = await loadSession(data.sessionId);
    if (session.settings.timingMode !== "timed") return { session };
    if (session.status !== "playing" && session.status !== "joined") return { session };
    const role = roleOf(session, data.localUserId);
    if (role !== "host" && role !== "player") throw new Error("Not a participant");
    // Only the player whose turn it is can register a timeout.
    if (session.state.currentTurn !== role) return { session };

    const now = new Date().toISOString();
    const hostTimeouts = session.state.hostTimeouts + (role === "host" ? 1 : 0);
    const playerTimeouts = session.state.playerTimeouts + (role === "player" ? 1 : 0);
    const nextState = {
      ...session.state,
      hostTimeouts,
      playerTimeouts,
      currentTurn: role === "host" ? ("player" as const) : ("host" as const),
    };

    let status = session.status;
    let result = session.result;
    let finishedAt = session.finishedAt;
    if (hostTimeouts >= MAX_TIMEOUTS_BEFORE_LOSS) {
      status = "finished";
      finishedAt = now;
      result = { winnerRole: "player", loserRole: "host", reason: "timeout" };
    } else if (playerTimeouts >= MAX_TIMEOUTS_BEFORE_LOSS) {
      status = "finished";
      finishedAt = now;
      result = { winnerRole: "host", loserRole: "player", reason: "timeout" };
    }

    const updated: GameSession = {
      ...session,
      state: nextState,
      status,
      result,
      finishedAt,
      updatedAt: now,
    };
    await mongo.updateOne(COLLECTION, { _id: session._id }, { $set: {
      state: updated.state,
      status: updated.status,
      result: updated.result ?? null,
      finishedAt: updated.finishedAt ?? null,
      updatedAt: updated.updatedAt,
    } });
    await publishUpdate(updated);
    if (status === "finished") {
      await pusherTrigger(`game-${session._id}`, "game:finished", { session: updated });
    }
    return { session: updated };
  });
