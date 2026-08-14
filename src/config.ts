import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type DeployTarget = "github" | "cloudflare";

export interface DeployConfig {
  target: DeployTarget;
  repo?: string;
  workerName?: string;
  branch?: string;
}

export interface ArtifactsConfig {
  deploy?: DeployConfig;
}

export function projectConfigPath(worktree: string): string {
  return join(worktree, ".opencode", "artifacts.json");
}

export function globalConfigPath(): string {
  return join(homedir(), ".config", "opencode-artifacts", "config.json");
}

async function readConfig(path: string): Promise<ArtifactsConfig | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (typeof parsed === "object" && parsed !== null) return parsed as ArtifactsConfig;
    return undefined;
  } catch {
    return undefined;
  }
}

export async function loadConfig(worktree: string): Promise<ArtifactsConfig> {
  const project = await readConfig(projectConfigPath(worktree));
  if (project !== undefined) return project;
  return (await readConfig(globalConfigPath())) ?? {};
}

export async function saveConfig(path: string, config: ArtifactsConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export interface DeployArgs {
  repo?: string;
  target?: DeployTarget;
  workerName?: string;
}

export function resolveDeploy(
  args: DeployArgs,
  config: ArtifactsConfig,
): { target: DeployTarget; repo?: string; workerName?: string; branch?: string } {
  const configured = config.deploy;
  const target = args.target ?? (args.repo ? "github" : undefined) ?? configured?.target;
  if (target === "github") {
    return { target, repo: args.repo ?? configured?.repo, branch: configured?.branch };
  }
  if (target === "cloudflare") {
    return { target, workerName: args.workerName ?? configured?.workerName };
  }
  throw new Error(
    "no deploy target configured — run `opencode-artifacts init` or pass repo / target+workerName",
  );
}
