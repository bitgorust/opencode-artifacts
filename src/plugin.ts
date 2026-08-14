import { join } from "node:path";
import { tool, type Plugin } from "@opencode-ai/plugin";
import { ArtifactTooLargeError, renderArtifact } from "./render.ts";
import { FilePublisher, slugify } from "./publisher.ts";
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
          "easier to see as a page than to read as terminal text.",
        ].join(" "),
        args: {
          markdown: tool.schema.string().describe("Full Markdown source of the artifact page"),
          title: tool.schema.string().optional().describe("Title override; defaults to frontmatter title"),
          open: tool.schema.boolean().optional().describe("Open the artifact in the system browser"),
          version: tool.schema
            .boolean()
            .optional()
            .describe("Also keep a numbered version file next to the stable path"),
        },
        async execute(args, ctx) {
          try {
            const rendered = renderArtifact(args.markdown);
            const title = args.title ?? rendered.meta.title ?? "Artifact";
            const publisher = new FilePublisher(join(ctx.worktree, ".opencode", "artifacts"));
            const result = await publisher.publish({
              slug: slugify(title),
              html: rendered.html,
              version: args.version ?? false,
            });
            if (args.open) openFile(result.path);
            ctx.metadata({
              title: `Artifact: ${title}`,
              metadata: { path: result.path, version: result.version, charts: rendered.chartCount },
            });
            return `Artifact published to ${result.path}`;
          } catch (err) {
            if (err instanceof ArtifactTooLargeError) {
              return `Artifact too large: ${err.message}`;
            }
            throw err;
          }
        },
      }),
    },
  };
};

export default ArtifactsPlugin;
