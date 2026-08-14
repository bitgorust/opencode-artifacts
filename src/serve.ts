import { createServer, type ServerResponse, type IncomingMessage } from "node:http";
import { watch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { NAME_RE, prepareServedHtml } from "./served-html.ts";

export { NAME_RE } from "./served-html.ts";

export interface ServeOptions {
  dir: string;
  port?: number;
  liveReload?: boolean;
}

export interface ServedArtifacts {
  url: string;
  port: number;
  close(): Promise<void>;
}

const MAX_STATE_BODY_BYTES = 64 * 1024;
const MAX_DB_DOC_BYTES = 256 * 1024;
const STATE_SLUG_RE = NAME_RE;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
};

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        rejectPromise(new Error("state body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", rejectPromise);
  });
}

async function readState(root: string, slug: string): Promise<Record<string, string>> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(join(root, ".state", `${slug}.json`), "utf8"),
    );
    if (typeof parsed === "object" && parsed !== null && "answers" in parsed) {
      const answers = (parsed as { answers: unknown }).answers;
      if (typeof answers === "object" && answers !== null) {
        return answers as Record<string, string>;
      }
    }
    return {};
  } catch {
    return {};
  }
}

async function writeState(
  root: string,
  slug: string,
  answers: Record<string, string>,
): Promise<void> {
  const dir = join(root, ".state");
  await mkdir(dir, { recursive: true });
  const payload = { answers, updatedAt: new Date().toISOString() };
  await writeFile(join(dir, `${slug}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export interface CommentThread {
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

async function readThreads(root: string, slug: string): Promise<CommentThread[]> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(join(root, ".state", `${slug}.comments.json`), "utf8"),
    );
    if (typeof parsed === "object" && parsed !== null && "threads" in parsed) {
      const threads = (parsed as { threads: unknown }).threads;
      if (Array.isArray(threads)) return threads.filter(isThread);
    }
    return [];
  } catch {
    return [];
  }
}

async function writeThreads(root: string, slug: string, threads: CommentThread[]): Promise<void> {
  const dir = join(root, ".state");
  await mkdir(dir, { recursive: true });
  const payload = { threads, updatedAt: new Date().toISOString() };
  await writeFile(join(dir, `${slug}.comments.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

const MAX_THREADS = 200;

export type DocStore = { docs: Record<string, unknown> };

export async function readCollection(
  root: string,
  slug: string,
  collection: string,
): Promise<DocStore> {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(join(root, ".db", slug, `${collection}.json`), "utf8"),
    );
    if (typeof parsed === "object" && parsed !== null && "docs" in parsed) {
      const docs = (parsed as { docs: unknown }).docs;
      if (typeof docs === "object" && docs !== null) return { docs: docs as Record<string, unknown> };
    }
    return { docs: {} };
  } catch {
    return { docs: {} };
  }
}

export async function writeCollection(
  root: string,
  slug: string,
  collection: string,
  store: DocStore,
): Promise<void> {
  const dir = join(root, ".db", slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${collection}.json`), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

interface DataSource {
  name: string;
  command: string;
  args?: string[];
}

const dataCache = new Map<string, { at: number; payload: string }>();
const DATA_CACHE_MS = 5000;

async function runDataSource(
  root: string,
  slug: string,
  name: string,
): Promise<{ status: number; body: string }> {
  let sources: DataSource[];
  try {
    const parsed: unknown = JSON.parse(
      await readFile(join(root, ".datasources", `${slug}.json`), "utf8"),
    );
    sources = Array.isArray(parsed) ? (parsed as DataSource[]) : [];
  } catch {
    return { status: 404, body: JSON.stringify({ error: "no datasources for artifact" }) };
  }
  const source = sources.find((s) => s.name === name);
  if (!source) return { status: 404, body: JSON.stringify({ error: `unknown datasource '${name}'` }) };

  const cacheKey = `${slug}/${name}`;
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.at < DATA_CACHE_MS) {
    return { status: 200, body: cached.payload };
  }

  const { execFile } = await import("node:child_process");
  const output = await new Promise<string>((resolveRun, rejectRun) => {
    execFile(
      source.command,
      source.args ?? [],
      { timeout: 5000, maxBuffer: 256 * 1024 },
      (error, stdout) => {
        if (error) rejectRun(error);
        else resolveRun(stdout);
      },
    );
  }).catch((err: unknown) => {
    return `__ERROR__:${err instanceof Error ? err.message : String(err)}`;
  });

  const payload = output.startsWith("__ERROR__:")
    ? JSON.stringify({ name, error: output.slice("__ERROR__:".length) })
    : JSON.stringify({ name, output, fetchedAt: new Date().toISOString() });
  const status = output.startsWith("__ERROR__:") ? 502 : 200;
  if (status === 200) dataCache.set(cacheKey, { at: Date.now(), payload });
  return { status, body: payload };
}

export async function serveArtifacts(options: ServeOptions): Promise<ServedArtifacts> {
  const root = resolve(options.dir);
  const liveReload = options.liveReload ?? true;
  const clients = new Set<ServerResponse>();

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/__sse") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write("retry: 500\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (url.pathname.startsWith("/__data/")) {
      const rest = decodeURIComponent(url.pathname.slice("/__data/".length));
      const [slug, name] = rest.split("/");
      if (!slug || !name || !NAME_RE.test(slug) || !NAME_RE.test(name)) {
        res.writeHead(400);
        res.end("bad datasource path");
        return;
      }
      void (async () => {
        const result = await runDataSource(root, slug, name);
        res.writeHead(result.status, { "content-type": "application/json; charset=utf-8" });
        res.end(result.body);
      })();
      return;
    }

    if (url.pathname.startsWith("/__db/")) {
      const segments = decodeURIComponent(url.pathname.slice("/__db/".length)).split("/");
      const [slug, collection, id] = segments;
      if (
        !slug ||
        !collection ||
        !NAME_RE.test(slug) ||
        !NAME_RE.test(collection) ||
        (id !== undefined && !NAME_RE.test(id)) ||
        segments.length > 3
      ) {
        res.writeHead(400);
        res.end("bad db path");
        return;
      }
      void (async () => {
        try {
          const store = await readCollection(root, slug, collection);
          if (req.method === "GET" && id === undefined) {
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
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(
              JSON.stringify({
                docs: page.map(([docId, doc]) => ({ id: docId, doc })),
                next_cursor: next,
              }),
            );
            return;
          }
          if (req.method === "GET" && id !== undefined) {
            if (!(id in store.docs)) {
              res.writeHead(404);
              res.end("not found");
              return;
            }
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ id, doc: store.docs[id] }));
            return;
          }
          if (req.method === "PUT" && id !== undefined) {
            const doc: unknown = JSON.parse(await readBody(req, MAX_DB_DOC_BYTES));
            store.docs[id] = doc;
            await writeCollection(root, slug, collection, store);
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ id, doc }));
            return;
          }
          if (req.method === "DELETE" && id !== undefined) {
            delete store.docs[id];
            await writeCollection(root, slug, collection, store);
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ deleted: id }));
            return;
          }
          res.writeHead(405);
          res.end("method not allowed");
        } catch {
          res.writeHead(400);
          res.end("bad request");
        }
      })();
      return;
    }

    if (url.pathname.startsWith("/__comments/")) {
      const slug = decodeURIComponent(url.pathname.slice("/__comments/".length));
      if (!STATE_SLUG_RE.test(slug)) {
        res.writeHead(400);
        res.end("bad slug");
        return;
      }
      void (async () => {
        try {
          if (req.method === "GET") {
            const threads = await readThreads(root, slug);
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ threads }));
            return;
          }
          if (req.method === "POST") {
            const body: unknown = JSON.parse(await readBody(req, MAX_STATE_BODY_BYTES * 4));
            const threads =
              typeof body === "object" && body !== null
                ? (body as Record<string, unknown>)["threads"]
                : undefined;
            if (!Array.isArray(threads) || !threads.every(isThread) || threads.length > MAX_THREADS) {
              res.writeHead(400);
              res.end("expected {threads: CommentThread[]} within limits");
              return;
            }
            await writeThreads(root, slug, threads);
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ threads }));
            return;
          }
          res.writeHead(405);
          res.end("method not allowed");
        } catch {
          res.writeHead(400);
          res.end("bad request");
        }
      })();
      return;
    }

    if (url.pathname.startsWith("/__state/")) {
      const slug = decodeURIComponent(url.pathname.slice("/__state/".length));
      if (!STATE_SLUG_RE.test(slug)) {
        res.writeHead(400);
        res.end("bad slug");
        return;
      }
      void (async () => {
        try {
          if (req.method === "GET") {
            const answers = await readState(root, slug);
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ answers }));
            return;
          }
          if (req.method === "POST") {
            const body: unknown = JSON.parse(await readBody(req, MAX_STATE_BODY_BYTES));
            const record =
              typeof body === "object" && body !== null
                ? (body as Record<string, unknown>)
                : undefined;
            const fullAnswers = record?.["answers"];
            if (
              typeof fullAnswers === "object" &&
              fullAnswers !== null &&
              Object.values(fullAnswers).every((v) => typeof v === "string")
            ) {
              await writeState(root, slug, fullAnswers as Record<string, string>);
              res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ answers: fullAnswers }));
              return;
            }
            const question = record?.["question"];
            const option = record?.["option"];
            if (typeof question !== "string" || typeof option !== "string") {
              res.writeHead(400);
              res.end("expected {answers} or {question, option}");
              return;
            }
            const answers = await readState(root, slug);
            answers[question] = option;
            await writeState(root, slug, answers);
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ answers }));
            return;
          }
          res.writeHead(405);
          res.end("method not allowed");
        } catch {
          res.writeHead(400);
          res.end("bad request");
        }
      })();
      return;
    }

    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = normalize(join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }

    void (async () => {
      try {
        const body = await readFile(filePath);
        const type = CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
        let payload: Buffer | string = body;
        if (liveReload && extname(filePath) === ".html") {
          payload = prepareServedHtml(body.toString("utf8"));
        }
        res.writeHead(200, { "content-type": type });
        res.end(payload);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    })();
  });

  let watcher: ReturnType<typeof watch> | undefined;
  if (liveReload) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    watcher = watch(root, (_event, filename) => {
      if (!filename || !filename.endsWith(".html")) return;
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        for (const client of clients) {
          client.write("event: reload\ndata: {}\n\n");
        }
      }, 80);
    });
  }

  await new Promise<void>((ready) => {
    server.listen(options.port ?? 0, "127.0.0.1", ready);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : (options.port ?? 0);

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: () =>
      new Promise<void>((done) => {
        watcher?.close();
        for (const client of clients) client.end();
        server.close(() => done());
      }),
  };
}
