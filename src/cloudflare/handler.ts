import { NAME_RE } from "../served-html.ts";

export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface CommentThread {
  id: string;
  quote: string;
  text: string;
  createdAt: string;
  resolved: boolean;
}

function isThread(value: unknown): value is CommentThread {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    typeof record["quote"] === "string" &&
    typeof record["text"] === "string" &&
    typeof record["resolved"] === "boolean"
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readJson<T>(kv: KVStore, key: string, fallback: T): Promise<T> {
  const raw = await kv.get(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function handleState(slug: string, request: Request, kv: KVStore): Promise<Response> {
  const key = `state:${slug}`;
  if (request.method === "GET") {
    const stored = await readJson(kv, key, { answers: {} as Record<string, string> });
    return json({ answers: stored.answers });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const fullAnswers = body["answers"];
  if (
    typeof fullAnswers === "object" &&
    fullAnswers !== null &&
    Object.values(fullAnswers).every((v) => typeof v === "string")
  ) {
    const answers = fullAnswers as Record<string, string>;
    await kv.put(key, JSON.stringify({ answers, updatedAt: new Date().toISOString() }));
    return json({ answers });
  }
  const question = body["question"];
  const option = body["option"];
  if (typeof question !== "string" || typeof option !== "string") {
    return json({ error: "expected {answers} or {question, option}" }, 400);
  }
  const stored = await readJson(kv, key, { answers: {} as Record<string, string> });
  stored.answers[question] = option;
  await kv.put(key, JSON.stringify(stored));
  return json({ answers: stored.answers });
}

async function handleComments(slug: string, request: Request, kv: KVStore): Promise<Response> {
  const key = `comments:${slug}`;
  if (request.method === "GET") {
    const stored = await readJson(kv, key, { threads: [] as CommentThread[] });
    return json({ threads: stored.threads });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const threads = body["threads"];
  if (!Array.isArray(threads) || !threads.every(isThread) || threads.length > 200) {
    return json({ error: "expected {threads: CommentThread[]} within limits" }, 400);
  }
  await kv.put(key, JSON.stringify({ threads, updatedAt: new Date().toISOString() }));
  return json({ threads });
}

async function handleDb(
  slug: string,
  collection: string,
  id: string | undefined,
  request: Request,
  url: URL,
  kv: KVStore,
): Promise<Response> {
  const key = `db:${slug}:${collection}`;
  const store = await readJson(kv, key, { docs: {} as Record<string, unknown> });

  if (request.method === "GET" && id === undefined) {
    const q = url.searchParams.get("q");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50") || 50, 200);
    const cursor = Number(url.searchParams.get("cursor") ?? "0") || 0;
    let entries = Object.entries(store.docs);
    if (q) {
      const [field, ...rest] = q.split(":");
      const want = rest.join(":");
      entries = entries.filter(([, doc]) => {
        if (typeof doc !== "object" || doc === null) return false;
        return String((doc as Record<string, unknown>)[field]) === want;
      });
    }
    const page = entries.slice(cursor, cursor + limit);
    const next = cursor + limit < entries.length ? String(cursor + limit) : null;
    return json({ docs: page.map(([docId, doc]) => ({ id: docId, doc })), next_cursor: next });
  }
  if (request.method === "GET" && id !== undefined) {
    return id in store.docs ? json({ id, doc: store.docs[id] }) : json({ error: "not found" }, 404);
  }
  if (request.method === "PUT" && id !== undefined) {
    const doc: unknown = await request.json();
    store.docs[id] = doc;
    await kv.put(key, JSON.stringify(store));
    return json({ id, doc });
  }
  if (request.method === "DELETE" && id !== undefined) {
    delete store.docs[id];
    await kv.put(key, JSON.stringify(store));
    return json({ deleted: id });
  }
  return json({ error: "method not allowed" }, 405);
}

export async function handleApiRequest(request: Request, kv: KVStore): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path.startsWith("/__data/")) {
    return json(
      { error: "datasources execute local shell commands and are not available on hosted workers" },
      501,
    );
  }

  const routes: Array<[string, (parts: string[]) => Promise<Response | null>]> = [
    [
      "/__state/",
      async ([slug]) => {
        if (!slug || !NAME_RE.test(slug)) return json({ error: "bad slug" }, 400);
        return handleState(slug, request, kv);
      },
    ],
    [
      "/__comments/",
      async ([slug]) => {
        if (!slug || !NAME_RE.test(slug)) return json({ error: "bad slug" }, 400);
        return handleComments(slug, request, kv);
      },
    ],
    [
      "/__db/",
      async ([slug, collection, id, ...extra]) => {
        if (
          !slug ||
          !collection ||
          !NAME_RE.test(slug) ||
          !NAME_RE.test(collection) ||
          (id !== undefined && !NAME_RE.test(id)) ||
          extra.length > 0
        ) {
          return json({ error: "bad db path" }, 400);
        }
        return handleDb(slug, collection, id, request, url, kv);
      },
    ],
  ];

  for (const [prefix, route] of routes) {
    if (path.startsWith(prefix)) {
      const parts = decodeURIComponent(path.slice(prefix.length)).split("/");
      return route(parts);
    }
  }
  return null;
}
