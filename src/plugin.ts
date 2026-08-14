import { join } from "node:path";
import { tool, type Plugin } from "@opencode-ai/plugin";
import {
  ArtifactTooLargeError,
  renderArtifact,
  renderRawHtml,
  type RenderedArtifact,
} from "./render.ts";
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
        },
        async execute(args, ctx) {
          try {
            const rendered: RenderedArtifact =
              args.format === "html"
                ? renderRawHtml(args.markdown, args.title ? { title: args.title } : {})
                : renderArtifact(args.markdown);
            const title = args.title ?? rendered.meta.title ?? "Artifact";
            const slug = slugify(title);

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
              charts: rendered.chartCount,
              version: args.version ?? false,
            });
            if (args.open) openFile(result.path);
            ctx.metadata({
              title: `Artifact: ${title}`,
              metadata: {
                path: result.path,
                version: result.version,
                gallery: result.gallery,
                charts: rendered.chartCount,
              },
            });
            return `Artifact published to ${result.path} (gallery: ${result.gallery})`;
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
