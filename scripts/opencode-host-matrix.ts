#!/usr/bin/env node

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const OLDEST_TESTED_OPENCODE_VERSION = "1.18.18";
export const MAX_LOG_BYTES = 64 * 1024;
export const ARTIFACT_TOOL_CONTRACT = {
  artifact_publish: ["markdown", "title", "open", "version", "format", "expectedHash", "artifact", "expectedRevision", "force", "dataSources", "deploy", "repo", "target", "workerName"],
  artifact_lifecycle: ["op", "artifact", "revision", "expectedRevision", "token", "slug", "path"],
  artifact_db: ["slug", "collection", "op", "id", "doc", "q", "expectedRevision", "expectedDocumentHash", "createOnly", "operationId"],
  artifact_state: ["slug"],
  artifact_comments: ["slug", "resolveId", "digest", "expectedRevision", "expectedHash", "operationId"],
} as const;
export const OPENCODE_PERMISSION_POLICY = {
  "*": "allow",
  artifact_publish: "ask",
  artifact_datasource: "ask",
  artifact_deploy: "deny",
  artifact_audience: "deny",
} as const;

interface CommandResult {
  command: string[];
  exitCode: number;
  output: string;
}

interface ToolDescription {
  id: string;
  parameters?: {
    properties?: Record<string, unknown>;
    required?: unknown;
  };
}

interface ServerResult {
  route: "cli-install" | "config-array";
  hostVersion: string;
  health: unknown;
  toolIds: string[];
  tools: ToolDescription[];
  logs: string;
  config: unknown;
  effectivePermission?: unknown;
  effectiveCommand?: unknown;
}

export interface MatrixEvidence {
  schemaVersion: 1;
  generatedAt: string;
  candidate: {
    filename: string;
    sha256: string;
    packageVersion: string;
  };
  compatibility: {
    currentStable: string;
    oldestTested: string;
    executedVersions: string[];
    deduplicated: boolean;
    broaderRangeProven: false;
    v2BetaExcluded: true;
  };
  environment: {
    node: string;
    platform: string;
    architecture: string;
    cleanRoots: string[];
    providerInference: false;
  };
  install: {
    package: CommandResult;
    currentResolution: CommandResult;
    hosts: Array<{ version: string; command: CommandResult }>;
    cliPlugins: Array<{ version: string; command: CommandResult }>;
  };
  routes: ServerResult[];
  smoke: {
    tool: "artifact_lifecycle";
    operation: "list";
    result: string;
    filesystemUnchanged: boolean;
    executionBoundary: "exact-packed-module";
  };
  skill: {
    install: CommandResult;
    destination: string;
    sourcePackageRemoved: true;
    files: Array<{ path: string; sha256: string; bytes: number }>;
    hosts: Array<{
      hostVersion: string;
      name: "artifact-pages";
      description: string;
      location: string;
      contentSha256: string;
      contentBytes: number;
      logs: string;
    }>;
  };
  result: "pass";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function boundedLog(previous: string, chunk: string, limit = MAX_LOG_BYTES): string {
  const combined = previous + chunk;
  if (Buffer.byteLength(combined, "utf8") <= limit) return combined;
  const marker = "\n[earlier output truncated]\n";
  const keep = Math.max(0, limit - Buffer.byteLength(marker, "utf8"));
  return marker + Buffer.from(combined, "utf8").subarray(-keep).toString("utf8");
}

export function exactStableMatrix(currentStable: string, oldestTested: string): {
  versions: string[];
  deduplicated: boolean;
} {
  const versions = [...new Set([currentStable, oldestTested])];
  return { versions, deduplicated: versions.length === 1 };
}

export function stableVersionFromNpm(value: unknown): string {
  const version = typeof value === "string"
    ? value
    : Array.isArray(value) && value.length === 1 && typeof value[0] === "string"
      ? value[0]
      : undefined;
  if (version === undefined || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("npm must resolve exactly one stable OpenCode version");
  }
  return version;
}

export function parseServerUrl(output: string): string | undefined {
  return output.match(/opencode server listening on (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
}

export function assertArtifactToolContract(ids: unknown, tools: unknown): asserts tools is ToolDescription[] {
  if (!Array.isArray(ids) || !ids.every((item) => typeof item === "string")) {
    throw new Error("host tool-ID response is not a string array");
  }
  if (!Array.isArray(tools)) throw new Error("host tool-schema response is not an array");
  const byId = new Map<string, ToolDescription>();
  for (const value of tools) {
    if (isRecord(value) && typeof value["id"] === "string") byId.set(value["id"], value as unknown as ToolDescription);
  }
  for (const [id, properties] of Object.entries(ARTIFACT_TOOL_CONTRACT)) {
    if (!ids.includes(id)) throw new Error(`host discovery is missing ${id}`);
    const tool = byId.get(id);
    if (!tool) throw new Error(`host schemas are missing ${id}`);
    const actual = tool.parameters?.properties;
    if (!isRecord(actual)) throw new Error(`${id} parameters.properties is missing`);
    for (const property of properties) {
      if (!(property in actual)) throw new Error(`${id} schema is missing ${property}`);
    }
  }
  const lifecycleOp = byId.get("artifact_lifecycle")?.parameters?.properties?.["op"];
  if (!isRecord(lifecycleOp) || !Array.isArray(lifecycleOp["enum"]) || !lifecycleOp["enum"].includes("reopen")) {
    throw new Error("artifact_lifecycle op schema is missing reopen");
  }
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<CommandResult> {
  const timeoutMs = options.timeoutMs ?? 180_000;
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const append = (chunk: Buffer): void => { output = boundedLog(output, chunk.toString("utf8")); };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out after ${timeoutMs}ms\n${output}`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const result = { command: [command, ...args], exitCode: code ?? -1, output };
      if (code !== 0) {
        reject(new Error(`${command} exited ${String(code)}\n${output}`));
        return;
      }
      resolvePromise(result);
    });
  });
}

function cleanEnvironment(root: string): NodeJS.ProcessEnv {
  return {
    XDG_CONFIG_HOME: join(root, "config"),
    XDG_DATA_HOME: join(root, "data"),
    XDG_CACHE_HOME: join(root, "cache"),
    XDG_STATE_HOME: join(root, "state"),
  };
}

async function fetchJson(url: string, timeoutMs = 120_000): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${(await response.text()).slice(0, 4096)}`);
  return await response.json() as unknown;
}

async function waitForServer(
  child: ChildProcessWithoutNullStreams,
  initialLogs = "",
  timeoutMs = 120_000,
): Promise<{ url: string; logs: () => string }> {
  let logs = initialLogs;
  return await new Promise((resolvePromise, reject) => {
    let settled = false;
    const append = (chunk: Buffer): void => {
      logs = boundedLog(logs, chunk.toString("utf8"));
      const url = parseServerUrl(logs);
      if (!settled && url) {
        settled = true;
        clearTimeout(timer);
        resolvePromise({ url, logs: () => logs });
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`OpenCode did not start within ${timeoutMs}ms\n${logs}`));
    }, timeoutMs);
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`OpenCode exited ${String(code)} before startup\n${logs}`));
    });
  });
}

async function stopServer(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolvePromise) => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
      resolvePromise();
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
}

async function probeRoute(input: {
  route: ServerResult["route"];
  hostVersion: string;
  hostBinary: string;
  project: string;
  envRoot: string;
  pluginUrl: string;
  config: unknown;
}): Promise<ServerResult> {
  const env = {
    ...cleanEnvironment(input.envRoot),
    ...(input.route === "config-array" ? { OPENCODE_CONFIG_CONTENT: JSON.stringify(input.config) } : {}),
  };
  await Promise.all(Object.values(cleanEnvironment(input.envRoot)).map((path) => mkdir(path, { recursive: true })));
  const child = spawn(input.hostBinary, ["serve", "--hostname", "127.0.0.1", "--port", "0", "--print-logs"], {
    cwd: input.project,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const server = await waitForServer(child);
  try {
    const health = await fetchJson(`${server.url}/global/health`);
    if (!isRecord(health) || health["healthy"] !== true || health["version"] !== input.hostVersion) {
      throw new Error(`unexpected health response: ${JSON.stringify(health)}`);
    }
    const ids = await fetchJson(`${server.url}/experimental/tool/ids`);
    const tools = await fetchJson(`${server.url}/experimental/tool?provider=opencode&model=big-pickle`);
    assertArtifactToolContract(ids, tools);
    const effectiveConfig = await fetchJson(`${server.url}/config`);
    const effectivePermission = isRecord(effectiveConfig) ? effectiveConfig["permission"] : undefined;
    const effectiveCommand = isRecord(effectiveConfig) ? effectiveConfig["command"] : undefined;
    const reopenCommand = isRecord(effectiveCommand) ? effectiveCommand["artifact-reopen"] : undefined;
    if (!isRecord(reopenCommand) || typeof reopenCommand["template"] !== "string" || !reopenCommand["template"].includes("artifact_lifecycle")) {
      throw new Error("stable host omitted the injected artifact-reopen command");
    }
    if (input.route === "config-array") {
      if (!isRecord(effectivePermission)) throw new Error("stable host omitted configured artifact permissions");
      for (const [permission, decision] of Object.entries(OPENCODE_PERMISSION_POLICY)) {
        if (effectivePermission[permission] !== decision) {
          throw new Error(`stable host changed ${permission} permission from ${decision}`);
        }
      }
    }
    return {
      route: input.route,
      hostVersion: input.hostVersion,
      health,
      toolIds: ids as string[],
      tools: (tools as ToolDescription[]).filter((item) => item.id.startsWith("artifact_")),
      logs: server.logs(),
      config: input.config,
      ...(effectivePermission === undefined ? {} : { effectivePermission }),
      effectiveCommand: { "artifact-reopen": reopenCommand },
    };
  } finally {
    await stopServer(child);
  }
}

async function readOnlyPackedSmoke(pluginDirectory: string, project: string): Promise<MatrixEvidence["smoke"]> {
  const pluginModule = await import(pathToFileURL(join(pluginDirectory, "dist", "plugin.js")).href);
  const schemaModule = await import(pathToFileURL(join(pluginDirectory, "dist", "artifact-schema.js")).href);
  if (typeof pluginModule.default !== "function" || typeof schemaModule.emptyArtifactManifestV2 !== "function") {
    throw new Error("packed plugin lifecycle exports are unavailable");
  }
  const hooks = await pluginModule.default({});
  const lifecycle = hooks?.tool?.artifact_lifecycle;
  if (!lifecycle || typeof lifecycle.execute !== "function") throw new Error("packed artifact_lifecycle tool is unavailable");
  const artifactRoot = join(project, ".opencode", "artifacts");
  await mkdir(artifactRoot, { recursive: true });
  const manifestPath = join(artifactRoot, "manifest.json");
  const manifest = `${JSON.stringify(schemaModule.emptyArtifactManifestV2(), null, 2)}\n`;
  await writeFile(manifestPath, manifest, "utf8");
  const result = String(await lifecycle.execute({ op: "list" }, {
    sessionID: "packed-host-smoke",
    messageID: "packed-host-smoke",
    agent: "compatibility",
    directory: project,
    worktree: project,
    abort: new AbortController().signal,
    metadata: () => {},
    ask: async () => { throw new Error("read-only smoke requested permission"); },
  }));
  const after = await readFile(manifestPath, "utf8");
  if (!result.includes('"artifacts": []')) throw new Error(`unexpected lifecycle list smoke: ${result}`);
  if (after !== manifest) throw new Error("read-only lifecycle smoke changed the manifest");
  return {
    tool: "artifact_lifecycle",
    operation: "list",
    result,
    filesystemUnchanged: true,
    executionBoundary: "exact-packed-module",
  };
}

async function probeNativeSkill(input: {
  hostVersion: string;
  hostBinary: string;
  project: string;
  envRoot: string;
  destination: string;
}): Promise<MatrixEvidence["skill"]["hosts"][number]> {
  const env = { ...cleanEnvironment(input.envRoot), OPENCODE_DISABLE_EXTERNAL_SKILLS: "true" };
  await Promise.all(Object.values(cleanEnvironment(input.envRoot)).map((path) => mkdir(path, { recursive: true })));
  const child = spawn(input.hostBinary, ["serve", "--hostname", "127.0.0.1", "--port", "0", "--print-logs"], {
    cwd: input.project,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const server = await waitForServer(child);
  try {
    const health = await fetchJson(`${server.url}/global/health`);
    if (!isRecord(health) || health["healthy"] !== true || health["version"] !== input.hostVersion) {
      throw new Error(`unexpected native-skill host health: ${JSON.stringify(health)}`);
    }
    const skills = await fetchJson(`${server.url}/skill`);
    if (!Array.isArray(skills)) throw new Error("native skill endpoint did not return an array");
    const match = skills.find((value) => isRecord(value) && value["name"] === "artifact-pages");
    if (!isRecord(match) || typeof match["description"] !== "string" || typeof match["location"] !== "string" || typeof match["content"] !== "string") {
      throw new Error("stable host did not advertise and load artifact-pages");
    }
    const expectedLocation = join(input.destination, "SKILL.md");
    if (resolve(match["location"]) !== resolve(expectedLocation)) {
      throw new Error(`stable host selected an unexpected artifact-pages location: ${match["location"]}`);
    }
    if (!match["content"].includes("# Artifact Pages") || !match["content"].includes("reference/components.md")) {
      throw new Error("stable host returned incomplete artifact-pages content");
    }
    return {
      hostVersion: input.hostVersion,
      name: "artifact-pages",
      description: match["description"],
      location: match["location"],
      contentSha256: createHash("sha256").update(match["content"], "utf8").digest("hex"),
      contentBytes: Buffer.byteLength(match["content"], "utf8"),
      logs: server.logs(),
    };
  } finally {
    await stopServer(child);
  }
}

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

export function packFilename(pack: unknown): string {
  let result: Record<string, unknown> | undefined;
  if (Array.isArray(pack) && pack.length === 1 && isRecord(pack[0])) {
    result = pack[0];
  } else if (isRecord(pack)) {
    const values = Object.values(pack);
    if (values.length === 1 && isRecord(values[0])) result = values[0];
  }
  const filename = result?.["filename"];
  if (typeof filename !== "string" || filename.trim() === "") {
    throw new Error("--pack-json must contain exactly one npm pack result with a filename");
  }
  return filename;
}

async function requestedTarball(): Promise<string> {
  const directIndex = process.argv.indexOf("--tarball");
  const direct = directIndex === -1 ? undefined : process.argv[directIndex + 1];
  if (direct && !direct.startsWith("--")) return direct;
  const packJson = requiredArgument("--pack-json");
  const parsed = JSON.parse(await readFile(resolve(packJson), "utf8")) as unknown;
  return packFilename(parsed);
}

export async function runMatrix(tarballInput: string, outputInput: string): Promise<MatrixEvidence> {
  const tarball = resolve(tarballInput);
  const output = resolve(outputInput);
  const work = await mkdtemp(join(tmpdir(), "opencode-host-matrix-"));
  try {
    const packageRoot = join(work, "package");
    await mkdir(packageRoot, { recursive: true });
    const packageInstall = await runCommand("npm", ["install", "--prefix", packageRoot, "--ignore-scripts", "--no-audit", "--no-fund", tarball], { cwd: work });
    const currentResolution = await runCommand("npm", ["view", "opencode-ai", "version", "--json"], { cwd: work });
    const currentStable = stableVersionFromNpm(JSON.parse(currentResolution.output.trim()) as unknown);
    const pluginDirectory = join(packageRoot, "node_modules", "opencode-artifacts");
    const manifest = JSON.parse(await readFile(join(pluginDirectory, "package.json"), "utf8")) as { version?: unknown };
    if (typeof manifest.version !== "string") throw new Error("packed package version is missing");
    const pluginUrl = pathToFileURL(pluginDirectory).href;
    const matrix = exactStableMatrix(currentStable, OLDEST_TESTED_OPENCODE_VERSION);
    const hosts: Array<{ version: string; command: CommandResult }> = [];
    const hostBinaries: Array<{ version: string; binary: string }> = [];
    const cliPlugins: Array<{ version: string; command: CommandResult }> = [];
    const routes: ServerResult[] = [];
    for (const version of matrix.versions) {
      const versionKey = version.replaceAll(".", "-");
      const hostRoot = join(work, `host-${versionKey}`);
      const cliProject = join(work, `cli-project-${versionKey}`);
      const configProject = join(work, `config-project-${versionKey}`);
      await Promise.all([hostRoot, cliProject, configProject].map((path) => mkdir(path, { recursive: true })));
      const hostInstall = await runCommand("npm", ["install", "--prefix", hostRoot, "--no-audit", "--no-fund", `opencode-ai@${version}`], { cwd: work });
      hosts.push({ version, command: hostInstall });
      const hostBinary = join(hostRoot, "node_modules", ".bin", process.platform === "win32" ? "opencode.cmd" : "opencode");
      hostBinaries.push({ version, binary: hostBinary });
      const cliEnvRoot = join(work, `cli-env-${versionKey}`);
      await Promise.all(Object.values(cleanEnvironment(cliEnvRoot)).map((path) => mkdir(path, { recursive: true })));
      const cliPlugin = await runCommand(hostBinary, ["plugin", pluginUrl], { cwd: cliProject, env: cleanEnvironment(cliEnvRoot) });
      cliPlugins.push({ version, command: cliPlugin });
      const cliConfigPath = join(cliProject, ".opencode", "opencode.json");
      const cliConfig = JSON.parse(await readFile(cliConfigPath, "utf8")) as unknown;
      routes.push(
        await probeRoute({ route: "cli-install", hostVersion: version, hostBinary, project: cliProject, envRoot: cliEnvRoot, pluginUrl, config: cliConfig }),
        await probeRoute({ route: "config-array", hostVersion: version, hostBinary, project: configProject, envRoot: join(work, `config-env-${versionKey}`), pluginUrl, config: { plugin: [pluginUrl], permission: OPENCODE_PERMISSION_POLICY } }),
      );
    }
    const smoke = await readOnlyPackedSmoke(pluginDirectory, join(work, "smoke-project"));
    const skillProject = join(work, "skill-project");
    await mkdir(skillProject, { recursive: true });
    const skillInstall = await runCommand(process.execPath, [join(pluginDirectory, "dist", "cli.js"), "skill", "install", "--project"], { cwd: skillProject });
    const installedSkill = JSON.parse(skillInstall.output.trim()) as unknown;
    if (!isRecord(installedSkill) || installedSkill["status"] !== "installed" || typeof installedSkill["destination"] !== "string") {
      throw new Error(`packed skill installer returned an unexpected result: ${skillInstall.output}`);
    }
    const skillDestination = installedSkill["destination"];
    const skillFiles = await Promise.all(["SKILL.md", "reference/components.md", "reference/visuals.md"].map(async (path) => {
      const bytes = await readFile(join(skillDestination, ...path.split("/")));
      return { path, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
    }));
    await rm(packageRoot, { recursive: true, force: true });
    const skillHosts = [] as MatrixEvidence["skill"]["hosts"];
    for (const host of hostBinaries) {
      skillHosts.push(await probeNativeSkill({
        hostVersion: host.version,
        hostBinary: host.binary,
        project: skillProject,
        envRoot: join(work, `skill-env-${host.version.replaceAll(".", "-")}`),
        destination: skillDestination,
      }));
    }
    const evidence: MatrixEvidence = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      candidate: {
        filename: basename(tarball),
        sha256: createHash("sha256").update(await readFile(tarball)).digest("hex"),
        packageVersion: manifest.version,
      },
      compatibility: {
        currentStable,
        oldestTested: OLDEST_TESTED_OPENCODE_VERSION,
        executedVersions: matrix.versions,
        deduplicated: matrix.deduplicated,
        broaderRangeProven: false,
        v2BetaExcluded: true,
      },
      environment: {
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
        cleanRoots: ["config", "data", "cache", "state"],
        providerInference: false,
      },
      install: { package: packageInstall, currentResolution, hosts, cliPlugins },
      routes,
      smoke,
      skill: {
        install: skillInstall,
        destination: skillDestination,
        sourcePackageRemoved: true,
        files: skillFiles,
        hosts: skillHosts,
      },
      result: "pass",
    };
    await mkdir(resolve(output, ".."), { recursive: true });
    await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    return evidence;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const evidence = await runMatrix(await requestedTarball(), requiredArgument("--output"));
    console.log(`packed OpenCode host matrix: ${evidence.result} (${evidence.compatibility.executedVersions.join(", ")})`);
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}
