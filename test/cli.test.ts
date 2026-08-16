import { execFile } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const CLI = join(process.cwd(), "src", "cli.ts");
const TOKEN = "ghp_0123456789abcdefABCDEF0123456789";

test("render scans a title override for sensitive content", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cli-title-"));
  try {
    const input = join(dir, "clean.md");
    await writeFile(input, "# Clean\n");
    await assert.rejects(
      run(process.execPath, [CLI, "render", input, "--title", TOKEN, "-o", join(dir, "out.html")]),
      (err: Error & { stderr?: string }) => /publish blocked/.test(err.stderr ?? ""),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("deploy scans existing artifact files before invoking a host", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cli-deploy-"));
  try {
    await writeFile(join(dir, "copied.html"), `<h1>${TOKEN}</h1>`);
    await assert.rejects(
      run(process.execPath, [CLI, "deploy", "--dir", dir, "--repo", "owner/site"]),
      (err: Error & { stderr?: string }) => /deploy blocked/.test(err.stderr ?? ""),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("deploy scans provider configuration before invoking a host", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cli-deploy-config-"));
  try {
    await writeFile(join(dir, "clean.html"), "<h1>clean</h1>");
    await assert.rejects(
      run(process.execPath, [
        CLI,
        "deploy",
        "--dir",
        dir,
        "--repo",
        "owner/ghp_0123456789abcdefABCDEF0123456789",
      ]),
      (err: Error & { stderr?: string }) => /deploy blocked.*deployment-config/.test(err.stderr ?? ""),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
