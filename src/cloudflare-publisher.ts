import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FilePublisher, type PublishInput, type PublishResult, type Publisher } from "./publisher.ts";
import { copyArtifacts, type Runner, runProcess } from "./github-pages.ts";

export interface CloudflareOptions {
  workerName: string;
  stagingDir: string;
  runner?: Runner;
}

const WRANGLER_TOML = (name: string, main: string, kvId: string) => `name = "${name}"
main = "${main}"
compatibility_date = "2025-06-01"

[assets]
directory = "assets"

[[kv_namespaces]]
binding = "ARTIFACTS_KV"
id = "${kvId}"
`;

function distDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
}

export class CloudflarePublisher implements Publisher {
  private readonly local: FilePublisher;
  private readonly localDir: string;
  private readonly workerName: string;
  private readonly stagingDir: string;
  private readonly runner: Runner;

  constructor(localDir: string, options: CloudflareOptions) {
    this.local = new FilePublisher(localDir);
    this.localDir = localDir;
    this.workerName = options.workerName;
    this.stagingDir = options.stagingDir;
    this.runner = options.runner ?? runProcess;
  }

  async publish(input: PublishInput): Promise<PublishResult> {
    const result = await this.local.publish(input);
    const url = await this.deploy();
    return { ...result, url: url === undefined ? undefined : `${url}/${input.slug}.html` };
  }

  async deploy(): Promise<string | undefined> {
    const main = await this.stage();
    const kvId = await this.ensureKvNamespace();
    await writeFile(
      join(this.stagingDir, "wrangler.toml"),
      WRANGLER_TOML(this.workerName, main, kvId),
      "utf8",
    );
    const output = await this.runner("npx", [
      "wrangler",
      "deploy",
      "--config",
      join(this.stagingDir, "wrangler.toml"),
    ]);
    const match = output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/);
    return match?.[0];
  }

  private async stage(): Promise<string> {
    const dist = distDir();
    const main = join(this.stagingDir, "main");
    await mkdir(join(main, "cloudflare"), { recursive: true });
    await mkdir(join(this.stagingDir, "assets"), { recursive: true });

    for (const file of ["worker.js", "handler.js"]) {
      await cp(join(dist, "cloudflare", file), join(main, "cloudflare", file));
    }
    await cp(join(dist, "served-html.js"), join(main, "served-html.js"));
    await copyArtifacts(this.localDir, join(this.stagingDir, "assets"));

    return "main/cloudflare/worker.js";
  }

  private async ensureKvNamespace(): Promise<string> {
    const idFile = join(this.stagingDir, "kv-id.txt");
    try {
      const cached = (await readFile(idFile, "utf8")).trim();
      if (/^[0-9a-f]{32}$/.test(cached)) return cached;
    } catch {
      // first deploy: create the namespace
    }
    const output = await this.runner("npx", [
      "wrangler",
      "kv",
      "namespace",
      "create",
      "ARTIFACTS_KV",
    ]);
    const match = output.match(/id\s*=\s*"([0-9a-f]{32})"/);
    if (!match) {
      throw new Error(
        `could not parse KV namespace id from wrangler output: ${output.slice(0, 300)}`,
      );
    }
    await mkdir(this.stagingDir, { recursive: true });
    await writeFile(idFile, match[1], "utf8");
    return match[1];
  }
}
