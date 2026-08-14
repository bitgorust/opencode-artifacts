#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { renderArtifact, renderRawHtml } from "./render.ts";
import { FilePublisher, slugify } from "./publisher.ts";
import { GitHubPagesPublisher } from "./github-pages.ts";
import { formatFindings, scanSensitive } from "./guard.ts";
import { serveArtifacts } from "./serve.ts";
import { openFile } from "./open.ts";

const DEFAULT_DIR = join(".opencode", "artifacts");

function usage(): never {
  console.error(`usage:
  opencode-artifacts render <input.md> [-o <out.html>] [--open] [--title <t>] [--format markdown|html] [--version]
  opencode-artifacts serve [--dir <artifacts-dir>] [--port <n>]
  opencode-artifacts restore <slug> --version <n> [--dir <artifacts-dir>]
  opencode-artifacts latest [--dir <artifacts-dir>] [--open]
  opencode-artifacts state <slug> [--dir <artifacts-dir>]
  opencode-artifacts deploy --repo <owner/name> [--dir <artifacts-dir>] [--branch <name>]`);
  process.exit(2);
}

function optionValue(args: string[], flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

function positional(args: string[], flagsWithValues: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (flagsWithValues.includes(arg)) {
      i++;
    } else if (!arg.startsWith("-")) {
      out.push(arg);
    }
  }
  return out;
}

async function renderCommand(args: string[]): Promise<void> {
  const [input] = positional(args, ["-o", "--title", "--format"]);
  const out = optionValue(args, "-o");
  const title = optionValue(args, "--title");
  const format = optionValue(args, "--format") ?? "markdown";
  const open = args.includes("--open");
  const version = args.includes("--version");
  const force = args.includes("--force");
  if (!input) usage();
  if (format !== "markdown" && format !== "html") usage();

  const markdown = await readFile(input, "utf8");
  const findings = scanSensitive(markdown);
  if (findings.length > 0 && !force) {
    console.error(
      `publish blocked: credential-looking strings found: ${formatFindings(findings)}. Re-run with --force to publish anyway.`,
    );
    process.exit(1);
  }
  const rendered =
    format === "html" ? renderRawHtml(markdown, title ? { title } : {}) : renderArtifact(markdown);
  const finalTitle = title ?? rendered.meta.title ?? "Artifact";

  let outPath: string;
  if (out) {
    outPath = resolve(out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, rendered.html.replace("<!--artifact:footer-->", ""), "utf8");
  } else {
    const publisher = new FilePublisher(join(process.cwd(), DEFAULT_DIR));
    const result = await publisher.publish({
      slug: slugify(finalTitle),
      html: rendered.html,
      title: finalTitle,
      icon: rendered.meta.icon,
      charts: rendered.chartCount,
      version,
    });
    outPath = result.path;
  }

  if (open) openFile(outPath);
  console.log(outPath);
}

async function serveCommand(args: string[]): Promise<void> {
  const dir = resolve(optionValue(args, "--dir") ?? DEFAULT_DIR);
  const portArg = optionValue(args, "--port");
  const port = portArg === undefined ? 4173 : Number(portArg);
  if (!Number.isInteger(port) || port < 0 || port > 65535) usage();

  const served = await serveArtifacts({ dir, port });
  console.log(`Serving ${dir} at ${served.url} (live reload on)`);
  await new Promise<void>(() => {
    // Keep the process alive until the user interrupts it.
  });
}

async function restoreCommand(args: string[]): Promise<void> {
  const [slug] = positional(args, ["--dir", "--version"]);
  const dir = optionValue(args, "--dir") ?? DEFAULT_DIR;
  const versionArg = optionValue(args, "--version");
  if (!slug || versionArg === undefined) usage();
  const version = Number(versionArg);
  if (!Number.isInteger(version) || version < 1) usage();

  const publisher = new FilePublisher(resolve(dir));
  const result = await publisher.restore(slug, version);
  console.log(result.path);
}

async function latestCommand(args: string[]): Promise<void> {
  const dir = optionValue(args, "--dir") ?? DEFAULT_DIR;
  const open = args.includes("--open");
  const publisher = new FilePublisher(resolve(dir));
  const latest = await publisher.latest();
  if (!latest) {
    console.error("no artifacts found");
    process.exit(1);
  }
  const path = join(resolve(dir), `${latest.slug}.html`);
  if (open) openFile(path);
  console.log(path);
}

async function stateCommand(args: string[]): Promise<void> {  const [slug] = positional(args, ["--dir"]);
  const dir = optionValue(args, "--dir") ?? DEFAULT_DIR;
  if (!slug) usage();
  try {
    process.stdout.write(await readFile(join(resolve(dir), ".state", `${slug}.json`), "utf8"));
  } catch {
    console.error(`no saved state for artifact '${slug}'`);
    process.exit(1);
  }
}

async function deployCommand(args: string[]): Promise<void> {
  const repo = optionValue(args, "--repo");
  const dir = resolve(optionValue(args, "--dir") ?? DEFAULT_DIR);
  const branch = optionValue(args, "--branch") ?? "main";
  if (!repo || !repo.includes("/")) usage();

  const cloneDir = join(
    process.env["HOME"] ?? ".",
    ".cache",
    "opencode-artifacts",
    "ghpages",
    repo.replace("/", "__"),
  );
  const publisher = new GitHubPagesPublisher(dir, { repo, branch, cloneDir });
  const baseUrl = await publisher.sync("deploy artifacts");
  console.log(baseUrl);
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  switch (command) {
    case "render":
      return renderCommand(rest);
    case "serve":
      return serveCommand(rest);
    case "restore":
      return restoreCommand(rest);
    case "latest":
      return latestCommand(rest);
    case "state":
      return stateCommand(rest);
    case "deploy":
      return deployCommand(rest);
    default:
      usage();
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
