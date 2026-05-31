import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/realtime-config")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.PUSHER_KEY;
        const cluster = process.env.PUSHER_CLUSTER;
        if (!key || !cluster) {
          return new Response("Realtime not configured", { status: 500 });
        }
        return Response.json(
          { key, cluster },
          { headers: { "cache-control": "public, max-age=300" } },
        );
      },
    },
  },
});
