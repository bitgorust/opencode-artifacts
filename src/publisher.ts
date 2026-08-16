import { lstat, readFile, readdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { renderGallery } from "./gallery.ts";
import {
  recoverFileTransactions,
  runFileTransaction,
  type FileTransactionContext,
} from "./file-transaction.ts";
import {
  ARTIFACT_ID_RE,
  ARTIFACT_MANIFEST_FILE,
  emptyArtifactManifestV2,
  parseArtifactManifestV2,
  validateArtifactManifestV2,
  type ArtifactManifestV2,
  type ArtifactRecordV2,
  type RevisionRecordV2,
} from "./artifact-schema.ts";
import {
  ArtifactTooLargeError,
  DEFAULT_MAX_BYTES,
  FOOTER_PLACEHOLDER,
} from "./render.ts";
import { escapeHtmlText, slugify } from "./text.ts";

export { slugify } from "./text.ts";

export function contentHash(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex").slice(0, 12);
}

export function fullContentHash(html: string): string {
  return createHash("sha256").update(html, "utf8").digest("hex");
}

export class StaleArtifactError extends Error {
  readonly currentHash: string;
  constructor(slug: string, currentHash: string) {
    super(`artifact '${slug}' changed since this edit (current hash ${currentHash})`);
    this.name = "StaleArtifactError";
    this.currentHash = currentHash;
  }
}

export interface ArtifactMeta {
  slug: string;
  title: string;
  icon: string;
  description?: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
  current: number;
  versions: number[];
  charts: number;
  bytes: number;
  hash: string;
}

export interface Manifest {
  artifacts: Record<string, ArtifactMeta>;
}

export interface PublishInput {
  slug: string;
  html: string;
  title?: string;
  icon?: string;
  description?: string;
  source?: string;
  charts?: number;
  version?: boolean;
  expectedHash?: string;
}

export interface PublishResult {
  path: string;
  version: number;
  gallery: string;
  hash: string;
  url?: string;
}

export interface Publisher {
  publish(input: PublishInput): Promise<PublishResult>;
}

export interface FilePublisherOptions {
  schemaVersion?: 1 | 2;
  artifactIdFactory?: () => string;
}

const MANIFEST_FILE = "manifest.json";
const GALLERY_FILE = "index.html";

async function readManifest(dir: string): Promise<Manifest> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(dir, MANIFEST_FILE), "utf8"));
    if (typeof parsed === "object" && parsed !== null && "artifacts" in parsed) {
      return parsed as Manifest;
    }
    return { artifacts: {} };
  } catch {
    return { artifacts: {} };
  }
}

async function readManifestV2Locked(dir: string): Promise<ArtifactManifestV2> {
  const path = join(dir, ARTIFACT_MANIFEST_FILE);
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new Error("artifact manifest path must be a regular file");
    }
    return parseArtifactManifestV2(await readFile(path, "utf8"));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyArtifactManifestV2();
    }
    throw error;
  }
}

function manifestV2GalleryView(manifest: ArtifactManifestV2): Manifest {
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

function footerHtml(meta: ArtifactMeta): string {
  return [
    '<footer class="artifact-footer">',
    `Published by opencode-artifacts · v${meta.current} · updated ${escapeHtmlText(meta.updatedAt)}`,
    meta.source ? ` · Data: ${escapeHtmlText(meta.source)}` : "",
    ' · <a href="index.html">Gallery</a>',
    "</footer>",
  ].join("");
}

function replaceFooter(html: string, footer: string): string {
  if (html.includes(FOOTER_PLACEHOLDER)) return html.replace(FOOTER_PLACEHOLDER, footer);
  const existingFooter = /<footer class="artifact-footer">[\s\S]*?<\/footer>/;
  return existingFooter.test(html) ? html.replace(existingFooter, footer) : html;
}

export class FilePublisher implements Publisher {
  private readonly dir: string;
  private readonly schemaVersion: 1 | 2 | undefined;
  private readonly artifactIdFactory: () => string;

  constructor(dir: string, options: FilePublisherOptions = {}) {
    this.dir = dir;
    this.schemaVersion = options.schemaVersion;
    this.artifactIdFactory = options.artifactIdFactory ?? randomUUID;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    return runFileTransaction(this.dir, async (transaction) =>
      (await this.selectedSchemaVersionLocked()) === 2
        ? this.publishV2Serialized(input, transaction)
        : this.publishSerialized(input, transaction),
    );
  }

  private async selectedSchemaVersionLocked(): Promise<1 | 2> {
    if (this.schemaVersion !== undefined) return this.schemaVersion;
    try {
      const value = JSON.parse(await readFile(join(this.dir, ARTIFACT_MANIFEST_FILE), "utf8")) as unknown;
      return typeof value === "object" && value !== null && "schemaVersion" in value && value.schemaVersion === 2
        ? 2
        : 1;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return 1;
      throw error;
    }
  }

  private async publishV2Serialized(
    input: PublishInput,
    transaction: FileTransactionContext,
  ): Promise<PublishResult> {
    const manifest = await readManifestV2Locked(this.dir);
    const existingId = manifest.slugIndex[input.slug];
    const existing = existingId ? manifest.artifacts[existingId] : undefined;
    if (existingId && !existing) throw new Error(`artifact slug index is corrupt for ${input.slug}`);
    if (
      input.expectedHash !== undefined &&
      existing &&
      existing.contentHash.slice(0, 12) !== input.expectedHash
    ) {
      throw new StaleArtifactError(input.slug, existing.contentHash.slice(0, 12));
    }

    const id = existing?.id ?? this.artifactIdFactory();
    if (!ARTIFACT_ID_RE.test(id)) throw new Error("artifact ID factory returned an invalid UUID");
    const now = new Date().toISOString();
    const nextRevision = (existing?.headRevision ?? 0) + 1;
    const title = input.title ?? existing?.title ?? input.slug;
    const icon = input.icon ?? existing?.icon ?? "📄";
    const description = input.description ?? existing?.description;
    const source = input.source ?? existing?.source;
    const charts = input.charts ?? existing?.charts ?? 0;
    const provisionalMeta: ArtifactMeta = {
      slug: input.slug,
      title,
      icon,
      description,
      source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      current: nextRevision,
      versions: Array.from({ length: nextRevision }, (_, index) => index + 1),
      charts,
      bytes: Buffer.byteLength(input.html, "utf8"),
      hash: "",
    };
    const html = replaceFooter(input.html, footerHtml(provisionalMeta));
    const bytes = Buffer.byteLength(html, "utf8");
    if (bytes > DEFAULT_MAX_BYTES) throw new ArtifactTooLargeError(bytes, DEFAULT_MAX_BYTES);
    const digest = fullContentHash(html);
    const revision: RevisionRecordV2 = {
      revision: nextRevision,
      createdAt: now,
      bytes,
      contentHash: digest,
      pagePath: `revisions/${id}/${nextRevision}.html`,
      title,
      icon,
      description,
      source,
      author: existing?.author,
      charts,
      provenance: {
        kind: existing ? "update" : "create",
        timestampSource: "recorded",
      },
    };
    const record: ArtifactRecordV2 = {
      id,
      slug: input.slug,
      title,
      icon,
      description,
      source,
      author: existing?.author,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      headRevision: nextRevision,
      revisions: [...(existing?.revisions ?? []), revision],
      charts,
      bytes,
      contentHash: digest,
      deploymentReferences: existing?.deploymentReferences ?? [],
    };
    manifest.artifacts[id] = record;
    manifest.slugIndex[input.slug] = id;
    validateArtifactManifestV2(manifest);
    const stableName = `${input.slug}.html`;
    const gallery = join(this.dir, GALLERY_FILE);
    await transaction.commit(
      new Map([
        [stableName, html],
        [`${input.slug}.v${nextRevision}.html`, html],
        [revision.pagePath, html],
        [ARTIFACT_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`],
        [GALLERY_FILE, renderGallery(manifestV2GalleryView(manifest))],
      ]),
    );
    return {
      path: join(this.dir, stableName),
      version: nextRevision,
      gallery,
      hash: digest.slice(0, 12),
    };
  }

  private async publishSerialized(
    input: PublishInput,
    transaction: FileTransactionContext,
  ): Promise<PublishResult> {
    const manifest = await readManifest(this.dir);
    const existing = manifest.artifacts[input.slug];
    const now = new Date().toISOString();

    if (input.expectedHash !== undefined && existing && existing.hash !== input.expectedHash) {
      throw new StaleArtifactError(input.slug, existing.hash);
    }

    const nextVersion = input.version
      ? (existing?.versions.length ? Math.max(...existing.versions) : 0) + 1
      : (existing?.current ?? 1);

    const html = input.html.replace(
      FOOTER_PLACEHOLDER,
      footerHtml({
        slug: input.slug,
        title: input.title ?? existing?.title ?? input.slug,
        icon: input.icon ?? existing?.icon ?? "📄",
        description: input.description ?? existing?.description,
        source: input.source ?? existing?.source,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        current: nextVersion,
        versions: input.version
          ? [...(existing?.versions ?? []), nextVersion]
          : (existing?.versions ?? [1]),
        charts: input.charts ?? existing?.charts ?? 0,
        bytes: Buffer.byteLength(input.html, "utf8"),
        hash: "",
      }),
    );
    const bytes = Buffer.byteLength(html, "utf8");
    if (bytes > DEFAULT_MAX_BYTES) throw new ArtifactTooLargeError(bytes, DEFAULT_MAX_BYTES);
    const hash = contentHash(html);

    const meta: ArtifactMeta = {
      slug: input.slug,
      title: input.title ?? existing?.title ?? input.slug,
      icon: input.icon ?? existing?.icon ?? "📄",
        description: input.description ?? existing?.description,
        source: input.source ?? existing?.source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      current: nextVersion,
      versions: input.version
        ? [...(existing?.versions ?? []), nextVersion]
        : (existing?.versions ?? [1]),
      charts: input.charts ?? existing?.charts ?? 0,
      bytes,
      hash,
    };

    const stableName = `${input.slug}.html`;
    const stable = join(this.dir, stableName);
    const files = new Map<string, string | Uint8Array>();
    if (input.version) {
      if (existing && existing.versions.includes(existing.current)) {
        const currentArchiveName = `${input.slug}.v${existing.current}.html`;
        const currentArchive = join(this.dir, currentArchiveName);
        const alreadyArchived = await readFile(currentArchive).then(
          () => true,
          (error: unknown) => {
            if (
              typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "ENOENT"
            ) {
              return false;
            }
            throw error;
          },
        );
        if (!alreadyArchived) files.set(currentArchiveName, await readFile(stable));
      }
      files.set(`${input.slug}.v${nextVersion}.html`, html);
    }
    files.set(stableName, html);

    manifest.artifacts[input.slug] = meta;
    files.set(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
    const gallery = join(this.dir, GALLERY_FILE);
    files.set(GALLERY_FILE, renderGallery(manifest));
    await transaction.commit(files);

    return { path: stable, version: nextVersion, gallery, hash };
  }

  async latest(): Promise<ArtifactMeta | undefined> {
    await recoverFileTransactions(this.dir);
    if ((await this.selectedSchemaVersionLocked()) === 2) {
      const manifest = await readManifestV2Locked(this.dir);
      return Object.values(manifestV2GalleryView(manifest).artifacts).sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      )[0];
    }
    const manifest = await readManifest(this.dir);
    return Object.values(manifest.artifacts).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0];
  }

  async restore(slug: string, version: number): Promise<PublishResult> {
    return runFileTransaction(this.dir, async (transaction) =>
      (await this.selectedSchemaVersionLocked()) === 2
        ? this.restoreV2Serialized(slug, version, transaction)
        : this.restoreSerialized(slug, version, transaction),
    );
  }

  private async restoreV2Serialized(
    slug: string,
    version: number,
    transaction: FileTransactionContext,
  ): Promise<PublishResult> {
    const manifest = await readManifestV2Locked(this.dir);
    const id = manifest.slugIndex[slug];
    const existing = id ? manifest.artifacts[id] : undefined;
    if (!existing) throw new Error(`unknown artifact: ${slug}`);
    const restored = existing.revisions.find((revision) => revision.revision === version);
    if (!restored) throw new Error(`unknown version ${version} for artifact ${slug}`);
    const sourceContent = await readFile(join(this.dir, ...restored.pagePath.split("/")), "utf8");
    if (
      Buffer.byteLength(sourceContent, "utf8") !== restored.bytes ||
      fullContentHash(sourceContent) !== restored.contentHash
    ) {
      throw new Error(`revision ${version} for artifact ${slug} failed integrity verification`);
    }
    const now = new Date().toISOString();
    const nextRevision = existing.headRevision + 1;
    const meta: ArtifactMeta = {
      slug,
      title: restored.title,
      icon: restored.icon,
      description: restored.description,
      source: restored.source,
      createdAt: existing.createdAt ?? now,
      updatedAt: now,
      current: nextRevision,
      versions: Array.from({ length: nextRevision }, (_, index) => index + 1),
      charts: restored.charts,
      bytes: restored.bytes,
      hash: "",
    };
    const html = replaceFooter(sourceContent, footerHtml(meta));
    const bytes = Buffer.byteLength(html, "utf8");
    if (bytes > DEFAULT_MAX_BYTES) throw new ArtifactTooLargeError(bytes, DEFAULT_MAX_BYTES);
    const digest = fullContentHash(html);
    const revision: RevisionRecordV2 = {
      ...restored,
      revision: nextRevision,
      createdAt: now,
      bytes,
      contentHash: digest,
      pagePath: `revisions/${id}/${nextRevision}.html`,
      provenance: {
        kind: "restore",
        restoredFrom: version,
        timestampSource: "recorded",
      },
    };
    const record: ArtifactRecordV2 = {
      ...existing,
      title: revision.title,
      icon: revision.icon,
      description: revision.description,
      source: revision.source,
      author: revision.author,
      updatedAt: now,
      headRevision: nextRevision,
      revisions: [...existing.revisions, revision],
      charts: revision.charts,
      bytes,
      contentHash: digest,
    };
    manifest.artifacts[id] = record;
    validateArtifactManifestV2(manifest);
    const stable = join(this.dir, `${slug}.html`);
    const gallery = join(this.dir, GALLERY_FILE);
    await transaction.commit(
      new Map([
        [`${slug}.html`, html],
        [`${slug}.v${nextRevision}.html`, html],
        [revision.pagePath, html],
        [ARTIFACT_MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`],
        [GALLERY_FILE, renderGallery(manifestV2GalleryView(manifest))],
      ]),
    );
    return { path: stable, version: nextRevision, gallery, hash: digest.slice(0, 12) };
  }

  private async restoreSerialized(
    slug: string,
    version: number,
    transaction: FileTransactionContext,
  ): Promise<PublishResult> {
    const manifest = await readManifest(this.dir);
    const meta = manifest.artifacts[slug];
    if (!meta) throw new Error(`unknown artifact: ${slug}`);
    if (!meta.versions.includes(version)) {
      throw new Error(`unknown version ${version} for artifact ${slug}`);
    }

    const stable = join(this.dir, `${slug}.html`);
    const content = await readFile(join(this.dir, `${slug}.v${version}.html`), "utf8");

    meta.current = version;
    meta.updatedAt = new Date().toISOString();
    meta.hash = contentHash(content);
    manifest.artifacts[slug] = meta;
    const gallery = join(this.dir, GALLERY_FILE);
    await transaction.commit(
      new Map([
        [`${slug}.html`, content],
        [MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`],
        [GALLERY_FILE, renderGallery(manifest)],
      ]),
    );

    return { path: stable, version, gallery, hash: meta.hash };
  }
}

export function listVersionFiles(names: string[], slug: string): number[] {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}\\.v(\\d+)\\.html$`);
  const found: number[] = [];
  for (const name of names) {
    const match = name.match(pattern);
    if (match) found.push(Number(match[1]));
  }
  return found.sort((a, b) => a - b);
}

export async function diskVersions(dir: string, slug: string): Promise<number[]> {
  try {
    return listVersionFiles(await readdir(dir), slug);
  } catch {
    return [];
  }
}
