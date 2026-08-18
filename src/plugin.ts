import { join, dirname, resolve } from "node:path";
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
import { AssetPreflightError, type PortableAssets } from "./assets.ts";
import type { ResolvedDesignTokens } from "./design-tokens.ts";
import { parseDocument } from "./markdown.ts";
import { formatPreflight, preflightDocument, trustedHtmlDiagnostic, type AuthoringDiagnostic } from "./preflight.ts";
import { FilePublisher, slugify, StaleArtifactError } from "./publisher.ts";
import { GitHubPagesPublisher } from "./github-pages.ts";
import { CloudflarePublisher } from "./cloudflare-publisher.ts";
import { loadConfig, resolveDeploy } from "./config.ts";
import { formatFindings, scanSensitive } from "./guard.ts";
import { NAME_RE, readCollection, writeCollection } from "./serve.ts";
import { openFile, openFileChecked } from "./open.ts";
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
import {
  ArtifactLifecycleConflictError,
  ArtifactLifecycleStore,
  ArtifactReferenceError,
  type ArtifactLifecycleStatus,
} from "./artifact-lifecycle.ts";
import {
  approvePublishPermissions,
  ArtifactPermissionDeniedError,
} from "./opencode-permissions.ts";
import {
  ARTIFACT_RESULT_SCHEMA_VERSION,
  MAX_INLINE_RESULT_CONTENT_BYTES,
  artifactFailureResult,
  artifactToolResult,
} from "./opencode-results.ts";

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

async function isSchema2Store(root: string): Promise<boolean> {
  try {
    const info = await lstat(join(root, "manifest.json"));
    if (info.isSymbolicLink() || !info.isFile()) throw new Error("artifact manifest path is unsafe");
    const value = JSON.parse(await readFile(join(root, "manifest.json"), "utf8")) as unknown;
    return typeof value === "object" && value !== null && "schemaVersion" in value && value.schemaVersion === 2;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return false;
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
  const configuredLauncher = options?.["launcher"];
  const reopenLauncher = typeof configuredLauncher === "function"
    ? configuredLauncher as (target: string) => void | Promise<void>
    : openFileChecked;
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
          artifact: tool.schema
            .string()
            .optional()
            .describe("Exact artifact ID, active slug, contained path, or registered URL for an update"),
          expectedRevision: tool.schema
            .number()
            .optional()
            .describe("Expected schema-2 head revision for an update"),
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
          const refused = (output: string, error: string, nextAction: string) =>
            artifactFailureResult("publish", output, error, nextAction);
          try {
            const parsedTitle = args.format === "html" ? undefined : parseDocument(args.markdown).meta.title;
            const title = args.title ?? parsedTitle ?? "Artifact";
            slug = slugify(title);
            const findings = scanSensitive(`${args.markdown}\n${title}`);
            if (findings.length > 0 && args.force !== true) {
              return refused(
                `Publish blocked: the content contains credential-looking strings: ${formatFindings(findings)}. If these are intentional (e.g. redacted examples), call again with force: true.`,
                "sensitive-content",
                "remove the finding or retry with force only after reviewing the exact portable content",
              );
            }
            let preflightWarnings: AuthoringDiagnostic[] = [];
            let portableAssets: PortableAssets | undefined;
            let designTokens: ResolvedDesignTokens | undefined;
            if (args.format === "html") {
              preflightWarnings = [trustedHtmlDiagnostic()];
            } else {
              const preflight = await preflightDocument(args.markdown, { worktreeRoot: workRoot(ctx) });
              const errors = preflight.diagnostics.filter((item) => item.severity === "error");
              if (errors.length > 0 || preflight.omitted > 0) {
                return refused(formatPreflight(preflight), "preflight", "fix the bounded diagnostics and retry");
              }
              preflightWarnings = preflight.diagnostics;
              portableAssets = preflight.assets;
              designTokens = preflight.designTokens;
            }
            const rendered: RenderedArtifact =
              args.format === "html"
                ? renderRawHtml(args.markdown, args.title ? { title: args.title } : {})
                : renderArtifact(args.markdown, { assets: portableAssets, designTokens });
            const finalFindings = scanSensitive(rendered.html);
            if (finalFindings.length > 0 && args.force !== true) {
              return refused(
                `Publish blocked: the final portable bytes contain credential-looking strings: ${formatFindings(finalFindings)}. If these are intentional, call again with force: true.`,
                "sensitive-final-bytes",
                "remove the finding or retry with force only after reviewing the exact portable bytes",
              );
            }
            const plannedDeploy = await (async () => {
              if (!args.deploy) return undefined;
              const config = await loadConfig(workRoot(ctx));
              const resolved = resolveDeploy(
                { repo: args.repo, target: args.target, workerName: args.workerName },
                config,
              );
              if (resolved.target === "github") {
                if (!resolved.repo) {
                  throw new Error("deploy target 'github' is missing its repo — run `opencode-artifacts init`");
                }
                return { resolved, authority: { target: "github" as const, coordinate: `${resolved.repo}@${resolved.branch ?? "main"}` } };
              }
              if (!resolved.workerName) {
                throw new Error("deploy target 'cloudflare' is missing its workerName — run `opencode-artifacts init`");
              }
              return { resolved, authority: { target: "cloudflare" as const, coordinate: resolved.workerName } };
            })();

            await approvePublishPermissions(ctx, {
              slug,
              format: args.format ?? "markdown",
              trustedHtml: args.format === "html",
              ...(args.dataSources === undefined ? {} : { dataSources: args.dataSources }),
              ...(plannedDeploy === undefined ? {} : { deploy: plannedDeploy.authority }),
            });

            const localDir = join(workRoot(ctx), ".opencode", "artifacts");
            let result: { id?: string; slug: string; path: string; version: number; gallery: string; hash: string; url?: string };
            if (await isSchema2Store(localDir)) {
              const lifecycle = new ArtifactLifecycleStore(localDir);
              let status = await lifecycle.write({
                artifact: args.artifact,
                slug,
                html: rendered.html,
                title,
                icon: rendered.meta.icon,
                description: rendered.meta.description,
                source: rendered.meta.source,
                charts: rendered.chartCount,
                expectedRevision: args.expectedRevision,
                expectedHash: args.expectedHash,
                authoringSource: args.markdown,
                inputFormat: args.format ?? "markdown",
              });
              let url: string | undefined;
              if (plannedDeploy) {
                const resolved = plannedDeploy.resolved;
                if (resolved.target === "github" && resolved.repo) {
                  const adapter = new GitHubPagesPublisher(localDir, { repo: resolved.repo, branch: resolved.branch, cloneDir: ghPagesCloneDir(resolved.repo), allowSensitive: args.force === true });
                  const base = await adapter.sync(`publish ${slug} v${status.headRevision}`);
                  url = `${base}${slug}.html`;
                  status = await lifecycle.recordDeployment(status.id, { capability: "public-static", target: `github:${resolved.repo}:${resolved.branch}`, url });
                } else if (resolved.target === "cloudflare" && resolved.workerName) {
                  const adapter = new CloudflarePublisher(localDir, { workerName: resolved.workerName, stagingDir: cfStagingDir(resolved.workerName), allowSensitive: args.force === true });
                  const base = await adapter.deploy();
                  url = base === undefined ? undefined : `${base}/${slug}.html`;
                  if (url) status = await lifecycle.recordDeployment(status.id, { capability: "public-static", target: `cloudflare:${resolved.workerName}`, url });
                } else {
                  throw new Error(`deploy target '${resolved.target}' is missing its ${resolved.target === "github" ? "repo" : "workerName"} — run \`opencode-artifacts init\``);
                }
              }
              if (args.version !== undefined) console.error("artifact_publish version is deprecated for schema 2; immutable history is always retained");
              result = { id: status.id, slug: status.slug, path: status.stablePath ?? join(localDir, `${status.slug}.html`), version: status.headRevision, gallery: join(localDir, "index.html"), hash: status.contentHash.slice(0, 12), ...(url === undefined ? {} : { url }) };
            } else {
              if (args.artifact !== undefined || args.expectedRevision !== undefined) throw new Error("artifact and expectedRevision require a migrated schema-2 store");
              const publisher = await (async () => {
                if (!plannedDeploy) return new FilePublisher(localDir);
                const resolved = plannedDeploy.resolved;
                if (resolved.target === "github" && resolved.repo) return new GitHubPagesPublisher(localDir, { repo: resolved.repo, branch: resolved.branch, cloneDir: ghPagesCloneDir(resolved.repo), allowSensitive: args.force === true });
                if (resolved.target === "cloudflare" && resolved.workerName) return new CloudflarePublisher(localDir, { workerName: resolved.workerName, stagingDir: cfStagingDir(resolved.workerName), allowSensitive: args.force === true });
                throw new Error(`deploy target '${resolved.target}' is missing its ${resolved.target === "github" ? "repo" : "workerName"} — run \`opencode-artifacts init\``);
              })();
              result = { slug, ...await publisher.publish({ slug, html: rendered.html, title, icon: rendered.meta.icon, description: rendered.meta.description, source: rendered.meta.source, charts: rendered.chartCount, version: args.version ?? false, expectedHash: args.expectedHash }) };
            }
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
            const warning = preflightWarnings.length === 0 ? "" : `\nPreflight warnings: ${preflightWarnings.map((item) => `${item.code} at ${item.line}:${item.column}`).join(", ")}`;
            return artifactToolResult(
              `Artifact: ${title}`,
              `Artifact published to ${result.path}${result.url ? ` — live at ${result.url}` : ""} (gallery: ${result.gallery}, hash: ${result.hash})${warning}`,
              {
                schemaVersion: ARTIFACT_RESULT_SCHEMA_VERSION,
                operation: args.expectedRevision === undefined && args.expectedHash === undefined ? "create-or-update" : "update",
                outcome: "success",
                ...(result.id === undefined ? {} : { artifactId: result.id }),
                slug: result.slug,
                revision: result.version,
                path: result.path,
                ...(result.url === undefined ? {} : { url: result.url }),
                capability: result.url === undefined ? "portable-local" : "public-static",
                visibility: result.url === undefined ? "local" : "public",
              },
            );
          } catch (err) {
            if (err instanceof ArtifactPermissionDeniedError) {
              const output = JSON.stringify({
                error: "permission-denied",
                permission: err.permission,
                mutation: "none",
                nextAction: `allow or ask for ${err.permission} at the exact requested scope, then retry`,
              }, null, 2);
              return refused(output, "permission-denied", `allow or ask for ${err.permission} at the exact requested scope, then retry`);
            }
            if (err instanceof ArtifactTooLargeError) {
              return refused(`Artifact too large: ${err.message}`, "artifact-too-large", "reduce portable bytes and retry");
            }
            if (err instanceof AssetPreflightError) {
              return refused(JSON.stringify({ error: err.code, path: err.assetPath, message: err.message, nextAction: err.nextAction }, null, 2), err.code, err.nextAction);
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
              return refused([
                `Publish refused: ${err.message}.`,
                "The current published content follows — merge your edits onto it, then publish again with the new hash.",
                `[Artifact ${slug} — live version; raw HTML follows]`,
                preview,
                "[End of live content]",
              ].join("\n\n"), "stale", "merge onto the bounded live preview and retry with its current hash");
            }
            if (err instanceof ArtifactLifecycleConflictError) {
              return refused(JSON.stringify({ error: "stale", message: err.message, artifact: err.artifact, merge: err.merge, nextAction: "merge onto the returned immutable input and retry with artifact plus expectedRevision/hash" }, null, 2), "stale", "merge onto the returned immutable input and retry with artifact plus expectedRevision/hash");
            }
            const message = err instanceof Error ? err.message : "unknown publish failure";
            return artifactFailureResult("publish", `Artifact publish failed: ${message}`, "publish-failed", "fix the reported layer and retry", "error");
          }
        },
      }),
      artifact_lifecycle: tool({
        description: "List, inspect, read, reopen, restore, archive/unarchive, export, or import schema-2 artifacts by exact identity/reference. Archive is recoverable and requires a preview-bound permission confirmation.",
        args: {
          op: tool.schema.enum(["list", "status", "read", "reopen", "restore", "archive-preview", "archive-confirm", "unarchive", "export", "import"]),
          artifact: tool.schema.string().optional().describe("Exact artifact reference or opaque ID"),
          revision: tool.schema.number().optional().describe("Revision to read or restore"),
          expectedRevision: tool.schema.number().optional().describe("Expected current head for restore"),
          token: tool.schema.string().optional().describe("One-use archive confirmation token"),
          slug: tool.schema.string().optional().describe("Explicit non-conflicting slug for unarchive"),
          path: tool.schema.string().optional().describe("Export destination or import bundle directory"),
        },
        async execute(args, ctx) {
          const root = join(workRoot(ctx), ".opencode", "artifacts");
          const failure = (output: string, error: string, nextAction: string, outcome: "refused" | "error" = "refused") =>
            artifactFailureResult(`lifecycle:${args.op}`, output, error, nextAction, outcome);
          const fromStatus = (
            operation: string,
            status: ArtifactLifecycleStatus,
            output: string,
            overrides: { path?: string; url?: string; capability?: "portable-local" | "public-static" | "authenticated" | "connector-capable"; visibility?: "local" | "public" | "authenticated" } = {},
          ) => artifactToolResult(`Artifact ${operation}: ${status.title}`, output, {
            schemaVersion: ARTIFACT_RESULT_SCHEMA_VERSION,
            operation,
            outcome: "success",
            artifactId: status.id,
            slug: status.slug,
            revision: status.headRevision,
            ...(overrides.path === undefined && status.stablePath === null ? {} : { path: overrides.path ?? status.stablePath ?? undefined }),
            ...(overrides.url === undefined ? {} : { url: overrides.url }),
            capability: overrides.capability ?? "portable-local",
            visibility: overrides.visibility ?? "local",
            active: status.active,
          });
          if (!(await isSchema2Store(root))) {
            return failure(
              "artifact_lifecycle requires a migrated schema-2 store",
              "migration-required",
              "run `opencode-artifacts migrate inspect`, then explicitly apply the reviewed migration",
            );
          }
          const lifecycle = new ArtifactLifecycleStore(root);
          try {
            switch (args.op) {
              case "list": {
                const artifacts = await lifecycle.list();
                const output = JSON.stringify({ schemaVersion: 1, artifacts }, null, 2);
                return artifactToolResult("Artifact lifecycle list", output, {
                  schemaVersion: ARTIFACT_RESULT_SCHEMA_VERSION,
                  operation: "list",
                  outcome: "success",
                  count: artifacts.length,
                  nextAction: artifacts.length === 0 ? "publish or import an artifact" : "use an exact ID, slug, contained path, or registered URL",
                });
              }
              case "status": {
                if (!args.artifact) return failure("status requires artifact", "missing-reference", "pass an exact artifact reference");
                const status = await lifecycle.status(args.artifact);
                return fromStatus("status", status, JSON.stringify(status, null, 2));
              }
              case "read": {
                if (!args.artifact) return failure("read requires artifact", "missing-reference", "pass an exact artifact reference");
                const result = await lifecycle.read(args.artifact, args.revision);
                const bytes = Buffer.byteLength(result.html, "utf8");
                const pinnedPath = join(root, ...result.revision.pagePath.split("/"));
                const content = bytes <= MAX_INLINE_RESULT_CONTENT_BYTES
                  ? { html: result.html }
                  : { pinnedPath, preview: `${result.html.slice(0, 4096)}\n…\n${result.html.slice(-4096)}` };
                const output = JSON.stringify({ status: result.status, revision: result.revision, ...content }, null, 2);
                return fromStatus("read", result.status, output, { path: pinnedPath });
              }
              case "reopen": {
                if (!args.artifact) return failure("reopen requires artifact", "missing-reference", "pass an exact active artifact reference");
                const status = await lifecycle.status(args.artifact);
                let exactUrl: string | undefined;
                try {
                  const normalized = new URL(args.artifact).href;
                  exactUrl = status.deploymentReferences.find((entry) => entry.url === normalized)?.url;
                } catch {
                  // Non-URL references reopen the stable contained local path.
                }
                const target = exactUrl ?? status.stablePath;
                if (!target || !status.active) {
                  return failure("reopen requires an active local path or exact registered URL", "inactive-artifact", "unarchive by exact ID or choose an active reference");
                }
                try {
                  await reopenLauncher(target);
                } catch {
                  return failure("Artifact reopen failed before the launcher accepted the target", "launch-failed", "open the exact returned path or URL manually, or use `opencode-artifacts latest --open`", "error");
                }
                const output = JSON.stringify({ schemaVersion: 1, status, opened: target }, null, 2);
                if (exactUrl === undefined) return fromStatus("reopen", status, output, { path: target });
                const capability = status.deploymentReferences.find((entry) => entry.url === exactUrl)?.capability ?? "public-static";
                return fromStatus("reopen", status, output, {
                  url: exactUrl,
                  capability,
                  visibility: capability === "authenticated" ? "authenticated" : "public",
                });
              }
              case "restore": {
                if (!args.artifact || args.revision === undefined || args.expectedRevision === undefined) {
                  return failure("restore requires artifact, revision, and expectedRevision", "missing-restore-input", "pass an exact reference, immutable revision, and current expected head");
                }
                const status = await lifecycle.restore(args.artifact, args.revision, args.expectedRevision);
                return fromStatus("restore", status, JSON.stringify(status, null, 2));
              }
              case "archive-preview": {
                if (!args.artifact) return failure("archive-preview requires artifact", "missing-reference", "pass an exact active artifact reference");
                const preview = await lifecycle.previewArchive(args.artifact);
                return fromStatus("archive-preview", preview.artifact, JSON.stringify(preview, null, 2));
              }
              case "archive-confirm": {
                if (!args.token) return failure("archive-confirm requires token", "missing-token", "run archive-preview and pass its one-use head-bound token");
                const preview = await lifecycle.inspectArchivePreview(args.token);
                try {
                  await ctx.ask({ permission: "artifact_archive", patterns: [preview.artifact.id, args.token], always: [], metadata: { artifactId: preview.artifact.id, slug: preview.artifact.slug, headRevision: preview.artifact.headRevision, token: args.token } });
                } catch {
                  return failure("Archive permission denied; artifact state is unchanged", "permission-denied", "approve the exact head-bound archive scope and retry before the token expires");
                }
                const status = await lifecycle.archive(args.token);
                return fromStatus("archive-confirm", status, JSON.stringify(status, null, 2));
              }
              case "unarchive": {
                if (!args.artifact) return failure("unarchive requires artifact ID", "missing-id", "pass the exact archived artifact ID");
                const status = await lifecycle.unarchive(args.artifact, args.slug);
                return fromStatus("unarchive", status, JSON.stringify(status, null, 2));
              }
              case "export": {
                if (!args.artifact || !args.path) return failure("export requires artifact and path", "missing-export-input", "pass an exact artifact reference and contained destination path");
                const exported = await lifecycle.exportBundle(args.artifact, args.path);
                return fromStatus("export", exported.artifact, JSON.stringify(exported, null, 2), { path: exported.path });
              }
              case "import": {
                if (!args.path) return failure("import requires path", "missing-import-path", "pass the exact bundle directory");
                try {
                  await ctx.ask({ permission: "artifact_import", patterns: [resolve(args.path)], always: [], metadata: { bundle: resolve(args.path) } });
                } catch {
                  return failure("Import permission denied; artifact state is unchanged", "permission-denied", "approve the exact bundle path and retry");
                }
                const status = await lifecycle.importBundle(args.path);
                return fromStatus("import", status, JSON.stringify(status, null, 2));
              }
            }
          } catch (error) {
            if (error instanceof ArtifactLifecycleConflictError) {
              return failure(JSON.stringify({ error: "stale", message: error.message, artifact: error.artifact, merge: error.merge }, null, 2), "stale", "merge onto the returned immutable input and retry with the current expected revision");
            }
            if (error instanceof ArtifactReferenceError) {
              return failure(`Artifact reference refused: ${error.message}`, "invalid-reference", "list artifacts and retry with one exact accepted reference");
            }
            const message = error instanceof Error ? error.message : "unknown lifecycle failure";
            return failure(`Artifact lifecycle failed: ${message}`, "lifecycle-failed", "fix the reported exact input and retry", "error");
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

  hooks.config = async (config) => {
    config.command ??= {};
    config.command["artifact-reopen"] ??= {
      template: "Call artifact_lifecycle with op \"reopen\" and artifact \"$ARGUMENTS\". Require one exact active ID, slug, contained path, or registered URL; do not guess.",
      description: "Reopen an exact artifact reference",
    };
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
