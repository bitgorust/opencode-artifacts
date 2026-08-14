import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { renderGallery } from "./gallery.ts";
import { FOOTER_PLACEHOLDER } from "./render.ts";
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
  charts?: number;
  version?: boolean;
  expectedHash?: string;
}

export interface PublishResult {
  path: string;
  version: number;
  gallery: string;
  hash: string;
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
    `Published by opencode-artifacts · v${meta.current} · updated ${escapeHtmlText(meta.updatedAt)} · `,
    '<a href="index.html">Gallery</a>',
    "</footer>",
  ].join("");
}

export class FilePublisher implements Publisher {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    await mkdir(this.dir, { recursive: true });
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
    const hash = contentHash(html);

    const meta: ArtifactMeta = {
      slug: input.slug,
      title: input.title ?? existing?.title ?? input.slug,
      icon: input.icon ?? existing?.icon ?? "📄",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      current: nextVersion,
      versions: input.version
        ? [...(existing?.versions ?? []), nextVersion]
        : (existing?.versions ?? [1]),
      charts: input.charts ?? existing?.charts ?? 0,
      bytes: Buffer.byteLength(input.html, "utf8"),
      hash,
    };

    const stable = join(this.dir, `${input.slug}.html`);
    if (input.version) {
      await writeFile(join(this.dir, `${input.slug}.v${nextVersion}.html`), html, "utf8");
    }
    await writeFile(stable, html, "utf8");

    manifest.artifacts[input.slug] = meta;
    await writeFile(join(this.dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const gallery = join(this.dir, GALLERY_FILE);
    await writeFile(gallery, renderGallery(manifest), "utf8");

    return { path: stable, version: nextVersion, gallery, hash };
  }

  async latest(): Promise<ArtifactMeta | undefined> {
    const manifest = await readManifest(this.dir);
    return Object.values(manifest.artifacts).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0];
  }

  async restore(slug: string, version: number): Promise<PublishResult> {
    const manifest = await readManifest(this.dir);
    const meta = manifest.artifacts[slug];
    if (!meta) throw new Error(`unknown artifact: ${slug}`);
    if (!meta.versions.includes(version)) {
      throw new Error(`unknown version ${version} for artifact ${slug}`);
    }

    const stable = join(this.dir, `${slug}.html`);
    const content = await readFile(join(this.dir, `${slug}.v${version}.html`), "utf8");
    await writeFile(stable, content, "utf8");

    meta.current = version;
    meta.updatedAt = new Date().toISOString();
    meta.hash = contentHash(content);
    manifest.artifacts[slug] = meta;
    await writeFile(join(this.dir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const gallery = join(this.dir, GALLERY_FILE);
    await writeFile(gallery, renderGallery(manifest), "utf8");

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
