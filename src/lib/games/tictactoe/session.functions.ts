// Thin Pusher relay — no DB. Host is authoritative, both peers compute state locally.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pusherTrigger } from "@/lib/realtime/pusher.server";

const RelaySchema = z.object({
  sessionId: z.string().min(4).max(64),
  event: z.enum(["player:hello", "state:update", "game:finished"]),
  payload: z.unknown(),
});

export const relay = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RelaySchema.parse(input))
  .handler(async ({ data }) => {
    await pusherTrigger(`game-${data.sessionId}`, data.event, data.payload);
    return { ok: true };
  });
