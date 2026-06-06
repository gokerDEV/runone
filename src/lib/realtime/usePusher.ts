import { useEffect, useRef } from "react";
import PusherClient, { type Channel } from "pusher-js";

let clientPromise: Promise<PusherClient | null> | null = null;

async function getClient(): Promise<PusherClient | null> {
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const res = await fetch("/api/realtime-config");
        if (!res.ok) return null;
        const { key, cluster } = (await res.json()) as { key: string; cluster: string };
        if (!key || key === "your_key" || !cluster || cluster === "your_cluster") return null;
        return new PusherClient(key, { cluster });
      } catch (err) {
        console.warn("Could not initialize Pusher client", err);
        return null;
      }
    })();
  }
  return clientPromise;
}

type Handler = (data: unknown) => void;

export function useChannel(channelName: string | null, handlers: Record<string, Handler>) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!channelName) return;
    let channel: Channel | null = null;
    let cancelled = false;
    const bound: Array<[string, (data: unknown) => void]> = [];

    void getClient().then((client) => {
      if (cancelled || !client) return;
      channel = client.subscribe(channelName);
      for (const eventName of Object.keys(handlersRef.current)) {
        const fn = (data: unknown) => handlersRef.current[eventName]?.(data);
        channel.bind(eventName, fn);
        bound.push([eventName, fn]);
      }
    });

    return () => {
      cancelled = true;
      if (channel) {
        for (const [name, fn] of bound) channel.unbind(name, fn);
        void getClient().then((client) => client?.unsubscribe(channelName));
      }
    };
  }, [channelName]);
}
