import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";

export const BUNDLED_SKILL_FILES = [
  "SKILL.md",
  "reference/components.md",
  "reference/visuals.md",
] as const;

export type SkillInstallScope = "project" | "global";

export interface SkillInstallOptions {
  scope: SkillInstallScope;
  projectRoot?: string;
  homeRoot?: string;
  sourceRoot?: string;
  forceDestination?: string;
}

export interface SkillInstallResult {
  schemaVersion: 1;
  status: "installed" | "unchanged" | "replaced";
  destination: string;
  files: string[];
  digest: string;
  backup?: string;
  removal: string;
}

interface SkillSnapshot {
  files: Map<string, Buffer>;
  digest: string;
}

function errnoCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

export function bundledSkillSource(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "skills", "artifact-pages");
}

export function skillDestination(options: Pick<SkillInstallOptions, "scope" | "projectRoot" | "homeRoot">): string {
  if (options.scope === "project") {
    return join(resolve(options.projectRoot ?? process.cwd()), ".opencode", "skills", "artifact-pages");
  }
  return join(resolve(options.homeRoot ?? homedir()), ".config", "opencode", "skills", "artifact-pages");
}

async function assertRealDirectory(path: string, label: string): Promise<void> {
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`${label} must be a real directory: ${path}`);
}

async function snapshotSource(source: string): Promise<SkillSnapshot> {
  await assertRealDirectory(source, "bundled skill source");
  const files = await installedFiles(source);
  if (!files) throw new Error(`bundled skill source is missing: ${source}`);
  const expected = new Set<string>(BUNDLED_SKILL_FILES);
  if (files.size !== expected.size || [...files.keys()].some((file) => !expected.has(file))) {
    throw new Error("bundled skill inventory differs from the reviewed file set");
  }
  const hash = createHash("sha256");
  for (const file of BUNDLED_SKILL_FILES) {
    const bytes = files.get(file);
    if (!bytes) throw new Error(`bundled skill file is missing: ${file}`);
    if (bytes.length > 512 * 1024) throw new Error(`bundled skill file exceeds 512 KiB: ${file}`);
    hash.update(file).update("\0").update(bytes).update("\0");
  }
  return { files, digest: hash.digest("hex") };
}

async function assertSafeParents(root: string, destination: string): Promise<void> {
  await assertRealDirectory(root, "install scope root");
  const rel = relative(root, destination);
  if (rel === "" || rel.startsWith(`..${sep}`) || rel === ".." || rel.includes(`..${sep}`)) {
    throw new Error(`skill destination escapes its selected scope: ${destination}`);
  }
  let current = root;
  for (const segment of rel.split(sep).slice(0, -1)) {
    current = join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`skill destination parent is unsafe: ${current}`);
    } catch (error) {
      if (errnoCode(error) !== "ENOENT") throw error;
      break;
    }
  }
}

async function installedFiles(destination: string): Promise<Map<string, Buffer> | undefined> {
  try {
    const info = await lstat(destination);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`skill destination is unsafe: ${destination}`);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  }
  const files = new Map<string, Buffer>();
  const visit = async (directory: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`installed skill contains a symlink: ${relativePath}`);
      if (entry.isDirectory()) {
        await visit(path, relativePath);
      } else if (entry.isFile()) {
        files.set(relativePath, await readFile(path));
      } else {
        throw new Error(`installed skill contains an unsupported entry: ${relativePath}`);
      }
    }
  };
  await visit(destination, "");
  return files;
}

function sameSnapshot(actual: Map<string, Buffer>, expected: SkillSnapshot): boolean {
  if (actual.size !== expected.files.size) return false;
  for (const [file, bytes] of expected.files) {
    const installed = actual.get(file);
    if (!installed || !installed.equals(bytes)) return false;
  }
  return true;
}

async function writeStaging(parent: string, snapshot: SkillSnapshot): Promise<string> {
  const staging = join(parent, `.artifact-pages.install-${randomUUID()}`);
  await mkdir(staging, { recursive: false });
  try {
    for (const [file, bytes] of snapshot.files) {
      const path = join(staging, ...file.split("/"));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes, { flag: "wx" });
    }
    return staging;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export async function installBundledSkill(options: SkillInstallOptions): Promise<SkillInstallResult> {
  const source = resolve(options.sourceRoot ?? bundledSkillSource());
  const destination = skillDestination(options);
  const scopeRoot = resolve(options.scope === "project" ? options.projectRoot ?? process.cwd() : options.homeRoot ?? homedir());
  const snapshot = await snapshotSource(source);
  await assertSafeParents(scopeRoot, destination);
  const existing = await installedFiles(destination);
  const removal = `Remove manually only after review: ${destination}`;
  if (existing && sameSnapshot(existing, snapshot)) {
    return { schemaVersion: 1, status: "unchanged", destination, files: [...BUNDLED_SKILL_FILES], digest: snapshot.digest, removal };
  }
  if (existing && resolve(options.forceDestination ?? "") !== destination) {
    throw new Error(`skill destination differs and was left unchanged: ${destination}; retry with --force ${destination}`);
  }
  const parent = dirname(destination);
  await mkdir(parent, { recursive: true });
  await assertSafeParents(scopeRoot, destination);
  const staging = await writeStaging(parent, snapshot);
  let backup: string | undefined;
  try {
    if (existing) {
      backup = join(parent, `.artifact-pages.backup-${randomUUID()}`);
      await rename(destination, backup);
    }
    try {
      await rename(staging, destination);
    } catch (error) {
      if (backup) {
        try {
          await rename(backup, destination);
        } catch (restoreError) {
          throw new AggregateError([error, restoreError], `skill replacement failed and backup recovery requires manual action: ${backup}`);
        }
      }
      throw error;
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return {
    schemaVersion: 1,
    status: existing ? "replaced" : "installed",
    destination,
    files: [...BUNDLED_SKILL_FILES],
    digest: snapshot.digest,
    ...(backup === undefined ? {} : { backup }),
    removal,
  };
}
