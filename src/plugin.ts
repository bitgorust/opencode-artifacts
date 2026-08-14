import { join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tool, type Plugin } from "@opencode-ai/plugin";
import {
  ArtifactTooLargeError,
  renderArtifact,
  renderRawHtml,
  type RenderedArtifact,
} from "./render.ts";
import { FilePublisher, slugify, StaleArtifactError } from "./publisher.ts";
import { formatFindings, scanSensitive } from "./guard.ts";
import { openFile } from "./open.ts";

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

            const publisher = new FilePublisher(join(ctx.worktree, ".opencode", "artifacts"));
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
            return `Artifact published to ${result.path} (gallery: ${result.gallery}, hash: ${result.hash})`;
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
