import { execFile } from "node:child_process";
import { cp, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { FilePublisher, type PublishInput, type PublishResult, type Publisher } from "./publisher.ts";

export type Runner = (command: string, args: string[], cwd?: string) => Promise<string>;

export const runProcess: Runner = async (command, args, cwd) => {
  const { stdout } = await promisify(execFile)(command, args, {
    cwd,
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
};

export interface GitHubPagesOptions {
  repo: string;
  branch?: string;
  cloneDir: string;
  runner?: Runner;
}

export function pagesBaseUrl(repo: string): string {
  const [owner, name] = repo.split("/");
  if (name === `${owner}.github.io`) return `https://${owner}.github.io/`;
  return `https://${owner}.github.io/${name}/`;
}

const SKIP_ENTRIES = new Set([".git", ".state", ".db", ".datasources"]);

export async function copyArtifacts(fromDir: string, toDir: string): Promise<void> {
  await mkdir(toDir, { recursive: true });
  for (const entry of await readdir(fromDir, { withFileTypes: true })) {
    if (SKIP_ENTRIES.has(entry.name)) continue;
    await cp(join(fromDir, entry.name), join(toDir, entry.name), { recursive: true });
  }
}

export class GitHubPagesPublisher implements Publisher {
  private readonly local: FilePublisher;
  private readonly localDir: string;
  private readonly repo: string;
  private readonly branch: string;
  private readonly cloneDir: string;
  private readonly runner: Runner;

  constructor(localDir: string, options: GitHubPagesOptions) {
    this.local = new FilePublisher(localDir);
    this.localDir = localDir;
    this.repo = options.repo;
    this.branch = options.branch ?? "main";
    this.cloneDir = options.cloneDir;
    this.runner = options.runner ?? runProcess;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const result = await this.local.publish(input);
    const baseUrl = await this.sync(`publish ${input.slug} v${result.version}`);
    return { ...result, url: `${baseUrl}${input.slug}.html` };
  }

  async sync(commitMessage: string): Promise<string> {
    await this.ensureClone();
    await this.runner("git", ["-C", this.cloneDir, "pull", "--ff-only"]).catch(() => {});
    await copyArtifacts(this.localDir, this.cloneDir);
    await this.runner("git", ["-C", this.cloneDir, "add", "-A"]);
    const status = await this.runner("git", ["-C", this.cloneDir, "status", "--porcelain"]);
    if (status.trim() !== "") {
      await this.runner("git", [
        "-C",
        this.cloneDir,
        "-c",
        "user.name=opencode-artifacts",
        "-c",
        "user.email=opencode-artifacts@localhost",
        "commit",
        "-m",
        commitMessage,
      ]);
      await this.runner("git", ["-C", this.cloneDir, "push", "origin", `HEAD:${this.branch}`]);
    }
    await this.ensurePagesEnabled();
    return pagesBaseUrl(this.repo);
  }

  private async ensureClone(): Promise<void> {
    try {
      await readdir(join(this.cloneDir, ".git"));
      return;
    } catch {
      // not cloned yet
    }
    await mkdir(join(this.cloneDir, ".."), { recursive: true });
    try {
      await this.runner("gh", ["repo", "clone", this.repo, this.cloneDir]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/not found|Could not resolve/i.test(message)) throw err;
      await this.runner("gh", ["repo", "create", this.repo, "--public"]);
      await this.runner("gh", ["repo", "clone", this.repo, this.cloneDir]);
    }
    await this.runner("git", ["-C", this.cloneDir, "checkout", "-B", this.branch]).catch(() => {});
  }

  private async ensurePagesEnabled(): Promise<void> {
    await this.runner("gh", [
      "api",
      `repos/${this.repo}/pages`,
      "-X",
      "POST",
      "-f",
      `source[branch]=${this.branch}`,
      "-f",
      "source[path]=/",
    ]).catch(() => {});
  }
}
