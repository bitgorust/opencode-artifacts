import { createServer, type ServerResponse } from "node:http";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
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

const LIVE_RELOAD_SNIPPET = `<script>(function(){try{var es=new EventSource("/__sse");es.addEventListener("reload",function(){location.reload()});}catch(e){}})();</script>`;

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
};

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
