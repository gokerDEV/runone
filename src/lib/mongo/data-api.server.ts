// Atlas Data API HTTPS client (works on Cloudflare Workers).
// All env reads happen per-call so module-scope undefined doesn't bite us.

type Json = unknown;

function cfg() {
  const url = process.env.MONGODB_DATA_API_URL;
  const key = process.env.MONGODB_DATA_API_KEY;
  const dataSource = process.env.MONGODB_DATA_SOURCE;
  const database = process.env.MONGODB_DB;
  if (!url || !key || !dataSource || !database) {
    throw new Error("MongoDB Data API env not configured");
  }
  return { url: url.replace(/\/$/, ""), key, dataSource, database };
}

async function call<T = Json>(action: string, payload: Record<string, unknown>): Promise<T> {
  const c = cfg();
  const res = await fetch(`${c.url}/action/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": c.key,
      Accept: "application/json",
    },
    body: JSON.stringify({
      dataSource: c.dataSource,
      database: c.database,
      ...payload,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Data API ${action} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export const mongo = {
  insertOne: <T extends Record<string, unknown>>(collection: string, document: T) =>
    call<{ insertedId: string }>("insertOne", { collection, document }),
  findOne: <T = Record<string, unknown>>(collection: string, filter: Record<string, unknown>) =>
    call<{ document: T | null }>("findOne", { collection, filter }),
  updateOne: (
    collection: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: { upsert?: boolean } = {},
  ) =>
    call<{ matchedCount: number; modifiedCount: number; upsertedId?: string }>("updateOne", {
      collection,
      filter,
      update,
      upsert: options.upsert ?? false,
    }),
  findOneAndUpdate: <T = Record<string, unknown>>(
    collection: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: { returnNewDocument?: boolean; upsert?: boolean } = {},
  ) =>
    call<{ document: T | null }>("findOneAndUpdate", {
      collection,
      filter,
      update,
      returnNewDocument: options.returnNewDocument ?? true,
      upsert: options.upsert ?? false,
    }),
};
