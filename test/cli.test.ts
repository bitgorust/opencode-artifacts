import { execFile } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { ArtifactLifecycleStore } from "../src/artifact-lifecycle.ts";
import { cliInvocationMatchesModule } from "../src/cli.ts";

const run = promisify(execFile);
const CLI = join(process.cwd(), "src", "cli.ts");
const TOKEN = "ghp_0123456789abcdefABCDEF0123456789";

test("CLI entrypoint detection resolves an installed-bin symlink", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cli-entrypoint-"));
  try {
    const packageDir = join(dir, "package");
    const binDir = join(dir, "node_modules", ".bin");
    const modulePath = join(packageDir, "cli.js");
    const binPath = process.platform === "win32"
      ? join(binDir, "package", "cli.js")
      : join(binDir, "opencode-artifacts");
    await mkdir(packageDir);
    await mkdir(binDir, { recursive: true });
    await writeFile(modulePath, "// entrypoint\n");
    if (process.platform === "win32") await symlink(packageDir, join(binDir, "package"), "junction");
    else await symlink(modulePath, binPath, "file");
    assert.equal(cliInvocationMatchesModule(binPath, pathToFileURL(modulePath).href), true);
    assert.equal(cliInvocationMatchesModule(join(binDir, "missing"), pathToFileURL(modulePath).href), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

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

test("CLI lifecycle commands share schema-2 identities, CAS restore, archive, and bundles", { timeout: 15_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "cli-lifecycle-"));
  try {
    const root = join(dir, "artifacts");
    const id = "11111111-1111-4111-8111-111111111111";
    const store = new ArtifactLifecycleStore(root, { artifactIdFactory: () => id });
    await store.write({ slug: "report", html: "one", now: "2026-08-16T20:00:00Z" });
    const listed = JSON.parse((await run(process.execPath, [CLI, "list", "--dir", root])).stdout) as { artifacts: Array<{ id: string }> };
    assert.equal(listed.artifacts[0].id, id);
    assert.match((await run(process.execPath, [CLI, "status", id, "--dir", root])).stdout, /"headRevision": 1/);
    assert.equal((await run(process.execPath, [CLI, "read", "report", "--dir", root])).stdout, "one");
    await assert.rejects(
      run(process.execPath, [CLI, "restore", id, "--revision", "1", "--dir", root]),
      (error: Error & { stderr?: string }) => /requires --expected-revision/.test(error.stderr ?? ""),
    );
    assert.match((await run(process.execPath, [CLI, "restore", id, "--revision", "1", "--expected-revision", "1", "--dir", root])).stdout, /"headRevision": 2/);
    const preview = JSON.parse((await run(process.execPath, [CLI, "archive", id, "--preview", "--dir", root])).stdout) as { token: string };
    assert.match((await run(process.execPath, [CLI, "archive", "--confirm", preview.token, "--dir", root])).stdout, /"active": false/);
    assert.match((await run(process.execPath, [CLI, "unarchive", id, "--dir", root])).stdout, /"active": true/);
    const bundle = join(dir, "bundle");
    assert.match((await run(process.execPath, [CLI, "export", id, "--output", bundle, "--dir", root])).stdout, /"files"/);
    const importedRoot = join(dir, "imported");
    assert.match((await run(process.execPath, [CLI, "import", bundle, "--dir", importedRoot])).stdout, new RegExp(id));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("CLI migration exposes inspect, resumable apply, state association, and exact manifest rollback", { timeout: 15_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "cli-migrate-"));
  try {
    const root = join(dir, "artifacts");
    await mkdir(join(root, ".state"), { recursive: true });
    const oldManifest = `${JSON.stringify({ artifacts: { report: { slug: "report", title: "Report", icon: "📄", current: 1, versions: [1], charts: 0, bytes: 3, hash: "7692c3ad3540" } } }, null, 2)}\n`;
    await writeFile(join(root, "manifest.json"), oldManifest, "utf8");
    await writeFile(join(root, "report.html"), "one", "utf8");
    await writeFile(join(root, ".state", "report.json"), JSON.stringify({ answers: { ship: "yes" } }), "utf8");
    const inspected = JSON.parse((await run(process.execPath, [CLI, "migrate", "inspect", "--dir", root])).stdout) as { canMigrate: boolean };
    assert.equal(inspected.canMigrate, true);
    const applied = JSON.parse((await run(process.execPath, [CLI, "migrate", "apply", "--dir", root])).stdout) as { migrationId: string; stateMigrations: Array<{ stores: number }> };
    assert.equal(applied.stateMigrations[0].stores, 1);
    assert.equal(JSON.parse(await readFile(join(root, "manifest.json"), "utf8")).schemaVersion, 2);
    const repeated = JSON.parse((await run(process.execPath, [CLI, "migrate", "apply", "--dir", root])).stdout) as { status: string; stateMigrations: unknown[] };
    assert.equal(repeated.status, "already-current");
    assert.deepEqual(repeated.stateMigrations, []);
    await run(process.execPath, [CLI, "migrate", "rollback", "--migration-id", applied.migrationId, "--dir", root]);
    assert.equal(await readFile(join(root, "manifest.json"), "utf8"), oldManifest);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
