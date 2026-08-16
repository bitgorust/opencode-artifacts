import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { renderGallery } from "./gallery.ts";
import {
  recoverFileTransactions,
  runFileTransaction,
  type FileTransactionContext,
} from "./file-transaction.ts";
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

function footerHtml(meta: ArtifactMeta): string {
  return [
    '<footer class="artifact-footer">',
    `Published by opencode-artifacts · v${meta.current} · updated ${escapeHtmlText(meta.updatedAt)}`,
    meta.source ? ` · Data: ${escapeHtmlText(meta.source)}` : "",
    ' · <a href="index.html">Gallery</a>',
    "</footer>",
  ].join("");
}

export class FilePublisher implements Publisher {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    return runFileTransaction(this.dir, (transaction) => this.publishSerialized(input, transaction));
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
    const manifest = await readManifest(this.dir);
    return Object.values(manifest.artifacts).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0];
  }

  async restore(slug: string, version: number): Promise<PublishResult> {
    return runFileTransaction(this.dir, (transaction) =>
      this.restoreSerialized(slug, version, transaction),
    );
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
