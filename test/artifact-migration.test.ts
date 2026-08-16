import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  executeArtifactMigration,
  mapLegacyCloudflareKey,
  planArtifactMigration,
  rollbackArtifactMigration,
} from "../src/artifact-migration.ts";
import { readArtifactManifestV2 } from "../src/artifact-schema.ts";

const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111";
const MIGRATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "artifact-migration-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function legacyMeta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "report",
    title: "Report",
    icon: "📄",
    createdAt: "2026-08-15T10:00:00Z",
    updatedAt: "2026-08-16T10:00:00Z",
    current: 1,
    versions: [1],
    charts: 0,
    bytes: 3,
    hash: "7692c3ad3540",
    ...overrides,
  };
}

function migrationOptions() {
  return {
    migrationId: MIGRATION_ID,
    artifactIdFactory: () => ARTIFACT_ID,
    now: "2026-08-16T20:00:00Z",
  };
}

test("unversioned legacy head migrates once with exact backup and rollback", async () => {
  await withTempDir(async (dir) => {
    const oldManifest = `${JSON.stringify({ artifacts: { report: legacyMeta() } }, null, 2)}\n`;
    const oldIndex = "legacy gallery";
    await writeFile(join(dir, "manifest.json"), oldManifest, "utf8");
    await writeFile(join(dir, "report.html"), "one", "utf8");
    await writeFile(join(dir, "index.html"), oldIndex, "utf8");

    const plan = await planArtifactMigration(dir, migrationOptions());
    assert.equal(plan.canMigrate, true);
    assert.equal(plan.manifest?.artifacts[ARTIFACT_ID].revisions.length, 1);
    assert.equal(plan.manifest?.artifacts[ARTIFACT_ID].contentHash, sha256("one"));
    assert.equal(plan.issues.some((entry) => entry.code === "missing-advertised-revision"), true);

    const result = await executeArtifactMigration(dir, plan);
    assert.equal(result.status, "migrated");
    const manifest = await readArtifactManifestV2(dir);
    assert.equal(manifest.slugIndex.report, ARTIFACT_ID);
    assert.equal(await readFile(join(dir, "revisions", ARTIFACT_ID, "1.html"), "utf8"), "one");
    assert.equal(await readFile(join(dir, "report.html"), "utf8"), "one");
    assert.equal(
      await readFile(join(dir, ".backups", "migrations", MIGRATION_ID, "files", "manifest.json"), "utf8"),
      oldManifest,
    );
    const report = await readFile(join(dir, ".migrations", MIGRATION_ID, "report.json"), "utf8");
    assert.ok(!report.includes("legacy gallery"));
    assert.ok(!report.includes('"one"'));

    const rollback = await rollbackArtifactMigration(dir, MIGRATION_ID);
    assert.equal(rollback.status, "rolled-back");
    assert.equal(await readFile(join(dir, "manifest.json"), "utf8"), oldManifest);
    assert.equal(await readFile(join(dir, "index.html"), "utf8"), oldIndex);
  });
});

test("legacy pointer restore becomes a final auditable revision without inventing missing bytes", async () => {
  await withTempDir(async (dir) => {
    const manifest = {
      artifacts: {
        report: legacyMeta({ current: 1, versions: [1, 2, 3] }),
      },
    };
    await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest), "utf8");
    await writeFile(join(dir, "report.v1.html"), "one", "utf8");
    await writeFile(join(dir, "report.v2.html"), "two", "utf8");
    await writeFile(join(dir, "report.html"), "one", "utf8");

    const plan = await planArtifactMigration(dir, migrationOptions());
    assert.equal(plan.canMigrate, true);
    const artifact = plan.manifest?.artifacts[ARTIFACT_ID];
    assert.equal(artifact?.revisions.length, 3);
    assert.deepEqual(
      artifact?.revisions.map((revision) => revision.contentHash),
      [sha256("one"), sha256("two"), sha256("one")],
    );
    assert.equal(artifact?.revisions[2].provenance.legacyRevision, 1);
    assert.equal(plan.issues.some((entry) => entry.code === "missing-advertised-revision"), true);
    assert.equal(plan.issues.some((entry) => entry.code === "selected-head-materialized"), true);
  });
});

test("malformed, future, irrecoverable, and changed sources never select schema 2", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "manifest.json"), "{", "utf8");
    const malformed = await planArtifactMigration(dir, migrationOptions());
    assert.equal(malformed.canMigrate, false);
    assert.equal(malformed.issues[0].code, "malformed-manifest");
    await assert.rejects(executeArtifactMigration(dir, malformed), /preflight failed/);
    await assert.rejects(access(join(dir, ".backups")));

    await writeFile(join(dir, "manifest.json"), JSON.stringify({ schemaVersion: 99 }), "utf8");
    const future = await planArtifactMigration(dir, migrationOptions());
    assert.equal(future.canMigrate, false);
    assert.equal(future.issues[0].code, "unknown-future-schema");

    await writeFile(
      join(dir, "manifest.json"),
      JSON.stringify({ artifacts: { report: legacyMeta() } }),
      "utf8",
    );
    const irrecoverable = await planArtifactMigration(dir, migrationOptions());
    assert.equal(irrecoverable.canMigrate, false);
    assert.equal(irrecoverable.issues.some((entry) => entry.code === "irrecoverable-legacy-artifact"), true);

    await writeFile(join(dir, "report.html"), "one", "utf8");
    const planned = await planArtifactMigration(dir, migrationOptions());
    await writeFile(join(dir, "report.html"), "changed", "utf8");
    await assert.rejects(executeArtifactMigration(dir, planned), /source changed after preflight/);
    assert.equal(JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")).schemaVersion, undefined);
  });
});

test("migration rejects managed symlinks before reading their targets", async () => {
  await withTempDir(async (dir) => {
    const outside = join(dir, "outside.json");
    await writeFile(outside, JSON.stringify({ artifacts: {} }), "utf8");
    await symlink(outside, join(dir, "manifest.json"));
    const plan = await planArtifactMigration(dir, migrationOptions());
    assert.equal(plan.canMigrate, false);
    assert.equal(
      plan.issues.some((entry) => entry.code === "unsafe-legacy-file" && entry.path === "manifest.json"),
      true,
    );
  });
});

test("migration maps local state and historical shared-KV keys only to known identity", async () => {
  await withTempDir(async (dir) => {
    await writeFile(
      join(dir, "manifest.json"),
      JSON.stringify({ artifacts: { report: legacyMeta() } }),
      "utf8",
    );
    await writeFile(join(dir, "report.html"), "one", "utf8");
    await mkdir(join(dir, ".state"), { recursive: true });
    await mkdir(join(dir, ".db", "report"), { recursive: true });
    await writeFile(join(dir, ".state", "report.json"), JSON.stringify({ answers: {} }), "utf8");
    await writeFile(join(dir, ".state", "report.comments.json"), JSON.stringify({ threads: [] }), "utf8");
    await writeFile(join(dir, ".db", "report", "notes.json"), JSON.stringify({ docs: {} }), "utf8");
    const plan = await planArtifactMigration(dir, migrationOptions());
    assert.deepEqual(
      plan.stateAssociations.map((entry) => entry.kind).sort(),
      ["collection", "comments", "decisions"],
    );
    assert.deepEqual(mapLegacyCloudflareKey("state:report", "site-1", plan.manifest?.slugIndex ?? {}), {
      siteId: "site-1",
      artifactId: ARTIFACT_ID,
      kind: "decisions",
    });
    assert.equal(
      "issue" in mapLegacyCloudflareKey("state:unknown", "site-1", plan.manifest?.slugIndex ?? {}),
      true,
    );
    assert.deepEqual(mapLegacyCloudflareKey("state:report", "../site", plan.manifest?.slugIndex ?? {}), {
      issue: {
        severity: "error",
        code: "invalid-site-id",
        detail: "site identity is not a safe canonical identifier",
      },
    });
  });
});

test("empty-store migration is idempotent and rollback restores manifest absence", async () => {
  await withTempDir(async (dir) => {
    const plan = await planArtifactMigration(dir, migrationOptions());
    assert.equal(plan.canMigrate, true);
    await executeArtifactMigration(dir, plan);
    const currentPlan = await planArtifactMigration(dir, {
      ...migrationOptions(),
      migrationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    assert.equal(currentPlan.alreadyCurrent, true);
    assert.equal((await executeArtifactMigration(dir, currentPlan)).status, "already-current");
    await rollbackArtifactMigration(dir, MIGRATION_ID);
    await assert.rejects(readFile(join(dir, "manifest.json"), "utf8"));
    await assert.rejects(readFile(join(dir, "index.html"), "utf8"));
  });
});
