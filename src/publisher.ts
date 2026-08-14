import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug.length > 0 ? slug : "artifact";
}

export interface PublishInput {
  slug: string;
  html: string;
  version?: boolean;
}

export interface PublishResult {
  path: string;
  version: number;
}

export interface Publisher {
  publish(input: PublishInput): Promise<PublishResult>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class FilePublisher implements Publisher {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    await mkdir(this.dir, { recursive: true });
    const stable = join(this.dir, `${input.slug}.html`);

    if (!input.version) {
      await writeFile(stable, input.html, "utf8");
      return { path: stable, version: 1 };
    }

    const pattern = new RegExp(`^${escapeRegExp(input.slug)}\\.v(\\d+)\\.html$`);
    let max = 0;
    for (const name of await readdir(this.dir)) {
      const match = name.match(pattern);
      if (match) max = Math.max(max, Number(match[1]));
    }
    const version = max + 1;
    await writeFile(join(this.dir, `${input.slug}.v${version}.html`), input.html, "utf8");
    await writeFile(stable, input.html, "utf8");
    return { path: stable, version };
  }
}
