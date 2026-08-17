import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  ARTIFACT_ID_RE,
  ARTIFACT_MANIFEST_FILE,
  ARTIFACT_SLUG_RE,
  CONTENT_HASH_RE,
  emptyArtifactManifestV2,
  parseArtifactManifestV2,
  validateArtifactManifestV2,
  type ArtifactManifestV2,
  type ArtifactRecordV2,
  type AuthoringSourceReferenceV2,
  type RevisionRecordV2,
} from "./artifact-schema.ts";
import { runFileTransaction, recoverFileTransactions, type FileTransactionContext } from "./file-transaction.ts";
import { renderGallery } from "./gallery.ts";
import {
  applyArtifactFooter,
  fullContentHash,
  type ArtifactMeta,
  type Manifest,
} from "./publisher.ts";
import { ArtifactTooLargeError, DEFAULT_MAX_BYTES } from "./render.ts";
import { validateArtifactStateEnvelope } from "./artifact-state.ts";

const MAX_LIST_RESULTS = 1_000;
const MAX_INLINE_MERGE_BYTES = 256 * 1024;
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const ARCHIVE_TOKEN_TTL_MS = 15 * 60 * 1_000;
const HASH_PREFIX_RE = /^[0-9a-f]{12}$/;

export class ArtifactReferenceError extends Error {
  readonly reference: string;

  constructor(reference: string, message: string) {
    super(`${message}; accepted references are an exact artifact ID, active slug, contained artifact path, or registered deployment URL`);
    this.name = "ArtifactReferenceError";
    this.reference = reference;
  }
}

export class ArtifactLifecycleConflictError extends Error {
  readonly artifact: ArtifactLifecycleStatus;
  readonly merge: ArtifactMergePayload;

  constructor(message: string, artifact: ArtifactLifecycleStatus, merge: ArtifactMergePayload) {
    super(message);
    this.name = "ArtifactLifecycleConflictError";
    this.artifact = artifact;
    this.merge = merge;
  }
}

export interface ArtifactMergePayload {
  schemaVersion: 1;
  format: "markdown" | "html";
  bytes: number;
  contentHash: string;
  inline?: string;
  preview?: string;
  pinnedPath?: string;
}

export interface ArtifactLifecycleStatus {
  schemaVersion: 1;
  id: string;
  slug: string;
  active: boolean;
  headRevision: number;
  contentHash: string;
  bytes: number;
  title: string;
  icon: string;
  updatedAt: string | null;
  visibility: "local";
  capabilities: Array<"portable-local" | "public-static" | "authenticated" | "connector-capable">;
  deploymentReferences: ArtifactRecordV2["deploymentReferences"];
  stablePath: string | null;
}

export interface LifecycleWriteInput {
  artifact?: string;
  slug: string;
  html: string;
  title?: string;
  icon?: string;
  description?: string;
  source?: string;
  author?: string;
  charts?: number;
  expectedRevision?: number;
  expectedHash?: string;
  authoringSource?: string;
  inputFormat?: "markdown" | "html";
  now?: string;
}

export interface ArchivePreview {
  schemaVersion: 1;
  token: string;
  expiresAt: string;
  scopeHash: string;
  artifact: ArtifactLifecycleStatus;
  revisionCount: number;
  stateStoreCount: number;
  retainedBytes: number;
  externalCopiesDeleted: false;
  recovery: "unarchive-by-id";
}

interface StoredArchivePreview extends ArchivePreview {
  createdAt: string;
}

interface ArchivedArtifactRecord {
  schemaVersion: 1;
  archivedAt: string;
  previewScopeHash: string;
  artifact: ArtifactRecordV2;
}

interface ArtifactBundleFile {
  path: string;
  bytes: number;
  contentHash: string;
}

interface ArtifactBundleManifest {
  schemaVersion: 1;
  artifact: ArtifactRecordV2;
  files: ArtifactBundleFile[];
}

function errnoCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function validTimestamp(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function galleryManifest(manifest: ArtifactManifestV2): Manifest {
  const artifacts: Manifest["artifacts"] = {};
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

async function readManifestLocked(root: string): Promise<ArtifactManifestV2> {
  const path = join(root, ARTIFACT_MANIFEST_FILE);
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error("artifact manifest path is unsafe");
    return parseArtifactManifestV2(await readFile(path, "utf8"));
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return emptyArtifactManifestV2();
    throw error;
  }
}

function statusFor(root: string, artifact: ArtifactRecordV2, active: boolean): ArtifactLifecycleStatus {
  const capabilities = new Set<ArtifactLifecycleStatus["capabilities"][number]>(["portable-local"]);
  for (const deployment of artifact.deploymentReferences) capabilities.add(deployment.capability);
  return {
    schemaVersion: 1,
    id: artifact.id,
    slug: artifact.slug,
    active,
    headRevision: artifact.headRevision,
    contentHash: artifact.contentHash,
    bytes: artifact.bytes,
    title: artifact.title,
    icon: artifact.icon,
    updatedAt: artifact.updatedAt,
    visibility: "local",
    capabilities: [...capabilities],
    deploymentReferences: artifact.deploymentReferences,
    stablePath: active ? join(root, `${artifact.slug}.html`) : null,
  };
}

function uniqueMatch(reference: string, matches: ArtifactRecordV2[]): ArtifactRecordV2 {
  if (matches.length === 0) throw new ArtifactReferenceError(reference, "artifact reference did not resolve");
  if (matches.length > 1) throw new ArtifactReferenceError(reference, "artifact reference is ambiguous");
  return matches[0];
}

async function resolveActiveLocked(
  root: string,
  manifest: ArtifactManifestV2,
  reference: string,
): Promise<ArtifactRecordV2> {
  if (reference.length === 0 || reference.length > 16_384 || reference.includes("\0")) {
    throw new ArtifactReferenceError(reference, "artifact reference is invalid or oversized");
  }
  if (ARTIFACT_ID_RE.test(reference)) {
    const artifact = manifest.artifacts[reference];
    if (!artifact) throw new ArtifactReferenceError(reference, "artifact ID is not active");
    return artifact;
  }
  if (ARTIFACT_SLUG_RE.test(reference)) {
    const id = manifest.slugIndex[reference];
    if (!id) throw new ArtifactReferenceError(reference, "artifact slug is not active");
    return manifest.artifacts[id];
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) {
    let url: URL;
    try {
      url = new URL(reference);
    } catch {
      throw new ArtifactReferenceError(reference, "artifact URL is malformed");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new ArtifactReferenceError(reference, "artifact URL scheme is unsupported");
    }
    return uniqueMatch(reference, Object.values(manifest.artifacts).filter((artifact) => artifact.deploymentReferences.some((deployment) => deployment.url === url.href)));
  }
  if (reference.includes("%") || reference.includes("\\")) {
    throw new ArtifactReferenceError(reference, "encoded or backslash artifact paths are refused");
  }
  const candidate = resolve(root, reference);
  const rootPath = resolve(root);
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}${sep}`)) {
    throw new ArtifactReferenceError(reference, "artifact path escapes the store");
  }
  const info = await lstat(candidate).catch((error: unknown) => {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  });
  if (!info || info.isSymbolicLink() || !info.isFile()) {
    throw new ArtifactReferenceError(reference, "artifact path is absent or unsafe");
  }
  const local = relative(rootPath, candidate).split(sep).join("/");
  const canonical = /^revisions\/([0-9a-f-]{36})\/(\d+)\.html$/.exec(local);
  if (canonical && ARTIFACT_ID_RE.test(canonical[1])) {
    const artifact = manifest.artifacts[canonical[1]];
    if (artifact?.revisions.some((revision) => revision.pagePath === local)) return artifact;
  }
  const stable = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.html$/.exec(local);
  if (stable) {
    const id = manifest.slugIndex[stable[1]];
    if (id) return manifest.artifacts[id];
  }
  const legacyRevision = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.v(\d+)\.html$/.exec(local);
  if (legacyRevision) {
    const id = manifest.slugIndex[legacyRevision[1]];
    const artifact = id ? manifest.artifacts[id] : undefined;
    if (artifact?.revisions.some((revision) => revision.revision === Number(legacyRevision[2]))) return artifact;
  }
  throw new ArtifactReferenceError(reference, "contained path is not a registered artifact reference");
}

async function verifiedRevisionBytes(root: string, artifact: ArtifactRecordV2, revision: RevisionRecordV2): Promise<string> {
  const path = join(root, ...revision.pagePath.split("/"));
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`revision ${revision.revision} path is unsafe`);
  const html = await readFile(path, "utf8");
  if (Buffer.byteLength(html, "utf8") !== revision.bytes || fullContentHash(html) !== revision.contentHash) {
    throw new Error(`revision ${revision.revision} for artifact ${artifact.id} failed integrity verification`);
  }
  return html;
}

async function mergePayload(root: string, artifact: ArtifactRecordV2): Promise<ArtifactMergePayload> {
  const revision = artifact.revisions.at(-1);
  if (!revision) throw new Error("artifact has no head revision");
  let format: "markdown" | "html" = "html";
  let path = revision.pagePath;
  let contentHash = revision.contentHash;
  let bytes = revision.bytes;
  if (revision.authoringSource) {
    format = revision.authoringSource.format;
    path = revision.authoringSource.path;
    contentHash = revision.authoringSource.contentHash;
    bytes = revision.authoringSource.bytes;
  }
  const value = await readFile(join(root, ...path.split("/")), "utf8");
  if (Buffer.byteLength(value, "utf8") !== bytes || sha256(value) !== contentHash) throw new Error("merge source failed integrity verification");
  if (bytes <= MAX_INLINE_MERGE_BYTES) return { schemaVersion: 1, format, bytes, contentHash, inline: value };
  return {
    schemaVersion: 1,
    format,
    bytes,
    contentHash,
    preview: `${value.slice(0, 8_192)}\n…\n${value.slice(-8_192)}`,
    pinnedPath: join(root, ...path.split("/")),
  };
}

function expectedMatches(artifact: ArtifactRecordV2, revision: number | undefined, hash: string | undefined): boolean {
  if (revision !== undefined && artifact.headRevision !== revision) return false;
  if (hash !== undefined && artifact.contentHash !== hash && artifact.contentHash.slice(0, 12) !== hash) return false;
  return true;
}

function validateWriteInput(input: LifecycleWriteInput): string {
  if (!ARTIFACT_SLUG_RE.test(input.slug)) throw new Error("slug must be a safe lowercase identifier");
  if (input.expectedRevision !== undefined && (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0)) throw new Error("expectedRevision must be a non-negative integer");
  if (input.expectedHash !== undefined && !CONTENT_HASH_RE.test(input.expectedHash) && !HASH_PREFIX_RE.test(input.expectedHash)) throw new Error("expectedHash must be a full or 12-character SHA-256 digest");
  const now = input.now ?? new Date().toISOString();
  if (!validTimestamp(now)) throw new Error("lifecycle timestamp must be an ISO timestamp with timezone");
  if (input.authoringSource !== undefined && Buffer.byteLength(input.authoringSource, "utf8") > MAX_SOURCE_BYTES) throw new Error(`authoring source exceeds ${MAX_SOURCE_BYTES} bytes`);
  if (input.authoringSource !== undefined && input.inputFormat === undefined) throw new Error("inputFormat is required with authoringSource");
  return now;
}

function bundleSegments(path: string): string[] {
  if (path === "" || path.includes("\\") || path.startsWith("/") || path.endsWith("/") || path.includes("%")) throw new Error(`unsafe bundle path ${JSON.stringify(path)}`);
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) throw new Error(`unsafe bundle path ${JSON.stringify(path)}`);
  return segments;
}

async function optionalRegularFile(path: string, maxBytes = 17 * 1024 * 1024): Promise<Uint8Array | undefined> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error(`bundle/store path is unsafe: ${path}`);
    if (info.size > maxBytes) throw new Error(`bundle/store file exceeds ${maxBytes} bytes: ${path}`);
    return await readFile(path);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

async function inventoryBundleFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const pending = [""];
  while (pending.length > 0) {
    const current = pending.shift();
    if (current === undefined) break;
    const entries = await readdir(current === "" ? root : join(root, ...current.split("/")), { withFileTypes: true });
    for (const entry of entries) {
      const path = current === "" ? entry.name : `${current}/${entry.name}`;
      bundleSegments(path);
      if (entry.isSymbolicLink()) throw new Error(`bundle contains symbolic link ${path}`);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`bundle contains unsupported entry ${path}`);
      if (files.length + pending.length > 20_101) throw new Error("artifact bundle exceeds the file-count limit");
    }
  }
  return files.sort();
}

function parseBundleManifest(value: unknown): ArtifactBundleManifest {
  if (!isRecord(value) || value["schemaVersion"] !== 1 || !isRecord(value["artifact"]) || !Array.isArray(value["files"]) || Object.keys(value).some((key) => key !== "schemaVersion" && key !== "artifact" && key !== "files")) throw new Error("artifact bundle manifest is malformed or from an unsupported future schema");
  const artifact = value["artifact"] as unknown as ArtifactRecordV2;
  validateArtifactManifestV2({ schemaVersion: 2, artifacts: { [artifact.id]: artifact }, slugIndex: { [artifact.slug]: artifact.id } });
  const files: ArtifactBundleFile[] = [];
  const paths = new Set<string>();
  for (const entry of value["files"]) {
    if (!isRecord(entry) || Object.keys(entry).some((key) => key !== "path" && key !== "bytes" && key !== "contentHash") || typeof entry["path"] !== "string" || typeof entry["bytes"] !== "number" || !Number.isSafeInteger(entry["bytes"]) || entry["bytes"] < 0 || typeof entry["contentHash"] !== "string" || !CONTENT_HASH_RE.test(entry["contentHash"]) || paths.has(entry["path"])) throw new Error("artifact bundle file inventory is malformed");
    bundleSegments(entry["path"]);
    paths.add(entry["path"]);
    files.push({ path: entry["path"], bytes: entry["bytes"], contentHash: entry["contentHash"] });
  }
  if (files.length > 20_100) throw new Error("artifact bundle exceeds the file-count limit");
  return { schemaVersion: 1, artifact, files };
}

export class ArtifactLifecycleStore {
  private readonly root: string;
  private readonly artifactIdFactory: () => string;

  constructor(root: string, options: { artifactIdFactory?: () => string } = {}) {
    this.root = resolve(root);
    this.artifactIdFactory = options.artifactIdFactory ?? randomUUID;
  }

  async list(): Promise<ArtifactLifecycleStatus[]> {
    await recoverFileTransactions(this.root);
    const manifest = await readManifestLocked(this.root);
    const artifacts = Object.values(manifest.artifacts);
    if (artifacts.length > MAX_LIST_RESULTS) throw new Error(`artifact list exceeds bounded result limit ${MAX_LIST_RESULTS}`);
    return artifacts.sort((left, right) => left.slug.localeCompare(right.slug)).map((artifact) => statusFor(this.root, artifact, true));
  }

  async status(reference: string): Promise<ArtifactLifecycleStatus> {
    await recoverFileTransactions(this.root);
    const manifest = await readManifestLocked(this.root);
    try {
      return statusFor(this.root, await resolveActiveLocked(this.root, manifest, reference), true);
    } catch (error) {
      if (!ARTIFACT_ID_RE.test(reference)) throw error;
      const archived = await this.readArchive(reference);
      if (!archived) throw error;
      return statusFor(this.root, archived.artifact, false);
    }
  }

  async read(reference: string, revision?: number): Promise<{ status: ArtifactLifecycleStatus; revision: RevisionRecordV2; html: string }> {
    await recoverFileTransactions(this.root);
    const manifest = await readManifestLocked(this.root);
    const artifact = await resolveActiveLocked(this.root, manifest, reference);
    const selected = revision === undefined ? artifact.revisions.at(-1) : artifact.revisions.find((entry) => entry.revision === revision);
    if (!selected) throw new Error(`artifact ${artifact.id} has no revision ${String(revision)}`);
    return { status: statusFor(this.root, artifact, true), revision: selected, html: await verifiedRevisionBytes(this.root, artifact, selected) };
  }

  async write(input: LifecycleWriteInput): Promise<ArtifactLifecycleStatus> {
    const now = validateWriteInput(input);
    return runFileTransaction(this.root, async (transaction) => {
      const manifest = await readManifestLocked(this.root);
      const existing = input.artifact === undefined ? undefined : await resolveActiveLocked(this.root, manifest, input.artifact);
      if (existing === undefined && manifest.slugIndex[input.slug]) {
        const collision = manifest.artifacts[manifest.slugIndex[input.slug]];
        throw new ArtifactLifecycleConflictError("create refused because the slug already belongs to an artifact; update requires its exact reference and expected head", statusFor(this.root, collision, true), await mergePayload(this.root, collision));
      }
      if (existing !== undefined && input.expectedRevision === undefined && input.expectedHash === undefined) {
        throw new ArtifactLifecycleConflictError("update requires expectedRevision or expectedHash; the current artifact remains unchanged", statusFor(this.root, existing, true), await mergePayload(this.root, existing));
      }
      if (existing !== undefined && !expectedMatches(existing, input.expectedRevision, input.expectedHash)) {
        throw new ArtifactLifecycleConflictError("update precondition is stale; the current artifact remains unchanged", statusFor(this.root, existing, true), await mergePayload(this.root, existing));
      }
      const occupied = manifest.slugIndex[input.slug];
      if (existing && occupied && occupied !== existing.id) throw new Error(`slug ${input.slug} belongs to another artifact`);
      const id = existing?.id ?? this.artifactIdFactory();
      if (!ARTIFACT_ID_RE.test(id) || (!existing && manifest.artifacts[id])) throw new Error("artifact ID factory returned an invalid or duplicate UUID");
      const revisionNumber = (existing?.headRevision ?? 0) + 1;
      const title = input.title ?? existing?.title ?? input.slug;
      const icon = input.icon ?? existing?.icon ?? "📄";
      const description = input.description ?? existing?.description;
      const source = input.source ?? existing?.source;
      const author = input.author ?? existing?.author;
      const charts = input.charts ?? existing?.charts ?? 0;
      const meta: ArtifactMeta = {
        slug: input.slug,
        title,
        icon,
        description,
        source,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        current: revisionNumber,
        versions: Array.from({ length: revisionNumber }, (_, index) => index + 1),
        charts,
        bytes: Buffer.byteLength(input.html, "utf8"),
        hash: "",
      };
      const html = applyArtifactFooter(input.html, meta);
      const bytes = Buffer.byteLength(html, "utf8");
      if (bytes > DEFAULT_MAX_BYTES) throw new ArtifactTooLargeError(bytes, DEFAULT_MAX_BYTES);
      const contentHash = fullContentHash(html);
      let authoringSource: AuthoringSourceReferenceV2 | undefined;
      if (input.authoringSource !== undefined && input.inputFormat !== undefined) {
        authoringSource = {
          format: input.inputFormat,
          path: `.sources/${id}/${revisionNumber}.${input.inputFormat}.txt`,
          bytes: Buffer.byteLength(input.authoringSource, "utf8"),
          contentHash: sha256(input.authoringSource),
        };
      }
      const revision: RevisionRecordV2 = {
        revision: revisionNumber,
        createdAt: now,
        bytes,
        contentHash,
        pagePath: `revisions/${id}/${revisionNumber}.html`,
        title,
        icon,
        description,
        source,
        author,
        charts,
        provenance: { kind: existing ? "update" : "create", timestampSource: "recorded" },
        authoringSource,
      };
      const record: ArtifactRecordV2 = {
        id,
        slug: input.slug,
        title,
        icon,
        description,
        source,
        author,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        headRevision: revisionNumber,
        revisions: [...(existing?.revisions ?? []), revision],
        charts,
        bytes,
        contentHash,
        deploymentReferences: existing?.deploymentReferences ?? [],
      };
      if (existing && existing.slug !== input.slug) delete manifest.slugIndex[existing.slug];
      manifest.artifacts[id] = record;
      manifest.slugIndex[input.slug] = id;
      validateArtifactManifestV2(manifest);
      const files = new Map<string, string | Uint8Array | null>([
        [`${input.slug}.html`, html],
        [`${input.slug}.v${revisionNumber}.html`, html],
        [revision.pagePath, html],
        [ARTIFACT_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`],
        ["index.html", renderGallery(galleryManifest(manifest))],
      ]);
      if (authoringSource && input.authoringSource !== undefined) files.set(authoringSource.path, input.authoringSource);
      if (existing && existing.slug !== input.slug) files.set(`${existing.slug}.html`, null);
      await transaction.commit(files);
      return statusFor(this.root, record, true);
    });
  }

  async restore(reference: string, revisionNumber: number, expectedRevision: number): Promise<ArtifactLifecycleStatus> {
    if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1 || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error("restore revisions must be positive integers");
    return runFileTransaction(this.root, async (transaction) => {
      const manifest = await readManifestLocked(this.root);
      const artifact = await resolveActiveLocked(this.root, manifest, reference);
      if (artifact.headRevision !== expectedRevision) throw new ArtifactLifecycleConflictError("restore precondition is stale; history remains unchanged", statusFor(this.root, artifact, true), await mergePayload(this.root, artifact));
      const selected = artifact.revisions.find((revision) => revision.revision === revisionNumber);
      if (!selected) throw new Error(`artifact ${artifact.id} has no revision ${revisionNumber}`);
      const sourceHtml = await verifiedRevisionBytes(this.root, artifact, selected);
      const now = new Date().toISOString();
      const next = artifact.headRevision + 1;
      const meta: ArtifactMeta = {
        slug: artifact.slug,
        title: selected.title,
        icon: selected.icon,
        description: selected.description,
        source: selected.source,
        createdAt: artifact.createdAt ?? now,
        updatedAt: now,
        current: next,
        versions: Array.from({ length: next }, (_, index) => index + 1),
        charts: selected.charts,
        bytes: selected.bytes,
        hash: "",
      };
      const html = applyArtifactFooter(sourceHtml, meta);
      const bytes = Buffer.byteLength(html, "utf8");
      const contentHash = sha256(html);
      let sourceValue: string | undefined;
      let authoringSource: AuthoringSourceReferenceV2 | undefined;
      if (selected.authoringSource) {
        sourceValue = await readFile(join(this.root, ...selected.authoringSource.path.split("/")), "utf8");
        if (Buffer.byteLength(sourceValue, "utf8") !== selected.authoringSource.bytes || sha256(sourceValue) !== selected.authoringSource.contentHash) throw new Error("restored authoring source failed integrity verification");
        authoringSource = { ...selected.authoringSource, path: `.sources/${artifact.id}/${next}.${selected.authoringSource.format}.txt` };
      }
      const revision: RevisionRecordV2 = {
        ...selected,
        revision: next,
        createdAt: now,
        bytes,
        contentHash,
        pagePath: `revisions/${artifact.id}/${next}.html`,
        provenance: { kind: "restore", restoredFrom: revisionNumber, timestampSource: "recorded" },
        authoringSource,
      };
      const updated: ArtifactRecordV2 = {
        ...artifact,
        title: revision.title,
        icon: revision.icon,
        description: revision.description,
        source: revision.source,
        author: revision.author,
        updatedAt: now,
        headRevision: next,
        revisions: [...artifact.revisions, revision],
        charts: revision.charts,
        bytes,
        contentHash,
      };
      manifest.artifacts[artifact.id] = updated;
      validateArtifactManifestV2(manifest);
      const files = new Map<string, string | Uint8Array | null>([
        [`${artifact.slug}.html`, html],
        [`${artifact.slug}.v${next}.html`, html],
        [revision.pagePath, html],
        [ARTIFACT_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`],
        ["index.html", renderGallery(galleryManifest(manifest))],
      ]);
      if (authoringSource && sourceValue !== undefined) files.set(authoringSource.path, sourceValue);
      await transaction.commit(files);
      return statusFor(this.root, updated, true);
    });
  }

  async recordDeployment(
    reference: string,
    deployment: { capability: "public-static" | "authenticated" | "connector-capable"; target: string; url: string; createdAt?: string },
  ): Promise<ArtifactLifecycleStatus> {
    const createdAt = deployment.createdAt ?? new Date().toISOString();
    if (!validTimestamp(createdAt) || deployment.target.length === 0 || deployment.target.length > 16_384) throw new Error("deployment reference metadata is invalid");
    const url = new URL(deployment.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("deployment URL must use http or https");
    return runFileTransaction(this.root, async (transaction) => {
      const manifest = await readManifestLocked(this.root);
      const artifact = await resolveActiveLocked(this.root, manifest, reference);
      const entry = { capability: deployment.capability, target: deployment.target, url: url.href, revision: artifact.headRevision, createdAt };
      const references = artifact.deploymentReferences.filter((existing) => existing.target !== entry.target || existing.url !== entry.url);
      const updated: ArtifactRecordV2 = { ...artifact, deploymentReferences: [...references, entry] };
      manifest.artifacts[artifact.id] = updated;
      validateArtifactManifestV2(manifest);
      await transaction.commit(new Map([
        [ARTIFACT_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`],
        ["index.html", renderGallery(galleryManifest(manifest))],
      ]));
      return statusFor(this.root, updated, true);
    });
  }

  async previewArchive(reference: string, options: { now?: string; token?: string } = {}): Promise<ArchivePreview> {
    const now = options.now ?? new Date().toISOString();
    const token = options.token ?? randomUUID();
    if (!validTimestamp(now) || !ARTIFACT_ID_RE.test(token)) throw new Error("archive preview time/token is invalid");
    return runFileTransaction(this.root, async (transaction) => {
      const manifest = await readManifestLocked(this.root);
      const artifact = await resolveActiveLocked(this.root, manifest, reference);
      const stateStoreCount = await this.stateStoreCount(artifact.id);
      const scope = { id: artifact.id, slug: artifact.slug, headRevision: artifact.headRevision, contentHash: artifact.contentHash, stateStoreCount, deploymentReferences: artifact.deploymentReferences };
      const scopeHash = sha256(JSON.stringify(scope));
      const preview: StoredArchivePreview = {
        schemaVersion: 1,
        token,
        createdAt: now,
        expiresAt: new Date(Date.parse(now) + ARCHIVE_TOKEN_TTL_MS).toISOString(),
        scopeHash,
        artifact: statusFor(this.root, artifact, true),
        revisionCount: artifact.revisions.length,
        stateStoreCount,
        retainedBytes: artifact.revisions.reduce((sum, revision) => sum + revision.bytes + (revision.authoringSource?.bytes ?? 0), 0),
        externalCopiesDeleted: false,
        recovery: "unarchive-by-id",
      };
      if (await optionalRegularFile(join(this.root, ".archive-previews", `${token}.json`), 1024 * 1024)) throw new Error("archive preview token already exists; generate a new token");
      await transaction.commit(new Map([[`.archive-previews/${token}.json`, `${JSON.stringify(preview, null, 2)}\n`]]));
      const { createdAt: _createdAt, ...result } = preview;
      return result;
    });
  }

  async archive(token: string, options: { now?: string } = {}): Promise<ArtifactLifecycleStatus> {
    if (!ARTIFACT_ID_RE.test(token)) throw new Error("archive confirmation token is invalid");
    const now = options.now ?? new Date().toISOString();
    if (!validTimestamp(now)) throw new Error("archive timestamp is invalid");
    return runFileTransaction(this.root, async (transaction) => {
      const previewPath = `.archive-previews/${token}.json`;
      const preview = this.parseArchivePreview(JSON.parse(await readFile(join(this.root, ...previewPath.split("/")), "utf8")) as unknown);
      if (Date.parse(now) > Date.parse(preview.expiresAt)) throw new Error("archive confirmation expired; artifact remains active and requires a new preview");
      const manifest = await readManifestLocked(this.root);
      const artifact = manifest.artifacts[preview.artifact.id];
      if (!artifact) throw new Error("archive target is no longer active");
      const stateStoreCount = await this.stateStoreCount(artifact.id);
      const scopeHash = sha256(JSON.stringify({ id: artifact.id, slug: artifact.slug, headRevision: artifact.headRevision, contentHash: artifact.contentHash, stateStoreCount, deploymentReferences: artifact.deploymentReferences }));
      if (scopeHash !== preview.scopeHash) throw new Error("archive scope changed after preview; artifact remains active and requires a new preview");
      if (await this.readArchive(artifact.id)) throw new Error("archive record already exists for this artifact; artifact remains active pending repair");
      const archived: ArchivedArtifactRecord = { schemaVersion: 1, archivedAt: now, previewScopeHash: scopeHash, artifact };
      delete manifest.artifacts[artifact.id];
      delete manifest.slugIndex[artifact.slug];
      validateArtifactManifestV2(manifest);
      await transaction.commit(new Map<string, string | Uint8Array | null>([
        [`.archives/${artifact.id}/record.json`, `${JSON.stringify(archived, null, 2)}\n`],
        [ARTIFACT_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`],
        ["index.html", renderGallery(galleryManifest(manifest))],
        [`${artifact.slug}.html`, null],
        [previewPath, null],
      ]));
      return statusFor(this.root, artifact, false);
    });
  }

  async inspectArchivePreview(token: string): Promise<ArchivePreview> {
    if (!ARTIFACT_ID_RE.test(token)) throw new Error("archive confirmation token is invalid");
    await recoverFileTransactions(this.root);
    const preview = this.parseArchivePreview(JSON.parse(await readFile(join(this.root, ".archive-previews", `${token}.json`), "utf8")) as unknown);
    const { createdAt: _createdAt, ...result } = preview;
    return result;
  }

  async unarchive(artifactId: string, slug?: string): Promise<ArtifactLifecycleStatus> {
    if (!ARTIFACT_ID_RE.test(artifactId)) throw new Error("unarchive requires an opaque artifact ID");
    return runFileTransaction(this.root, async (transaction) => {
      const archived = await this.readArchive(artifactId);
      if (!archived) throw new Error(`artifact ${artifactId} is not archived`);
      const manifest = await readManifestLocked(this.root);
      if (manifest.artifacts[artifactId]) throw new Error(`artifact ${artifactId} is already active`);
      const selectedSlug = slug ?? archived.artifact.slug;
      if (!ARTIFACT_SLUG_RE.test(selectedSlug)) throw new Error("unarchive slug is invalid");
      if (manifest.slugIndex[selectedSlug]) throw new Error(`unarchive slug ${selectedSlug} belongs to another active artifact; supply a different explicit slug`);
      const artifact: ArtifactRecordV2 = { ...archived.artifact, slug: selectedSlug };
      const head = artifact.revisions.at(-1);
      if (!head) throw new Error("archived artifact has no head revision");
      const html = await verifiedRevisionBytes(this.root, artifact, head);
      manifest.artifacts[artifact.id] = artifact;
      manifest.slugIndex[selectedSlug] = artifact.id;
      validateArtifactManifestV2(manifest);
      await transaction.commit(new Map<string, string | Uint8Array | null>([
        [`${selectedSlug}.html`, html],
        [ARTIFACT_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`],
        ["index.html", renderGallery(galleryManifest(manifest))],
        [`.archives/${artifact.id}/record.json`, null],
      ]));
      return statusFor(this.root, artifact, true);
    });
  }

  async exportBundle(reference: string, destination: string): Promise<{ path: string; files: number; bytes: number; artifact: ArtifactLifecycleStatus }> {
    await recoverFileTransactions(this.root);
    const manifest = await readManifestLocked(this.root);
    const artifact = await resolveActiveLocked(this.root, manifest, reference);
    const destinationPath = resolve(destination);
    if (destinationPath === this.root || destinationPath.startsWith(`${this.root}${sep}`)) throw new Error("export destination must be outside the artifact store so internal bundle data cannot enter public staging");
    if (await lstat(destinationPath).then(() => true, (error: unknown) => errnoCode(error) === "ENOENT" ? false : Promise.reject(error))) throw new Error("export destination already exists");
    const stage = `${destinationPath}.stage-${randomUUID()}`;
    const files = new Map<string, Uint8Array>();
    for (const revision of artifact.revisions) {
      const html = Buffer.from(await verifiedRevisionBytes(this.root, artifact, revision), "utf8");
      files.set(`pages/${revision.revision}.html`, html);
      if (revision.authoringSource) {
        const source = await optionalRegularFile(join(this.root, ...revision.authoringSource.path.split("/")), MAX_SOURCE_BYTES);
        if (!source || source.byteLength !== revision.authoringSource.bytes || sha256(source) !== revision.authoringSource.contentHash) throw new Error(`authoring source for revision ${revision.revision} failed export verification`);
        files.set(`sources/${revision.revision}.${revision.authoringSource.format}.txt`, source);
      }
    }
    for (const [kind, bundlePath] of [["decisions", "state/decisions.json"], ["comments", "state/comments.json"]] as const) {
      const path = join(this.root, ".state", "v2", artifact.id, `${kind}.json`);
      const value = await optionalRegularFile(path);
      if (value) {
        validateArtifactStateEnvelope(JSON.parse(Buffer.from(value).toString("utf8")) as unknown, { artifactId: artifact.id, kind, key: "default" });
        files.set(bundlePath, value);
      }
    }
    const collectionRoot = join(this.root, ".db", "v2", artifact.id);
    const collections = await readdir(collectionRoot, { withFileTypes: true }).catch((error: unknown) => errnoCode(error) === "ENOENT" ? [] : Promise.reject(error));
    for (const entry of collections.sort((left, right) => left.name.localeCompare(right.name))) {
      const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(entry.name);
      if (!entry.isFile() || !match) throw new Error(`unsupported collection entry ${entry.name}`);
      const value = await optionalRegularFile(join(collectionRoot, entry.name));
      if (!value) throw new Error(`collection disappeared during export: ${entry.name}`);
      validateArtifactStateEnvelope(JSON.parse(Buffer.from(value).toString("utf8")) as unknown, { artifactId: artifact.id, kind: "collection", key: match[1] });
      files.set(`collections/${entry.name}`, value);
    }
    const inventory: ArtifactBundleManifest = {
      schemaVersion: 1,
      artifact,
      files: [...files.entries()].map(([path, bytes]) => ({ path, bytes: bytes.byteLength, contentHash: sha256(bytes) })).sort((left, right) => left.path.localeCompare(right.path)),
    };
    try {
      for (const [path, bytes] of files) {
        const target = join(stage, ...bundleSegments(path));
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, bytes, { flag: "wx" });
      }
      await mkdir(stage, { recursive: true });
      await writeFile(join(stage, "bundle.json"), `${JSON.stringify(inventory, null, 2)}\n`, { flag: "wx" });
      for (const entry of inventory.files) {
        const bytes = await optionalRegularFile(join(stage, ...bundleSegments(entry.path)));
        if (!bytes || bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.contentHash) throw new Error(`export verification failed for ${entry.path}`);
      }
      await mkdir(dirname(destinationPath), { recursive: true });
      await rename(stage, destinationPath);
    } catch (error) {
      await rm(stage, { recursive: true, force: true });
      throw error;
    }
    return { path: destinationPath, files: inventory.files.length, bytes: inventory.files.reduce((sum, entry) => sum + entry.bytes, 0), artifact: statusFor(this.root, artifact, true) };
  }

  async importBundle(bundleDirectory: string): Promise<ArtifactLifecycleStatus> {
    const bundleRoot = resolve(bundleDirectory);
    const info = await lstat(bundleRoot);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("bundle path must be a real directory");
    const manifestBytes = await optionalRegularFile(join(bundleRoot, "bundle.json"), 4 * 1024 * 1024);
    if (!manifestBytes) throw new Error("bundle.json is missing");
    const bundle = parseBundleManifest(JSON.parse(Buffer.from(manifestBytes).toString("utf8")) as unknown);
    const actualFiles = await inventoryBundleFiles(bundleRoot);
    const inventoriedFiles = ["bundle.json", ...bundle.files.map((entry) => entry.path)].sort();
    if (actualFiles.length !== inventoriedFiles.length || actualFiles.some((path, index) => path !== inventoriedFiles[index])) throw new Error("bundle contains missing or unlisted files");
    const contents = new Map<string, Uint8Array>();
    let totalBytes = 0;
    for (const entry of bundle.files) {
      const bytes = await optionalRegularFile(join(bundleRoot, ...bundleSegments(entry.path)), Math.max(entry.bytes, 1));
      if (!bytes || bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.contentHash) throw new Error(`bundle verification failed for ${entry.path}`);
      totalBytes += bytes.byteLength;
      if (totalBytes > 512 * 1024 * 1024) throw new Error("bundle exceeds the 512 MiB import limit");
      contents.set(entry.path, bytes);
    }
    const expectedPaths = new Set<string>();
    for (const revision of bundle.artifact.revisions) {
      const pagePath = `pages/${revision.revision}.html`;
      const page = contents.get(pagePath);
      if (!page || page.byteLength !== revision.bytes || sha256(page) !== revision.contentHash) throw new Error(`bundle revision ${revision.revision} is absent or corrupt`);
      expectedPaths.add(pagePath);
      if (revision.authoringSource) {
        const sourcePath = `sources/${revision.revision}.${revision.authoringSource.format}.txt`;
        const source = contents.get(sourcePath);
        if (!source || source.byteLength !== revision.authoringSource.bytes || sha256(source) !== revision.authoringSource.contentHash) throw new Error(`bundle source ${revision.revision} is absent or corrupt`);
        expectedPaths.add(sourcePath);
      }
    }
    for (const path of contents.keys()) {
      if (path.startsWith("state/") || path.startsWith("collections/")) continue;
      if (!expectedPaths.has(path)) throw new Error(`bundle contains unsupported content ${path}`);
    }
    const targetFiles = new Map<string, Uint8Array>();
    for (const revision of bundle.artifact.revisions) {
      const page = contents.get(`pages/${revision.revision}.html`);
      if (!page) throw new Error("verified bundle page disappeared");
      targetFiles.set(revision.pagePath, page);
      targetFiles.set(`${bundle.artifact.slug}.v${revision.revision}.html`, page);
      if (revision.authoringSource) {
        const source = contents.get(`sources/${revision.revision}.${revision.authoringSource.format}.txt`);
        if (!source) throw new Error("verified bundle source disappeared");
        targetFiles.set(revision.authoringSource.path, source);
      }
    }
    for (const [path, bytes] of contents) {
      let target: string | undefined;
      if (path === "state/decisions.json") target = `.state/v2/${bundle.artifact.id}/decisions.json`;
      else if (path === "state/comments.json") target = `.state/v2/${bundle.artifact.id}/comments.json`;
      else {
        const collection = /^collections\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(path);
        if (collection) target = `.db/v2/${bundle.artifact.id}/${collection[1]}.json`;
      }
      if (target) targetFiles.set(target, bytes);
    }
    for (const [target, bytes] of targetFiles) {
      if (target.startsWith(".state/") || target.startsWith(".db/")) {
        const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
        const collection = /^\.db\/v2\/[^/]+\/([^.]+)\.json$/.exec(target);
        validateArtifactStateEnvelope(parsed, { artifactId: bundle.artifact.id, kind: collection ? "collection" : target.endsWith("comments.json") ? "comments" : "decisions", key: collection?.[1] ?? "default" });
      }
    }
    const initialManifest = await readManifestLocked(this.root);
    if (initialManifest.artifacts[bundle.artifact.id] || initialManifest.slugIndex[bundle.artifact.slug]) throw new Error("bundle identity or slug collides with existing storage; only reject collision policy is supported");
    const entries = [...targetFiles.entries()];
    for (let offset = 0; offset < entries.length; offset += 24) {
      const batch = entries.slice(offset, offset + 24);
      await runFileTransaction(this.root, async (transaction) => {
        const current = await readManifestLocked(this.root);
        if (current.artifacts[bundle.artifact.id] || current.slugIndex[bundle.artifact.slug]) throw new Error("bundle identity or slug collided during import");
        const writes = new Map<string, Uint8Array>();
        for (const [target, bytes] of batch) {
          const existing = await optionalRegularFile(join(this.root, ...target.split("/")), Math.max(bytes.byteLength, 1));
          if (existing) {
            if (sha256(existing) !== sha256(bytes)) throw new Error(`import target conflicts: ${target}`);
          } else {
            writes.set(target, bytes);
          }
        }
        if (writes.size > 0) await transaction.commit(writes);
      });
    }
    return runFileTransaction(this.root, async (transaction) => {
      const manifest = await readManifestLocked(this.root);
      if (manifest.artifacts[bundle.artifact.id] || manifest.slugIndex[bundle.artifact.slug]) throw new Error("bundle identity or slug collided before selection");
      for (const [target, bytes] of targetFiles) {
        const selected = await optionalRegularFile(join(this.root, ...target.split("/")), Math.max(bytes.byteLength, 1));
        if (!selected || sha256(selected) !== sha256(bytes)) throw new Error(`prepared import target failed verification: ${target}`);
      }
      manifest.artifacts[bundle.artifact.id] = bundle.artifact;
      manifest.slugIndex[bundle.artifact.slug] = bundle.artifact.id;
      validateArtifactManifestV2(manifest);
      const head = contents.get(`pages/${bundle.artifact.headRevision}.html`);
      if (!head) throw new Error("bundle head page is absent");
      await transaction.commit(new Map<string, string | Uint8Array | null>([
        [`${bundle.artifact.slug}.html`, head],
        [ARTIFACT_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`],
        ["index.html", renderGallery(galleryManifest(manifest))],
      ]));
      return statusFor(this.root, bundle.artifact, true);
    });
  }

  private async stateStoreCount(artifactId: string): Promise<number> {
    let count = 0;
    for (const relativeRoot of [`.state/v2/${artifactId}`, `.db/v2/${artifactId}`]) {
      const entries = await readdir(join(this.root, ...relativeRoot.split("/")), { withFileTypes: true }).catch((error: unknown) => {
        if (errnoCode(error) === "ENOENT") return [];
        throw error;
      });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) throw new Error(`artifact state archive scope contains unsupported entry ${relativeRoot}/${entry.name}`);
        count++;
      }
    }
    return count;
  }

  private parseArchivePreview(value: unknown): StoredArchivePreview {
    const keys = new Set(["schemaVersion", "token", "createdAt", "expiresAt", "scopeHash", "artifact", "revisionCount", "stateStoreCount", "retainedBytes", "externalCopiesDeleted", "recovery"]);
    if (!isRecord(value) || Object.keys(value).some((key) => !keys.has(key)) || value["schemaVersion"] !== 1 || typeof value["token"] !== "string" || !ARTIFACT_ID_RE.test(value["token"]) || typeof value["createdAt"] !== "string" || !validTimestamp(value["createdAt"]) || typeof value["expiresAt"] !== "string" || !validTimestamp(value["expiresAt"]) || typeof value["scopeHash"] !== "string" || !CONTENT_HASH_RE.test(value["scopeHash"]) || !isRecord(value["artifact"]) || value["artifact"]["schemaVersion"] !== 1 || typeof value["artifact"]["id"] !== "string" || !ARTIFACT_ID_RE.test(value["artifact"]["id"]) || value["artifact"]["active"] !== true || typeof value["artifact"]["slug"] !== "string" || !ARTIFACT_SLUG_RE.test(value["artifact"]["slug"]) || typeof value["revisionCount"] !== "number" || !Number.isSafeInteger(value["revisionCount"]) || value["revisionCount"] < 1 || typeof value["stateStoreCount"] !== "number" || !Number.isSafeInteger(value["stateStoreCount"]) || value["stateStoreCount"] < 0 || typeof value["retainedBytes"] !== "number" || !Number.isSafeInteger(value["retainedBytes"]) || value["retainedBytes"] < 0 || value["externalCopiesDeleted"] !== false || value["recovery"] !== "unarchive-by-id") throw new Error("archive preview record is malformed");
    return value as unknown as StoredArchivePreview;
  }

  private async readArchive(artifactId: string): Promise<ArchivedArtifactRecord | undefined> {
    const path = join(this.root, ".archives", artifactId, "record.json");
    let value: unknown;
    try {
      const info = await lstat(path);
      if (info.isSymbolicLink() || !info.isFile()) throw new Error("archive record path is unsafe");
      value = JSON.parse(await readFile(path, "utf8")) as unknown;
    } catch (error) {
      if (errnoCode(error) === "ENOENT") return undefined;
      throw error;
    }
    if (!isRecord(value) || Object.keys(value).some((key) => key !== "schemaVersion" && key !== "archivedAt" && key !== "previewScopeHash" && key !== "artifact") || value["schemaVersion"] !== 1 || typeof value["archivedAt"] !== "string" || !validTimestamp(value["archivedAt"]) || typeof value["previewScopeHash"] !== "string" || !CONTENT_HASH_RE.test(value["previewScopeHash"]) || !isRecord(value["artifact"])) throw new Error("archive record is malformed");
    const artifact = value["artifact"] as unknown as ArtifactRecordV2;
    validateArtifactManifestV2({ schemaVersion: 2, artifacts: { [artifactId]: artifact }, slugIndex: { [artifact.slug]: artifactId } });
    return value as unknown as ArchivedArtifactRecord;
  }
}
