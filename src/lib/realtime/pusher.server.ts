// Fetch-based Pusher REST trigger — avoids node-only deps in the Worker.
import { createHash, createHmac } from "node:crypto";

function cfg() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!appId || !key || !secret || !cluster) {
    console.warn("Pusher env not configured. Pusher triggers will be ignored.");
    return null;
  }
  return { appId, key, secret, cluster };
}

export async function pusherTrigger(channel: string, event: string, data: unknown) {
  const config = cfg();
  if (!config) {
    console.warn("Config not found");
    return
  };
  const { appId, key, secret, cluster } = config;
  const body = JSON.stringify({
    name: event,
    channel,
    data: JSON.stringify(data),
  });
  const bodyMd5 = createHash("md5").update(body).digest("hex");
  const timestamp = Math.floor(Date.now() / 1000);
  const path = `/apps/${appId}/events`;
  const params = `auth_key=${key}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`;
  const stringToSign = `POST\n${path}\n${params}`;
  const signature = createHmac("sha256", secret).update(stringToSign).digest("hex");
  const url = `https://api-${cluster}.pusher.com${path}?${params}&auth_signature=${signature}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Pusher trigger failed (${res.status}): ${text}`);
  }
}
