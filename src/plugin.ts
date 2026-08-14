import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tool, type Plugin } from "@opencode-ai/plugin";
import {
  ArtifactTooLargeError,
  renderArtifact,
  renderRawHtml,
  type RenderedArtifact,
} from "./render.ts";
import { FilePublisher, slugify, StaleArtifactError } from "./publisher.ts";
import { GitHubPagesPublisher } from "./github-pages.ts";
import { CloudflarePublisher } from "./cloudflare-publisher.ts";
import { formatFindings, scanSensitive } from "./guard.ts";
import { readCollection, writeCollection } from "./serve.ts";
import { openFile } from "./open.ts";

function ghPagesCloneDir(repo: string): string {
  return join(homedir(), ".cache", "opencode-artifacts", "ghpages", repo.replace("/", "__"));
}

function cfStagingDir(workerName: string): string {
  return join(homedir(), ".cache", "opencode-artifacts", "cloudflare", workerName);
}

export const ArtifactsPlugin: Plugin = async () => {
  return {
    tool: {
      artifact_publish: tool({
        description: [
          "Render a Markdown document into a single self-contained interactive HTML artifact",
          "under .opencode/artifacts/ and return its path. The Markdown may carry frontmatter",
          "(title:, icon:) and fenced chart spec blocks (```vega-lite, ```vega, ```echarts).",
          "Use it for dashboards, PR walkthroughs, incident timelines, comparisons - anything",
          "easier to see as a page than to read as terminal text. Republish with the same title",
          "to update the page in place; pass version:true to keep numbered history.",
        ].join(" "),
        args: {
          markdown: tool.schema.string().describe("Full Markdown source of the artifact page"),
          title: tool.schema.string().optional().describe("Title override; defaults to frontmatter title"),
          open: tool.schema.boolean().optional().describe("Open the artifact in the system browser"),
          version: tool.schema
            .boolean()
            .optional()
            .describe("Also keep a numbered version file next to the stable path"),
          format: tool.schema
            .enum(["markdown", "html"])
            .optional()
            .describe("'html' embeds the input as raw trusted HTML instead of rendering Markdown"),
          expectedHash: tool.schema
            .string()
            .optional()
            .describe(
              "Hash from a previous publish result; publishing fails with a conflict if the artifact changed since",
            ),
          force: tool.schema
            .boolean()
            .optional()
            .describe("Publish even when the sensitive-content scan finds credential-looking strings"),
          dataSources: tool.schema
            .array(
              tool.schema.object({
                name: tool.schema.string(),
                command: tool.schema.string(),
                args: tool.schema.array(tool.schema.string()).optional(),
              }),
            )
            .optional()
            .describe(
              "Named read-only shell commands the served page may poll via opencodeArtifacts.data(name) (raw-HTML pages)",
            ),
          deploy: tool.schema
            .boolean()
            .optional()
            .describe("Also push the artifact to a hosted site (requires repo or workerName)"),
          repo: tool.schema
            .string()
            .optional()
            .describe("GitHub Pages target as owner/name; created public if missing"),
          target: tool.schema
            .enum(["github", "cloudflare"])
            .optional()
            .describe("Deploy target; defaults to github when repo is set"),
          workerName: tool.schema
            .string()
            .optional()
            .describe("Cloudflare Worker name (target cloudflare)"),
        },
        async execute(args, ctx) {
          try {
            const rendered: RenderedArtifact =
              args.format === "html"
                ? renderRawHtml(args.markdown, args.title ? { title: args.title } : {})
                : renderArtifact(args.markdown);
            const title = args.title ?? rendered.meta.title ?? "Artifact";
            const slug = slugify(title);

            const findings = scanSensitive(args.markdown);
            if (findings.length > 0 && args.force !== true) {
              return `Publish blocked: the content contains credential-looking strings: ${formatFindings(findings)}. If these are intentional (e.g. redacted examples), call again with force: true.`;
            }

            await ctx.ask({
              permission: "artifact_publish",
              patterns: [slug],
              always: ["*"],
              metadata: { title, slug },
            });

            const localDir = join(ctx.worktree, ".opencode", "artifacts");
            const publisher = (() => {
              if (!args.deploy) return new FilePublisher(localDir);
              const target = args.target ?? (args.repo ? "github" : undefined);
              if (target === "github" && args.repo) {
                return new GitHubPagesPublisher(localDir, {
                  repo: args.repo,
                  cloneDir: ghPagesCloneDir(args.repo),
                });
              }
              if (target === "cloudflare" && args.workerName) {
                return new CloudflarePublisher(localDir, {
                  workerName: args.workerName,
                  stagingDir: cfStagingDir(args.workerName),
                });
              }
              throw new Error(
                "deploy requires repo (github) or target: 'cloudflare' with workerName",
              );
            })();
            const result = await publisher.publish({
              slug,
              html: rendered.html,
              title,
              icon: rendered.meta.icon,
              description: rendered.meta.description,
              charts: rendered.chartCount,
              version: args.version ?? false,
              expectedHash: args.expectedHash,
            });
            if (args.open) openFile(result.path);
            if (args.dataSources && args.dataSources.length > 0) {
              const registryDir = join(ctx.worktree, ".opencode", "artifacts", ".datasources");
              await mkdir(registryDir, { recursive: true });
              await writeFile(
                join(registryDir, `${slug}.json`),
                `${JSON.stringify(args.dataSources, null, 2)}\n`,
                "utf8",
              );
            }
            ctx.metadata({
              title: `Artifact: ${title}`,
              metadata: {
                path: result.path,
                version: result.version,
                gallery: result.gallery,
                charts: rendered.chartCount,
                hash: result.hash,
              },
            });
            return `Artifact published to ${result.path}${result.url ? ` — live at ${result.url}` : ""} (gallery: ${result.gallery}, hash: ${result.hash})`;
          } catch (err) {
            if (err instanceof ArtifactTooLargeError) {
              return `Artifact too large: ${err.message}`;
            }
            if (err instanceof StaleArtifactError) {
              return `Publish refused: ${err.message}. Re-read the current page and re-apply your edits, then publish again with the new hash.`;
            }
            throw err;
          }
        },
      }),
      artifact_db: tool({
        description: [
          "Read or write an artifact's shared mini-database (collections of JSON documents,",
          "stored under .opencode/artifacts/.db/). Mirrors what the served page can do through",
          "the opencodeArtifacts.db bridge.",
        ].join(" "),
        args: {
          slug: tool.schema.string(),
          collection: tool.schema.string(),
          op: tool.schema.enum(["get", "list", "set", "delete"]),
          id: tool.schema.string().optional().describe("Document id (required for get/set/delete)"),
          doc: tool.schema.unknown().optional().describe("Document body for set"),
          q: tool.schema
            .string()
            .optional()
            .describe("Equality filter for list, as field:value"),
        },
        async execute(args, ctx) {
          const root = join(ctx.worktree, ".opencode", "artifacts");
          const store = await readCollection(root, args.slug, args.collection);
          switch (args.op) {
            case "get": {
              if (!args.id) return "get requires id";
              return args.id in store.docs
                ? JSON.stringify({ id: args.id, doc: store.docs[args.id] }, null, 2)
                : `No document '${args.id}' in ${args.slug}/${args.collection}.`;
            }
            case "list": {
              let entries = Object.entries(store.docs);
              if (args.q) {
                const [field, ...rest] = args.q.split(":");
                const want = rest.join(":");
                entries = entries.filter(
                  ([, doc]) =>
                    typeof doc === "object" &&
                    doc !== null &&
                    String((doc as Record<string, unknown>)[field]) === want,
                );
              }
              return JSON.stringify(
                entries.map(([id, doc]) => ({ id, doc })),
                null,
                2,
              );
            }
            case "set": {
              if (!args.id) return "set requires id";
              store.docs[args.id] = args.doc ?? null;
              await writeCollection(root, args.slug, args.collection, store);
              return `Wrote ${args.slug}/${args.collection}/${args.id}.`;
            }
            case "delete": {
              if (!args.id) return "delete requires id";
              delete store.docs[args.id];
              await writeCollection(root, args.slug, args.collection, store);
              return `Deleted ${args.slug}/${args.collection}/${args.id}.`;
            }
          }
        },
      }),
      artifact_state: tool({
        description:
          "Read the saved decision/state of an artifact published in this worktree (answers a reader gave on the served page, e.g. workshop decisions).",
        args: {
          slug: tool.schema.string().describe("Artifact slug (the filename without .html)"),
        },
        async execute(args, ctx) {
          const statePath = join(
            ctx.worktree,
            ".opencode",
            "artifacts",
            ".state",
            `${args.slug}.json`,
          );
          try {
            return await readFile(statePath, "utf8");
          } catch {
            return `No saved state for artifact '${args.slug}'.`;
          }
        },
      }),
      artifact_comments: tool({
        description:
          "Read comment threads a reader left on a served artifact page, or resolve a thread after acting on it.",
        args: {
          slug: tool.schema.string().describe("Artifact slug (the filename without .html)"),
          resolveId: tool.schema
            .string()
            .optional()
            .describe("Thread id to mark resolved after you have acted on it"),
        },
        async execute(args, ctx) {
          const threadsPath = join(
            ctx.worktree,
            ".opencode",
            "artifacts",
            ".state",
            `${args.slug}.comments.json`,
          );
          let parsed: { threads?: Array<Record<string, unknown>> };
          try {
            parsed = JSON.parse(await readFile(threadsPath, "utf8")) as typeof parsed;
          } catch {
            return `No comments for artifact '${args.slug}'.`;
          }
          const threads = Array.isArray(parsed.threads) ? parsed.threads : [];
          if (args.resolveId !== undefined) {
            const target = threads.find((t) => t["id"] === args.resolveId);
            if (!target) return `No comment thread '${args.resolveId}' on '${args.slug}'.`;
            target["resolved"] = true;
            await writeFile(threadsPath, `${JSON.stringify({ ...parsed, threads }, null, 2)}\n`, "utf8");
            return `Resolved thread ${args.resolveId} on '${args.slug}'.`;
          }
          return JSON.stringify(threads, null, 2);
        },
      }),
    },
  };
};

export default ArtifactsPlugin;
