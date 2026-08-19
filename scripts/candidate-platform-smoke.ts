#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { arch, platform, release, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface PackEntry {
  filename: string;
  integrity: string;
  shasum: string;
  size: number;
  unpackedSize: number;
  entryCount: number;
}

export interface CandidatePlatformEvidence {
  schemaVersion: 1;
  generatedAt: string;
  result: "pass";
  environment: {
    platform: string;
    release: string;
    architecture: string;
    node: string;
    runnerOs: string | null;
    runnerArchitecture: string | null;
    runnerImageOs: string | null;
    runnerImageVersion: string | null;
  };
  candidate: PackEntry & { sha256: string };
  install: {
    source: "exact-local-tarball";
    lifecycleScripts: false;
    repositorySourceImported: false;
  };
  portableOutput: {
    sourceFixture: string;
    bytes: number;
    sha256: string;
    strictOfflineCsp: true;
    packageTreeRemovedBeforeReopen: true;
    byteIdenticalAfterRemoval: true;
  };
  claimBoundary: {
    technicalObservationOnly: true;
    supportedPlatform: false;
    browserCoverage: false;
    representativeUserEvidence: false;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePackEntry(output: string): PackEntry {
  const value: unknown = JSON.parse(output);
  const item = Array.isArray(value) && value.length === 1 ? value[0] : undefined;
  if (!isRecord(item)) throw new Error("npm pack must return exactly one entry");
  const fields = ["filename", "integrity", "shasum"] as const;
  for (const field of fields) {
    if (typeof item[field] !== "string" || item[field].length === 0) {
      throw new Error(`npm pack entry is missing ${field}`);
    }
  }
  const numbers = ["size", "unpackedSize", "entryCount"] as const;
  for (const field of numbers) {
    if (!Number.isInteger(item[field]) || Number(item[field]) <= 0) {
      throw new Error(`npm pack entry has invalid ${field}`);
    }
  }
  return {
    filename: String(item["filename"]),
    integrity: String(item["integrity"]),
    shasum: String(item["shasum"]),
    size: Number(item["size"]),
    unpackedSize: Number(item["unpackedSize"]),
    entryCount: Number(item["entryCount"]),
  };
}

export function assertPortableHtml(html: string): void {
  const required = [
    "<!doctype html>",
    "Renderer no-runtime benchmark",
    "Content-Security-Policy",
    "connect-src 'none'",
    "Build results",
    "Benchmark interaction",
  ];
  for (const marker of required) {
    if (!html.includes(marker)) throw new Error(`portable output is missing ${marker}`);
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function run(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}: ${detail}`);
  }
  return result.stdout;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

export async function runCandidatePlatformSmoke(
  repositoryRoot: string,
  outputPath: string,
  expectedSha256?: string,
): Promise<CandidatePlatformEvidence> {
  const work = await mkdtemp(join(tmpdir(), "opencode-platform-smoke-"));
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  try {
    const cache = join(work, "npm-cache");
    const packOutput = run(
      npm,
      ["pack", "--json", "--pack-destination", work],
      repositoryRoot,
      { NPM_CONFIG_CACHE: cache },
    );
    const pack = parsePackEntry(packOutput);
    const tarball = join(work, pack.filename);
    const tarballBytes = await readFile(tarball);
    const candidateSha256 = sha256(tarballBytes);
    if (expectedSha256 !== undefined && candidateSha256 !== expectedSha256) {
      throw new Error(`candidate SHA-256 ${candidateSha256} does not match ${expectedSha256}`);
    }

    const installRoot = join(work, "consumer");
    await mkdir(installRoot);
    run(
      npm,
      ["install", "--prefix", installRoot, "--ignore-scripts", "--no-audit", "--no-fund", tarball],
      work,
      { NPM_CONFIG_CACHE: cache },
    );

    const fixture = resolve(repositoryRoot, "benchmarks/renderer/v1/no-runtime.md");
    const htmlPath = join(work, "portable.html");
    const cli = join(installRoot, "node_modules", "opencode-artifacts", "dist", "cli.js");
    run(process.execPath, [cli, "render", fixture, "-o", htmlPath], work);

    const beforeRemoval = await readFile(htmlPath);
    assertPortableHtml(beforeRemoval.toString("utf8"));
    const htmlSha256 = sha256(beforeRemoval);
    await rm(installRoot, { recursive: true, force: true });
    const afterRemoval = await readFile(htmlPath);
    if (sha256(afterRemoval) !== htmlSha256) throw new Error("portable output changed after package removal");

    const evidence: CandidatePlatformEvidence = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      result: "pass",
      environment: {
        platform: platform(),
        release: release(),
        architecture: arch(),
        node: process.version,
        runnerOs: process.env["RUNNER_OS"] ?? null,
        runnerArchitecture: process.env["RUNNER_ARCH"] ?? null,
        runnerImageOs: process.env["ImageOS"] ?? null,
        runnerImageVersion: process.env["ImageVersion"] ?? null,
      },
      candidate: { ...pack, sha256: candidateSha256 },
      install: {
        source: "exact-local-tarball",
        lifecycleScripts: false,
        repositorySourceImported: false,
      },
      portableOutput: {
        sourceFixture: "benchmarks/renderer/v1/no-runtime.md",
        bytes: beforeRemoval.byteLength,
        sha256: htmlSha256,
        strictOfflineCsp: true,
        packageTreeRemovedBeforeReopen: true,
        byteIdenticalAfterRemoval: true,
      },
      claimBoundary: {
        technicalObservationOnly: true,
        supportedPlatform: false,
        browserCoverage: false,
        representativeUserEvidence: false,
      },
    };
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    return evidence;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === resolve(fileURLToPath(import.meta.url))) {
  const output = argument("--output");
  if (!output) throw new Error("Usage: node scripts/candidate-platform-smoke.ts --output <evidence.json> [--expected-sha256 <digest>]");
  const evidence = await runCandidatePlatformSmoke(process.cwd(), resolve(output), argument("--expected-sha256"));
  console.log(JSON.stringify(evidence, null, 2));
}
