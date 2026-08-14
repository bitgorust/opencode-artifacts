#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { renderArtifact } from "./render.ts";
import { FilePublisher, slugify } from "./publisher.ts";
import { openFile } from "./open.ts";

function usage(): never {
  console.error("usage: opencode-artifacts render <input.md> [-o <out.html>] [--open] [--title <title>]");
  process.exit(2);
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (command !== "render") usage();

  let input: string | undefined;
  let out: string | undefined;
  let title: string | undefined;
  let open = false;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--open") open = true;
    else if (arg === "-o") out = rest[++i];
    else if (arg === "--title") title = rest[++i];
    else if (!arg.startsWith("-") && input === undefined) input = arg;
    else usage();
  }
  if (!input) usage();

  const markdown = await readFile(input, "utf8");
  const rendered = renderArtifact(markdown);
  const finalTitle = title ?? rendered.meta.title ?? "Artifact";

  let outPath: string;
  if (out) {
    outPath = resolve(out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, rendered.html, "utf8");
  } else {
    const publisher = new FilePublisher(process.cwd());
    const result = await publisher.publish({ slug: slugify(finalTitle), html: rendered.html });
    outPath = result.path;
  }

  if (open) openFile(outPath);
  console.log(outPath);
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
