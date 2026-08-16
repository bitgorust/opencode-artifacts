import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { tool, type Hooks, type Plugin } from "@opencode-ai/plugin";
import {
  ArtifactTooLargeError,
  renderArtifact,
  renderRawHtml,
  type RenderedArtifact,
} from "./render.ts";
import { FilePublisher, slugify, StaleArtifactError } from "./publisher.ts";
import { GitHubPagesPublisher } from "./github-pages.ts";
import { CloudflarePublisher } from "./cloudflare-publisher.ts";
import { loadConfig, resolveDeploy } from "./config.ts";
import { formatFindings, scanSensitive } from "./guard.ts";
import { NAME_RE, readCollection, writeCollection } from "./serve.ts";
import { openFile } from "./open.ts";
import {
  ArtifactStateError,
  STATE_KEY_RE,
  artifactDocumentHash,
  mutateCollectionDocument,
  readArtifactState,
  replaceArtifactState,
  type CollectionPayload,
  type CommentPayload,
  type DecisionPayload,
} from "./artifact-state.ts";
import {
  ArtifactMigrationRequiredError,
  readArtifactManifestV2,
} from "./artifact-schema.ts";

function ghPagesCloneDir(repo: string): string {
  return join(homedir(), ".cache", "opencode-artifacts", "ghpages", repo.replace("/", "__"));
}

function cfStagingDir(workerName: string): string {
  return join(homedir(), ".cache", "opencode-artifacts", "cloudflare", workerName);
}

function workRoot(ctx: { directory: string; worktree: string }): string {
  return ctx.worktree === "/" ? ctx.directory : ctx.worktree;
}

async function stateArtifactId(root: string, slug: string): Promise<string | undefined> {
  try {
    await lstat(join(root, "manifest.json"));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const manifest = await readArtifactManifestV2(root);
    const artifactId = manifest.slugIndex[slug];
    if (!artifactId) throw new ArtifactStateError("invalid", `unknown artifact slug ${slug}`, 0, "list artifacts and use an active reference");
    return artifactId;
  } catch (error) {
    if (error instanceof ArtifactMigrationRequiredError) return undefined;
    throw error;
  }
}

function stateToolFailure(error: unknown): string {
  if (error instanceof ArtifactStateError) {
    return JSON.stringify({ error: error.code, revision: error.selectedRevision, message: error.message, nextAction: error.nextAction }, null, 2);
  }
  throw error;
}

const PROACTIVE_FALLBACK = `## Artifact pages
You have the artifact_publish tool (opencode-artifacts). A finished deliverable with an
audience — a report, a plan others will follow, a reference document — is not fully delivered
while it lives only in terminal scrollback: publish it as an artifact and hand the user the
path. Publish proactively when output is easier to look at than to read line by line: PR
walkthroughs, dashboards, incident timelines, comparisons, checklists. Do not publish for
quick answers or code snippets. Author in Markdown with frontmatter (title, icon); use
component fences (stats, timeline, findings, compare, callout, progress, diff, copy, mermaid,
decisions) and chart fences (vega-lite, vega, echarts). Republish with the same title to
update in place. Name pages like products: a short noun phrase, no appended explainers.`;

async function proactiveGuidance(): Promise<string> {
  try {
    const path = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "skills",
      "artifact-pages",
      "SKILL.md",
    );
    const raw = await readFile(path, "utf8");
    const body = raw.replace(/^---[\s\S]*?---\s*/, "").trim();
    return body === "" ? PROACTIVE_FALLBACK : body;
  } catch {
    return PROACTIVE_FALLBACK;
  }
}

export const ArtifactsPlugin: Plugin = async (_input, options) => {
  const hooks: Hooks = {
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
          let slug = "artifact";
          try {
            const rendered: RenderedArtifact =
              args.format === "html"
                ? renderRawHtml(args.markdown, args.title ? { title: args.title } : {})
                : renderArtifact(args.markdown);
            const title = args.title ?? rendered.meta.title ?? "Artifact";
            slug = slugify(title);

            const findings = scanSensitive(`${args.markdown}\n${title}`);
            if (findings.length > 0 && args.force !== true) {
              return `Publish blocked: the content contains credential-looking strings: ${formatFindings(findings)}. If these are intentional (e.g. redacted examples), call again with force: true.`;
            }

            await ctx.ask({
              permission: "artifact_publish",
              patterns: [slug],
              always: ["*"],
              metadata: { title, slug },
            });

            const localDir = join(workRoot(ctx), ".opencode", "artifacts");
            const publisher = await (async () => {
              if (!args.deploy) return new FilePublisher(localDir);
              const config = await loadConfig(workRoot(ctx));
              const resolved = resolveDeploy(
                { repo: args.repo, target: args.target, workerName: args.workerName },
                config,
              );
              if (resolved.target === "github" && resolved.repo) {
                return new GitHubPagesPublisher(localDir, {
                  repo: resolved.repo,
                  branch: resolved.branch,
                  cloneDir: ghPagesCloneDir(resolved.repo),
                  allowSensitive: args.force === true,
                });
              }
              if (resolved.target === "cloudflare" && resolved.workerName) {
                return new CloudflarePublisher(localDir, {
                  workerName: resolved.workerName,
                  stagingDir: cfStagingDir(resolved.workerName),
                  allowSensitive: args.force === true,
                });
              }
              throw new Error(
                `deploy target '${resolved.target}' is missing its ${resolved.target === "github" ? "repo" : "workerName"} — run \`opencode-artifacts init\``,
              );
            })();
            const result = await publisher.publish({
              slug,
              html: rendered.html,
              title,
              icon: rendered.meta.icon,
              description: rendered.meta.description,
              source: rendered.meta.source,
              charts: rendered.chartCount,
              version: args.version ?? false,
              expectedHash: args.expectedHash,
            });
            if (args.open) openFile(result.path);
            if (args.dataSources && args.dataSources.length > 0) {
              const registryDir = join(workRoot(ctx), ".opencode", "artifacts", ".datasources");
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
              const currentPath = join(workRoot(ctx), ".opencode", "artifacts", `${slug}.html`);
              let current = "";
              try {
                current = await readFile(currentPath, "utf8");
              } catch {
                current = "(could not read current page)";
              }
              const cap = 16000;
              const bodyAt = current.indexOf("<body");
              const preview =
                current.length <= cap
                  ? current
                  : bodyAt > 0
                    ? `${current.slice(0, 2000)}\n…\n${current.slice(bodyAt, bodyAt + cap)}`
                    : current.slice(0, cap);
              return [
                `Publish refused: ${err.message}.`,
                "The current published content follows — merge your edits onto it, then publish again with the new hash.",
                `[Artifact ${slug} — live version; raw HTML follows]`,
                preview,
                "[End of live content]",
              ].join("\n\n");
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
          expectedRevision: tool.schema.number().optional().describe("Current collection revision for set/delete"),
          expectedDocumentHash: tool.schema.string().optional().describe("Current document SHA-256 for update/delete"),
          createOnly: tool.schema.boolean().optional().describe("Require the document ID to be absent"),
          operationId: tool.schema.string().optional().describe("UUID retained across retries of one mutation"),
        },
        async execute(args, ctx) {
          if (!STATE_KEY_RE.test(args.slug) || !STATE_KEY_RE.test(args.collection) || (args.id !== undefined && !STATE_KEY_RE.test(args.id))) {
            return "slug and collection must be safe lowercase identifiers; document id must follow the same rule";
          }
          const root = join(workRoot(ctx), ".opencode", "artifacts");
          const artifactId = await stateArtifactId(root, args.slug);
          if (artifactId !== undefined) {
            try {
              const envelope = await readArtifactState<CollectionPayload>(root, artifactId, "collection", args.collection);
              if (args.op === "get") {
                if (!args.id) return "get requires id";
                const doc = envelope.payload.docs[args.id];
                return doc === undefined
                  ? `No document '${args.id}' in ${args.slug}/${args.collection}. Current revision: ${envelope.revision}.`
                  : JSON.stringify({ id: args.id, doc, hash: artifactDocumentHash(doc), revision: envelope.revision }, null, 2);
              }
              if (args.op === "list") {
                let entries = Object.entries(envelope.payload.docs);
                if (args.q) {
                  const [field, ...rest] = args.q.split(":");
                  const want = rest.join(":");
                  entries = entries.filter(([, doc]) => typeof doc === "object" && doc !== null && String((doc as Record<string, unknown>)[field]) === want);
                }
                return JSON.stringify({ revision: envelope.revision, contentHash: envelope.contentHash, docs: entries.map(([id, doc]) => ({ id, doc, hash: artifactDocumentHash(doc) })) }, null, 2);
              }
              if (!args.id) return `${args.op} requires id`;
              if (args.expectedRevision === undefined || args.operationId === undefined) {
                return `${args.op} requires expectedRevision and operationId`;
              }
              if (args.createOnly === true && args.expectedDocumentHash !== undefined) {
                return "createOnly and expectedDocumentHash are mutually exclusive";
              }
              const result = await mutateCollectionDocument({
                root,
                artifactId,
                collection: args.collection,
                id: args.id,
                operation: args.op,
                ...(args.op === "set" ? { document: args.doc ?? null } : {}),
                expectedRevision: args.expectedRevision,
                expectedDocumentHash: args.createOnly === true ? null : args.expectedDocumentHash ?? null,
                operationId: args.operationId,
              });
              return JSON.stringify({ status: result.status, revision: result.revision, contentHash: result.contentHash, warnings: result.warnings }, null, 2);
            } catch (error) {
              return stateToolFailure(error);
            }
          }
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
          if (!STATE_KEY_RE.test(args.slug)) return "slug must be a safe lowercase identifier";
          const root = join(workRoot(ctx), ".opencode", "artifacts");
          const artifactId = await stateArtifactId(root, args.slug);
          if (artifactId !== undefined) {
            try {
              const envelope = await readArtifactState<DecisionPayload>(root, artifactId, "decisions");
              return JSON.stringify({ revision: envelope.revision, contentHash: envelope.contentHash, answers: envelope.payload.answers }, null, 2);
            } catch (error) {
              return stateToolFailure(error);
            }
          }
          const statePath = join(
            root,
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
          "Read comment threads a reader left on a served artifact page, or resolve a thread after acting on it. Pass digest: true for a compact triage view (unresolved first, oldest unresolved at top).",
        args: {
          slug: tool.schema.string().describe("Artifact slug (the filename without .html)"),
          resolveId: tool.schema
            .string()
            .optional()
            .describe("Thread id to mark resolved after you have acted on it"),
          digest: tool.schema
            .boolean()
            .optional()
            .describe("Return a compact triage digest instead of raw threads"),
          expectedRevision: tool.schema.number().optional().describe("Current comment-store revision required with resolveId"),
          expectedHash: tool.schema.string().optional().describe("Current comment-store hash required with resolveId"),
          operationId: tool.schema.string().optional().describe("UUID retained across retries of one resolve mutation"),
        },
        async execute(args, ctx) {
          if (!STATE_KEY_RE.test(args.slug)) return "slug must be a safe lowercase identifier";
          const root = join(workRoot(ctx), ".opencode", "artifacts");
          const artifactId = await stateArtifactId(root, args.slug);
          if (artifactId !== undefined) {
            try {
              const envelope = await readArtifactState<CommentPayload>(root, artifactId, "comments");
              const threads = envelope.payload.threads;
              if (args.resolveId !== undefined) {
                if (args.expectedRevision === undefined || args.operationId === undefined) {
                  return "resolveId requires expectedRevision and operationId";
                }
                const target = threads.find((thread) => thread.id === args.resolveId);
                if (!target) return `No comment thread '${args.resolveId}' on '${args.slug}'.`;
                const result = await replaceArtifactState<CommentPayload>({
                  root,
                  artifactId,
                  kind: "comments",
                  expectedRevision: args.expectedRevision,
                  ...(args.expectedHash === undefined ? {} : { expectedHash: args.expectedHash }),
                  operationId: args.operationId,
                  payload: { threads: threads.map((thread) => thread.id === args.resolveId ? { ...thread, resolved: true } : thread) },
                });
                return JSON.stringify({ status: result.status, revision: result.revision, contentHash: result.contentHash }, null, 2);
              }
              if (args.digest === true) {
                const open = threads.filter((thread) => !thread.resolved);
                return [`${open.length} open, ${threads.length - open.length} resolved on '${args.slug}'.`, ...open.map((thread) => `- [${thread.id}] "${thread.quote.slice(0, 60)}" — ${thread.text.slice(0, 120)}`)].join("\n");
              }
              return JSON.stringify({ revision: envelope.revision, contentHash: envelope.contentHash, threads }, null, 2);
            } catch (error) {
              return stateToolFailure(error);
            }
          }
          const threadsPath = join(
            root,
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
          if (args.digest === true) {
            const open = threads.filter((t) => t["resolved"] !== true);
            const resolvedCount = threads.length - open.length;
            const lines = [
              `${open.length} open, ${resolvedCount} resolved on '${args.slug}'.`,
              ...open.map((t) => {
                const ageMin = Math.max(
                  0,
                  Math.round((Date.now() - Date.parse(String(t["createdAt"] ?? ""))) / 60000),
                );
                const age = Number.isNaN(ageMin) ? "?" : `${ageMin}m`;
                return `- [${t["id"]}] (${age} ago) "${String(t["quote"] ?? "").slice(0, 60)}" — ${String(t["text"] ?? "").slice(0, 120)}`;
              }),
            ];
            return lines.join("\n");
          }
          return JSON.stringify(threads, null, 2);
        },
      }),
    },
  };

  if (options?.["proactive"] === true) {
    const guidance = await proactiveGuidance();
    hooks["experimental.chat.system.transform"] = async (_input, output) => {
      output.system.push(guidance);
    };
  }

  return hooks;
};

export default ArtifactsPlugin;
