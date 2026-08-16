#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { renderArtifact, renderRawHtml } from "./render.ts";
import { FilePublisher, slugify } from "./publisher.ts";
import { GitHubPagesPublisher } from "./github-pages.ts";
import { CloudflarePublisher } from "./cloudflare-publisher.ts";
import {
  globalConfigPath,
  loadConfig,
  projectConfigPath,
  saveConfig,
  type ArtifactsConfig,
  type DeployTarget,
} from "./config.ts";
import { formatFindings, scanArtifactDirectory, scanSensitive } from "./guard.ts";
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
  opencode-artifacts deploy --repo <owner/name> [--dir <artifacts-dir>] [--branch <name>] [--force]
  opencode-artifacts deploy --target cloudflare --name <worker> [--dir <artifacts-dir>] [--force]
  opencode-artifacts init [--global] [--target github|cloudflare] [--repo <owner/name>] [--worker-name <name>] [--yes]`);
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
  const findings = scanSensitive(`${markdown}\n${title ?? ""}`);
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
      description: rendered.meta.description,
      source: rendered.meta.source,
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
  const target = optionValue(args, "--target") ?? "github";
  const dir = resolve(optionValue(args, "--dir") ?? DEFAULT_DIR);
  const home = process.env["HOME"] ?? ".";
  const sensitiveFiles = await scanArtifactDirectory(dir);
  if (sensitiveFiles.length > 0 && !args.includes("--force")) {
    const details = sensitiveFiles
      .map(({ file, findings }) => `${file}: ${formatFindings(findings)}`)
      .join("; ");
    throw new Error(
      `deploy blocked: credential-looking strings found: ${details}. Re-run with --force to deploy anyway.`,
    );
  }

  if (target === "cloudflare") {
    const name = optionValue(args, "--name");
    if (!name) usage();
    const publisher = new CloudflarePublisher(dir, {
      workerName: name,
      stagingDir: join(home, ".cache", "opencode-artifacts", "cloudflare", name),
      allowSensitive: args.includes("--force"),
    });
    const url = await publisher.deploy();
    console.log(url ?? "deployed (workers.dev url not found in output)");
    return;
  }

  const repo = optionValue(args, "--repo");
  const branch = optionValue(args, "--branch") ?? "main";
  if (!repo || !repo.includes("/")) usage();
  const cloneDir = join(home, ".cache", "opencode-artifacts", "ghpages", repo.replace("/", "__"));
  const publisher = new GitHubPagesPublisher(dir, {
    repo,
    branch,
    cloneDir,
    allowSensitive: args.includes("--force"),
  });
  const baseUrl = await publisher.sync("deploy artifacts");
  console.log(baseUrl);
}

async function ghLogin(): Promise<string | undefined> {
  try {
    const { runProcess } = await import("./github-pages.ts");
    const login = (await runProcess("gh", ["api", "user", "--jq", ".login"])).trim();
    return /^[a-z0-9-]+$/i.test(login) ? login : undefined;
  } catch {
    return undefined;
  }
}

async function initCommand(args: string[]): Promise<void> {
  const global = args.includes("--global");
  const yes = args.includes("--yes");
  const path = global ? globalConfigPath() : projectConfigPath(process.cwd());

  const existing = await loadConfig(process.cwd());
  const config: ArtifactsConfig = { ...existing };

  let target = optionValue(args, "--target") as DeployTarget | undefined;
  let repo = optionValue(args, "--repo");
  let workerName = optionValue(args, "--worker-name");

  if (!yes && process.stdin.isTTY) {
    const { createInterface } = await import("node:readline/promises");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      if (target === undefined) {
        const answer = await rl.question(
          "Deploy target for published artifacts? [github/cloudflare/skip] (github) ",
        );
        const picked = answer.trim().toLowerCase();
        target = picked === "cloudflare" ? "cloudflare" : picked === "skip" ? undefined : "github";
      }
      if (target === "github" && repo === undefined) {
        const login = await ghLogin();
        const suggested = login !== undefined ? `${login}/artifacts` : "owner/artifacts";
        const answer = await rl.question(`GitHub Pages repo (owner/name) [${suggested}] `);
        repo = answer.trim() === "" ? suggested : answer.trim();
      }
      if (target === "cloudflare" && workerName === undefined) {
        const answer = await rl.question("Cloudflare worker name [opencode-artifacts] ");
        workerName = answer.trim() === "" ? "opencode-artifacts" : answer.trim();
      }
    } finally {
      rl.close();
    }
  }

  if (target !== undefined) {
    config.deploy = {
      target,
      ...(repo !== undefined ? { repo } : {}),
      ...(workerName !== undefined ? { workerName } : {}),
    };
    await saveConfig(path, config);
    console.log(`Wrote ${path}`);
    console.log(`Deploy target: ${target}${repo ? ` (${repo})` : ""}${workerName ? ` (${workerName})` : ""}`);
  } else if (config.deploy !== undefined) {
    const current = config.deploy;
    console.log(
      `Keeping existing deploy target: ${current.target}${current.repo ? ` (${current.repo})` : ""}${current.workerName ? ` (${current.workerName})` : ""}`,
    );
  } else {
    console.log("No deploy target configured; artifacts stay local. Re-run init anytime.");
  }
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
    case "init":
      return initCommand(rest);
    default:
      usage();
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
