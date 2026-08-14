import { createServer, type ServerResponse, type IncomingMessage } from "node:http";
import { watch } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

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

const LIVE_RELOAD_SNIPPET = `<script>window.__ARTIFACT_STATE_URL__="/__state";(function(){try{var es=new EventSource("/__sse");es.addEventListener("reload",function(){location.reload()});}catch(e){}})();</script>`;

const MAX_STATE_BODY_BYTES = 64 * 1024;
const STATE_SLUG_RE = /^[a-z0-9-]+$/;

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
          const text = body.toString("utf8");
          // Live reload needs EventSource; relax connect-src to 'self' for the
          // served copy only. On-disk artifacts keep connect-src 'none'.
          const relaxed = text.replace("connect-src 'none'", "connect-src 'self'");
          const at = relaxed.lastIndexOf("</body>");
          payload =
            at === -1
              ? relaxed + LIVE_RELOAD_SNIPPET
              : relaxed.slice(0, at) + LIVE_RELOAD_SNIPPET + relaxed.slice(at);
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
