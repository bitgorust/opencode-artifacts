import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  ARTIFACT_ID_RE,
  ARTIFACT_MANIFEST_FILE,
  ARTIFACT_MANIFEST_SCHEMA_VERSION,
  ARTIFACT_SLUG_RE,
  emptyArtifactManifestV2,
  readArtifactManifestV2,
  validateArtifactManifestV2,
  type ArtifactManifestV2,
  type ArtifactRecordV2,
  type RevisionRecordV2,
} from "./artifact-schema.ts";
import { recoverFileTransactions, runFileTransaction } from "./file-transaction.ts";
import { renderGallery } from "./gallery.ts";
import { DEFAULT_MAX_BYTES } from "./render.ts";
import type { ArtifactMeta, Manifest } from "./publisher.ts";

const MIGRATION_PLAN_SCHEMA_VERSION = 1;
const MAX_LEGACY_ARTIFACTS = 10_000;
const MAX_LEGACY_FILES = 50_000;
const COPY_BATCH_TARGETS = 32;
const UUID_RE = ARTIFACT_ID_RE;

export type MigrationIssueSeverity = "warning" | "error";

export interface ArtifactMigrationIssue {
  severity: MigrationIssueSeverity;
  code: string;
  artifact?: string;
  path?: string;
  detail: string;
}

export interface ArtifactMigrationCopy {
  sourcePath: string;
  targetPath: string;
  contentHash: string;
  bytes: number;
  purpose: "backup" | "revision";
}

export interface LegacyStateAssociation {
  path: string;
  artifactId: string;
  kind: "decisions" | "comments" | "collection" | "datasource";
}

export interface ArtifactMigrationPlan {
  schemaVersion: 1;
  migrationId: string;
  createdAt: string;
  sourceManifestExisted: boolean;
  sourceManifestHash: string | null;
  alreadyCurrent: boolean;
  canMigrate: boolean;
  manifest: ArtifactManifestV2 | null;
  copies: ArtifactMigrationCopy[];
  stateAssociations: LegacyStateAssociation[];
  issues: ArtifactMigrationIssue[];
}

export interface ArtifactMigrationOptions {
  artifactIdFactory?: () => string;
  migrationId?: string;
  now?: string;
}

export interface ArtifactMigrationResult {
  migrationId: string;
  status: "already-current" | "migrated" | "rolled-back";
  manifestHash: string | null;
  issues: ArtifactMigrationIssue[];
}

interface MigrationInventory {
  schemaVersion: 1;
  migrationId: string;
  sourceManifestExisted: boolean;
  sourceManifestHash: string | null;
  selectedManifestHash: string;
  originalIndexExisted: boolean;
  originalIndexHash: string | null;
  copies: ArtifactMigrationCopy[];
}

interface LegacyPage {
  sourcePath: string;
  legacyRevision?: number;
  bytes: number;
  contentHash: string;
  content: Uint8Array;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errnoCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validTimestamp(value: unknown): string | null {
  if (
    typeof value === "string" &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  ) {
    return value;
  }
  return null;
}

function legacyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 16_384 ? value : undefined;
}

function issue(
  issues: ArtifactMigrationIssue[],
  severity: MigrationIssueSeverity,
  code: string,
  detail: string,
  fields: { artifact?: string; path?: string } = {},
): void {
  issues.push({ severity, code, detail, ...fields });
}

async function readOptional(path: string): Promise<Uint8Array | undefined> {
  try {
    return await readFile(path);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

async function readBoundedSource(
  dir: string,
  relativePath: string,
  issues: ArtifactMigrationIssue[],
  artifact?: string,
): Promise<LegacyPage | undefined> {
  const path = join(dir, ...relativePath.split("/"));
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    issue(issues, "error", "unsafe-legacy-file", "legacy path is not a regular contained file", {
      artifact,
      path: relativePath,
    });
    return undefined;
  }
  if (info.size > DEFAULT_MAX_BYTES) {
    issue(
      issues,
      "error",
      "oversized-legacy-file",
      `legacy page has ${info.size} bytes; limit is ${DEFAULT_MAX_BYTES}`,
      { artifact, path: relativePath },
    );
    return undefined;
  }
  const content = await readFile(path);
  return {
    sourcePath: relativePath,
    bytes: content.byteLength,
    contentHash: sha256(content),
    content,
  };
}

function legacyVersions(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (entry): entry is number =>
          typeof entry === "number" && Number.isSafeInteger(entry) && entry > 0,
      ),
    ),
  ].sort((left, right) => left - right);
}

function revisionTimestamp(
  index: number,
  total: number,
  createdAt: string | null,
  updatedAt: string | null,
): { value: string | null; source: "legacy-artifact" | "unknown" } {
  if (index === total - 1 && updatedAt !== null) return { value: updatedAt, source: "legacy-artifact" };
  if (index === 0 && createdAt !== null) return { value: createdAt, source: "legacy-artifact" };
  return { value: null, source: "unknown" };
}

function asLegacyManifest(manifest: ArtifactManifestV2): Manifest {
  const artifacts: Record<string, ArtifactMeta> = {};
  for (const artifact of Object.values(manifest.artifacts)) {
    artifacts[artifact.slug] = {
      slug: artifact.slug,
      title: artifact.title,
      icon: artifact.icon,
      description: artifact.description,
      source: artifact.source,
      createdAt: artifact.createdAt ?? "unknown",
      updatedAt: artifact.updatedAt ?? "unknown",
      current: artifact.headRevision,
      versions: artifact.revisions.map((revision) => revision.revision),
      charts: artifact.charts,
      bytes: artifact.bytes,
      hash: artifact.contentHash.slice(0, 12),
    };
  }
  return { artifacts };
}

async function walkRegularFiles(
  dir: string,
  relativeRoot: string,
  issues: ArtifactMigrationIssue[],
): Promise<string[]> {
  const root = join(dir, ...relativeRoot.split("/"));
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return [];
    throw error;
  }
  const found: string[] = [];
  const pending = entries.map((entry) => `${relativeRoot}/${entry.name}`);
  while (pending.length > 0) {
    const relativePath = pending.shift();
    if (relativePath === undefined) break;
    if (found.length + pending.length > MAX_LEGACY_FILES) {
      issue(issues, "error", "legacy-file-limit", `legacy file inventory exceeds ${MAX_LEGACY_FILES}`);
      break;
    }
    const info = await lstat(join(dir, ...relativePath.split("/")));
    if (info.isSymbolicLink()) {
      issue(issues, "error", "unsafe-legacy-file", "legacy state contains a symbolic link", {
        path: relativePath,
      });
    } else if (info.isDirectory()) {
      const children = await readdir(join(dir, ...relativePath.split("/")), { withFileTypes: true });
      for (const child of children) pending.push(`${relativePath}/${child.name}`);
    } else if (info.isFile()) {
      found.push(relativePath);
    } else {
      issue(issues, "error", "unsafe-legacy-file", "legacy state contains an unsupported file type", {
        path: relativePath,
      });
    }
  }
  return found.sort();
}

function associationFor(
  path: string,
  slugIndex: Record<string, string>,
): LegacyStateAssociation | undefined {
  const stateMatch = /^\.state\/([a-z0-9]+(?:-[a-z0-9]+)*)\.(comments\.)?json$/.exec(path);
  if (stateMatch) {
    const artifactId = slugIndex[stateMatch[1]];
    if (!artifactId) return undefined;
    return {
      path,
      artifactId,
      kind: stateMatch[2] === undefined ? "decisions" : "comments",
    };
  }
  const dbMatch = /^\.db\/([a-z0-9]+(?:-[a-z0-9]+)*)\/[^/]+\.json$/.exec(path);
  if (dbMatch) {
    const artifactId = slugIndex[dbMatch[1]];
    return artifactId ? { path, artifactId, kind: "collection" } : undefined;
  }
  const datasourceMatch = /^\.datasources\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(path);
  if (datasourceMatch) {
    const artifactId = slugIndex[datasourceMatch[1]];
    return artifactId ? { path, artifactId, kind: "datasource" } : undefined;
  }
  return undefined;
}

export function mapLegacyCloudflareKey(
  key: string,
  siteId: string,
  slugIndex: Record<string, string>,
):
  | { siteId: string; artifactId: string; kind: "decisions" | "comments" | "collection"; collection?: string }
  | { issue: ArtifactMigrationIssue } {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteId)) {
    return {
      issue: {
        severity: "error",
        code: "invalid-site-id",
        detail: "site identity is not a safe canonical identifier",
      },
    };
  }
  const state = /^(state|comments):([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(key);
  if (state) {
    const artifactId = slugIndex[state[2]];
    if (artifactId) {
      return {
        siteId,
        artifactId,
        kind: state[1] === "state" ? "decisions" : "comments",
      };
    }
  }
  const collection = /^db:([a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(key);
  if (collection) {
    const artifactId = slugIndex[collection[1]];
    if (artifactId) {
      return { siteId, artifactId, kind: "collection", collection: collection[2] };
    }
  }
  return {
    issue: {
      severity: "error",
      code: "ambiguous-cloudflare-key",
      path: key,
      detail: "historical shared-KV key cannot be mapped to one known artifact",
    },
  };
}

export async function planArtifactMigration(
  dir: string,
  options: ArtifactMigrationOptions = {},
): Promise<ArtifactMigrationPlan> {
  await recoverFileTransactions(dir);
  const migrationId = options.migrationId ?? randomUUID();
  if (!UUID_RE.test(migrationId)) throw new Error("migrationId must be a UUID");
  const createdAt = options.now ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("migration time must be an ISO timestamp");
  const idFactory = options.artifactIdFactory ?? randomUUID;
  const issues: ArtifactMigrationIssue[] = [];
  const manifestPath = join(dir, ARTIFACT_MANIFEST_FILE);
  let manifestBytes: Uint8Array | undefined;
  try {
    const info = await lstat(manifestPath);
    if (info.isSymbolicLink() || !info.isFile()) {
      issue(issues, "error", "unsafe-legacy-file", "managed legacy path is not a regular file", {
        path: ARTIFACT_MANIFEST_FILE,
      });
    } else {
      manifestBytes = await readFile(manifestPath);
    }
  } catch (error) {
    if (errnoCode(error) !== "ENOENT") throw error;
  }
  const sourceManifestHash = manifestBytes === undefined ? null : sha256(manifestBytes);
  const base: Omit<ArtifactMigrationPlan, "alreadyCurrent" | "canMigrate" | "manifest" | "copies" | "stateAssociations"> = {
    schemaVersion: MIGRATION_PLAN_SCHEMA_VERSION,
    migrationId,
    createdAt,
    sourceManifestExisted: manifestBytes !== undefined,
    sourceManifestHash,
    issues,
  };

  let legacy: unknown = { artifacts: {} };
  if (manifestBytes !== undefined) {
    try {
      legacy = JSON.parse(Buffer.from(manifestBytes).toString("utf8")) as unknown;
    } catch (error) {
      issue(issues, "error", "malformed-manifest", error instanceof Error ? error.message : String(error), {
        path: ARTIFACT_MANIFEST_FILE,
      });
      return { ...base, alreadyCurrent: false, canMigrate: false, manifest: null, copies: [], stateAssociations: [] };
    }
  }
  if (isRecord(legacy) && legacy["schemaVersion"] === ARTIFACT_MANIFEST_SCHEMA_VERSION) {
    try {
      const manifest = validateArtifactManifestV2(legacy);
      return { ...base, alreadyCurrent: true, canMigrate: true, manifest, copies: [], stateAssociations: [] };
    } catch (error) {
      issue(issues, "error", "invalid-current-manifest", error instanceof Error ? error.message : String(error));
      return { ...base, alreadyCurrent: false, canMigrate: false, manifest: null, copies: [], stateAssociations: [] };
    }
  }
  if (isRecord(legacy) && typeof legacy["schemaVersion"] === "number") {
    issue(
      issues,
      "error",
      "unknown-future-schema",
      `schemaVersion ${String(legacy["schemaVersion"])} is not supported`,
      { path: ARTIFACT_MANIFEST_FILE },
    );
    return { ...base, alreadyCurrent: false, canMigrate: false, manifest: null, copies: [], stateAssociations: [] };
  }
  if (!isRecord(legacy) || !isRecord(legacy["artifacts"])) {
    issue(issues, "error", "invalid-legacy-manifest", "legacy manifest must contain an artifacts object");
    return { ...base, alreadyCurrent: false, canMigrate: false, manifest: null, copies: [], stateAssociations: [] };
  }

  const legacyArtifacts = Object.entries(legacy["artifacts"]);
  if (legacyArtifacts.length > MAX_LEGACY_ARTIFACTS) {
    issue(issues, "error", "legacy-artifact-limit", `legacy manifest exceeds ${MAX_LEGACY_ARTIFACTS} artifacts`);
  }
  const rootEntries = await readdir(dir, { withFileTypes: true }).catch((error: unknown) => {
    if (errnoCode(error) === "ENOENT") return [];
    throw error;
  });
  for (const entry of rootEntries) {
    if (
      entry.isSymbolicLink() &&
      (entry.name === ARTIFACT_MANIFEST_FILE ||
        entry.name === "index.html" ||
        /^([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/.test(entry.name) ||
        /^([a-z0-9]+(?:-[a-z0-9]+)*)\.v\d+\.html$/.test(entry.name))
    ) {
      issue(issues, "error", "unsafe-legacy-file", "managed legacy path is a symbolic link", {
        path: entry.name,
      });
    }
  }
  const rootFiles = new Set(rootEntries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const manifest = emptyArtifactManifestV2();
  const copies: ArtifactMigrationCopy[] = [];
  const sourceFiles = new Set<string>();
  if (manifestBytes !== undefined) sourceFiles.add(ARTIFACT_MANIFEST_FILE);
  if (rootFiles.has("index.html")) sourceFiles.add("index.html");
  const usedIds = new Set<string>();
  const knownSlugs = new Set<string>();

  for (const [key, rawMeta] of legacyArtifacts) {
    if (!ARTIFACT_SLUG_RE.test(key)) {
      issue(issues, "error", "invalid-legacy-slug", "legacy manifest key is not a safe slug", { artifact: key });
      continue;
    }
    knownSlugs.add(key);
    const meta = isRecord(rawMeta) ? rawMeta : {};
    if (typeof meta["slug"] === "string" && meta["slug"] !== key) {
      issue(issues, "warning", "legacy-slug-mismatch", "manifest key is used as the stable slug", {
        artifact: key,
      });
    }
    const id = idFactory();
    if (!UUID_RE.test(id) || usedIds.has(id)) {
      issue(issues, "error", "invalid-generated-id", "artifact ID factory returned an invalid or duplicate UUID", {
        artifact: key,
      });
      continue;
    }
    usedIds.add(id);

    const advertised = legacyVersions(meta["versions"]);
    const diskVersions = [...rootFiles]
      .map((name) => new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.v(\\d+)\\.html$`).exec(name))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => Number(match[1]))
      .filter((value) => Number.isSafeInteger(value) && value > 0)
      .sort((left, right) => left - right);
    for (const version of advertised) {
      if (!diskVersions.includes(version)) {
        issue(issues, "warning", "missing-advertised-revision", `advertised revision ${version} has no file`, {
          artifact: key,
          path: `${key}.v${version}.html`,
        });
      }
    }
    for (const version of diskVersions) {
      if (!advertised.includes(version)) {
        issue(issues, "warning", "orphan-revision-recovered", `unadvertised revision ${version} is recoverable`, {
          artifact: key,
          path: `${key}.v${version}.html`,
        });
      }
    }

    const pages: LegacyPage[] = [];
    for (const version of diskVersions) {
      const relativePath = `${key}.v${version}.html`;
      const page = await readBoundedSource(dir, relativePath, issues, key);
      if (page) {
        pages.push({ ...page, legacyRevision: version });
        sourceFiles.add(relativePath);
      }
    }
    const stablePath = `${key}.html`;
    const stable = await readBoundedSource(dir, stablePath, issues, key);
    if (stable) sourceFiles.add(stablePath);
    const legacyCurrent =
      typeof meta["current"] === "number" && Number.isSafeInteger(meta["current"]) && meta["current"] > 0
        ? meta["current"]
        : undefined;
    let selected = stable;
    if (!selected && legacyCurrent !== undefined) {
      selected = pages.find((page) => page.legacyRevision === legacyCurrent);
    }
    selected ??= pages.at(-1);
    if (!selected) {
      issue(issues, "error", "irrecoverable-legacy-artifact", "no stable or revision page bytes exist", {
        artifact: key,
      });
      continue;
    }
    if (!stable) {
      issue(issues, "warning", "missing-stable-head", "stable page is missing; selected recoverable revision is used", {
        artifact: key,
        path: stablePath,
      });
    }
    if (legacyCurrent !== undefined && !pages.some((page) => page.legacyRevision === legacyCurrent)) {
      issue(issues, "warning", "missing-current-revision", `current revision ${legacyCurrent} is not retained`, {
        artifact: key,
      });
    }
    if (pages.at(-1)?.contentHash !== selected.contentHash) {
      pages.push({ ...selected, legacyRevision: legacyCurrent ?? selected.legacyRevision });
      issue(
        issues,
        "warning",
        "selected-head-materialized",
        "selected legacy head is materialized as a new final revision to preserve history ordering",
        { artifact: key },
      );
    }

    const titleValue = legacyString(meta["title"]);
    const iconValue = legacyString(meta["icon"]);
    if (meta["title"] !== undefined && titleValue === undefined) {
      issue(issues, "error", "invalid-legacy-title", "legacy title is not representable", { artifact: key });
      continue;
    }
    if (meta["icon"] !== undefined && iconValue === undefined) {
      issue(issues, "error", "invalid-legacy-icon", "legacy icon is not representable", { artifact: key });
      continue;
    }
    const title = titleValue && titleValue.length > 0 ? titleValue : key;
    const icon = iconValue && iconValue.length > 0 ? iconValue : "📄";
    if (!titleValue) issue(issues, "warning", "defaulted-legacy-title", "missing title defaults to exact slug", { artifact: key });
    if (!iconValue) issue(issues, "warning", "defaulted-legacy-icon", "missing icon defaults to the legacy document icon", { artifact: key });
    const description = legacyString(meta["description"]);
    const source = legacyString(meta["source"]);
    const author = legacyString(meta["author"]);
    const createdAt = validTimestamp(meta["createdAt"]);
    const updatedAt = validTimestamp(meta["updatedAt"]);
    if (meta["createdAt"] !== undefined && createdAt === null) {
      issue(issues, "warning", "unknown-created-time", "invalid legacy createdAt is retained as unknown", { artifact: key });
    }
    if (meta["updatedAt"] !== undefined && updatedAt === null) {
      issue(issues, "warning", "unknown-updated-time", "invalid legacy updatedAt is retained as unknown", { artifact: key });
    }
    const charts =
      typeof meta["charts"] === "number" && Number.isSafeInteger(meta["charts"]) && meta["charts"] >= 0
        ? meta["charts"]
        : 0;
    const revisions: RevisionRecordV2[] = [];
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      const revision = index + 1;
      const timestamp = revisionTimestamp(index, pages.length, createdAt, updatedAt);
      const pagePath = `revisions/${id}/${revision}.html`;
      revisions.push({
        revision,
        createdAt: timestamp.value,
        bytes: page.bytes,
        contentHash: page.contentHash,
        pagePath,
        title,
        icon,
        description,
        source,
        author,
        charts,
        provenance: {
          kind: "migration",
          legacyRevision: page.legacyRevision,
          timestampSource: timestamp.source,
        },
      });
      copies.push({
        sourcePath: page.sourcePath,
        targetPath: pagePath,
        contentHash: page.contentHash,
        bytes: page.bytes,
        purpose: "revision",
      });
    }
    const head = revisions.at(-1);
    if (!head) continue;
    const record: ArtifactRecordV2 = {
      id,
      slug: key,
      title,
      icon,
      description,
      source,
      author,
      createdAt,
      updatedAt: head.createdAt,
      headRevision: head.revision,
      revisions,
      charts,
      bytes: head.bytes,
      contentHash: head.contentHash,
      deploymentReferences: [],
    };
    manifest.artifacts[id] = record;
    manifest.slugIndex[key] = id;
  }

  for (const name of rootFiles) {
    const stableMatch = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/.exec(name);
    const versionMatch = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.v\d+\.html$/.exec(name);
    const slug = versionMatch?.[1] ?? (name === "index.html" ? undefined : stableMatch?.[1]);
    if (slug && !knownSlugs.has(slug)) {
      issue(issues, "warning", "untracked-page", "HTML file is preserved but not attached to an artifact", {
        artifact: slug,
        path: name,
      });
      sourceFiles.add(name);
    }
  }

  const internalFiles = (
    await Promise.all(
      [".state", ".db", ".datasources"].map((root) => walkRegularFiles(dir, root, issues)),
    )
  ).flat();
  const stateAssociations: LegacyStateAssociation[] = [];
  for (const path of internalFiles) {
    sourceFiles.add(path);
    const association = associationFor(path, manifest.slugIndex);
    if (association) stateAssociations.push(association);
    else {
      issue(issues, "warning", "unmapped-local-state", "local state is backed up but cannot be mapped to one artifact", {
        path,
      });
    }
  }

  for (const sourcePath of [...sourceFiles].sort()) {
    const content = await readBoundedSource(dir, sourcePath, issues);
    if (!content) continue;
    copies.push({
      sourcePath,
      targetPath: `.backups/migrations/${migrationId}/files/${sourcePath}`,
      contentHash: content.contentHash,
      bytes: content.bytes,
      purpose: "backup",
    });
  }

  try {
    validateArtifactManifestV2(manifest);
  } catch (error) {
    issue(issues, "error", "generated-manifest-invalid", error instanceof Error ? error.message : String(error));
  }
  const canMigrate = !issues.some((entry) => entry.severity === "error");
  return {
    ...base,
    alreadyCurrent: false,
    canMigrate,
    manifest,
    copies,
    stateAssociations,
  };
}

function migrationReport(plan: ArtifactMigrationPlan): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      migrationId: plan.migrationId,
      createdAt: plan.createdAt,
      canMigrate: plan.canMigrate,
      sourceManifestHash: plan.sourceManifestHash,
      artifacts: plan.manifest ? Object.keys(plan.manifest.artifacts).length : 0,
      copies: plan.copies.length,
      stateAssociations: plan.stateAssociations,
      issues: plan.issues,
    },
    null,
    2,
  )}\n`;
}

function parseInventory(value: unknown): MigrationInventory {
  if (
    !isRecord(value) ||
    value["schemaVersion"] !== 1 ||
    typeof value["migrationId"] !== "string" ||
    !UUID_RE.test(value["migrationId"]) ||
    typeof value["sourceManifestExisted"] !== "boolean" ||
    (value["sourceManifestHash"] !== null && typeof value["sourceManifestHash"] !== "string") ||
    typeof value["selectedManifestHash"] !== "string" ||
    typeof value["originalIndexExisted"] !== "boolean" ||
    (value["originalIndexHash"] !== null && typeof value["originalIndexHash"] !== "string") ||
    !Array.isArray(value["copies"])
  ) {
    throw new Error("migration inventory is invalid");
  }
  return value as unknown as MigrationInventory;
}

export async function executeArtifactMigration(
  dir: string,
  plan: ArtifactMigrationPlan,
): Promise<ArtifactMigrationResult> {
  if (plan.alreadyCurrent) {
    return {
      migrationId: plan.migrationId,
      status: "already-current",
      manifestHash: plan.manifest ? sha256(`${JSON.stringify(plan.manifest, null, 2)}\n`) : null,
      issues: plan.issues,
    };
  }
  if (!plan.canMigrate || !plan.manifest) {
    throw new Error("artifact migration preflight failed; inspect the repair report before retrying");
  }
  const targetManifest = plan.manifest;
  validateArtifactManifestV2(targetManifest);
  const manifestText = `${JSON.stringify(targetManifest, null, 2)}\n`;
  const selectedManifestHash = sha256(manifestText);
  const currentManifest = await readOptional(join(dir, ARTIFACT_MANIFEST_FILE));
  const currentHash = currentManifest === undefined ? null : sha256(currentManifest);
  if (currentHash !== plan.sourceManifestHash) {
    if (currentHash === selectedManifestHash) {
      return {
        migrationId: plan.migrationId,
        status: "migrated",
        manifestHash: selectedManifestHash,
        issues: plan.issues,
      };
    }
    throw new Error("artifact migration source changed after preflight; regenerate the plan");
  }

  for (let offset = 0; offset < plan.copies.length; offset += COPY_BATCH_TARGETS) {
    const batch = plan.copies.slice(offset, offset + COPY_BATCH_TARGETS);
    await runFileTransaction(dir, async (transaction) => {
      const files = new Map<string, Uint8Array>();
      for (const copy of batch) {
        const existing = await readOptional(join(dir, ...copy.targetPath.split("/")));
        if (existing !== undefined) {
          if (sha256(existing) !== copy.contentHash) {
            throw new Error(`migration target already exists with different bytes: ${copy.targetPath}`);
          }
          continue;
        }
        const source = await readFile(join(dir, ...copy.sourcePath.split("/")));
        if (source.byteLength !== copy.bytes || sha256(source) !== copy.contentHash) {
          throw new Error(`migration source changed after preflight: ${copy.sourcePath}`);
        }
        files.set(copy.targetPath, source);
      }
      if (files.size > 0) await transaction.commit(files);
    });
  }

  const originalIndexCopy = plan.copies.find(
    (copy) => copy.purpose === "backup" && copy.sourcePath === "index.html",
  );
  const inventory: MigrationInventory = {
    schemaVersion: 1,
    migrationId: plan.migrationId,
    sourceManifestExisted: plan.sourceManifestExisted,
    sourceManifestHash: plan.sourceManifestHash,
    selectedManifestHash,
    originalIndexExisted: originalIndexCopy !== undefined,
    originalIndexHash: originalIndexCopy?.contentHash ?? null,
    copies: plan.copies,
  };
  const inventoryText = `${JSON.stringify(inventory, null, 2)}\n`;
  await runFileTransaction(dir, async (transaction) => {
    const liveManifest = await readOptional(join(dir, ARTIFACT_MANIFEST_FILE));
    const liveHash = liveManifest === undefined ? null : sha256(liveManifest);
    if (liveHash !== plan.sourceManifestHash) {
      throw new Error("artifact migration source changed before selection");
    }
    for (const source of new Map(plan.copies.map((copy) => [copy.sourcePath, copy])).values()) {
      const live = await readFile(join(dir, ...source.sourcePath.split("/")));
      if (live.byteLength !== source.bytes || sha256(live) !== source.contentHash) {
        throw new Error(`migration source changed before selection: ${source.sourcePath}`);
      }
    }
    for (const copy of plan.copies.filter((entry) => entry.purpose === "revision")) {
      const prepared = await readFile(join(dir, ...copy.targetPath.split("/")));
      if (sha256(prepared) !== copy.contentHash) {
        throw new Error(`prepared revision failed verification: ${copy.targetPath}`);
      }
    }
    await transaction.commit(
      new Map([
        [ARTIFACT_MANIFEST_FILE, manifestText],
        ["index.html", renderGallery(asLegacyManifest(targetManifest))],
        [`.backups/migrations/${plan.migrationId}/inventory.json`, inventoryText],
        [`.migrations/${plan.migrationId}/report.json`, migrationReport(plan)],
      ]),
    );
  });
  const selected = await readArtifactManifestV2(dir);
  if (sha256(`${JSON.stringify(selected, null, 2)}\n`) !== selectedManifestHash) {
    throw new Error("selected artifact manifest failed post-migration verification");
  }
  return {
    migrationId: plan.migrationId,
    status: "migrated",
    manifestHash: selectedManifestHash,
    issues: plan.issues,
  };
}

export async function rollbackArtifactMigration(
  dir: string,
  migrationId: string,
): Promise<ArtifactMigrationResult> {
  if (!UUID_RE.test(migrationId)) throw new Error("migrationId must be a UUID");
  const inventoryPath = `.backups/migrations/${migrationId}/inventory.json`;
  const inventory = parseInventory(
    JSON.parse(await readFile(join(dir, ...inventoryPath.split("/")), "utf8")) as unknown,
  );
  const liveManifest = await readFile(join(dir, ARTIFACT_MANIFEST_FILE));
  if (sha256(liveManifest) !== inventory.selectedManifestHash) {
    throw new Error("selected manifest changed after migration; rollback requires a new preflight");
  }
  const manifestBackupPath = `.backups/migrations/${migrationId}/files/${ARTIFACT_MANIFEST_FILE}`;
  const indexBackupPath = `.backups/migrations/${migrationId}/files/index.html`;
  const oldManifest = inventory.sourceManifestExisted
    ? await readFile(join(dir, ...manifestBackupPath.split("/")))
    : null;
  const oldIndex = inventory.originalIndexExisted
    ? await readFile(join(dir, ...indexBackupPath.split("/")))
    : null;
  if (
    (oldManifest !== null && sha256(oldManifest) !== inventory.sourceManifestHash) ||
    (oldIndex !== null && sha256(oldIndex) !== inventory.originalIndexHash)
  ) {
    throw new Error("migration backup verification failed; rollback made no changes");
  }
  await runFileTransaction(dir, (transaction) =>
    transaction.commit(
      new Map<string, string | Uint8Array | null>([
        [ARTIFACT_MANIFEST_FILE, oldManifest],
        ["index.html", oldIndex],
      ]),
    ),
  );
  const restoredManifest = await readOptional(join(dir, ARTIFACT_MANIFEST_FILE));
  const restoredHash = restoredManifest === undefined ? null : sha256(restoredManifest);
  if (restoredHash !== inventory.sourceManifestHash) {
    throw new Error("migration rollback post-verification failed");
  }
  return {
    migrationId,
    status: "rolled-back",
    manifestHash: restoredHash,
    issues: [],
  };
}
