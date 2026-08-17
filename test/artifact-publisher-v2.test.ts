import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readArtifactManifestV2 } from "../src/artifact-schema.ts";
import {
  executeArtifactMigration,
  planArtifactMigration,
} from "../src/artifact-migration.ts";
import { FilePublisher, StaleArtifactError } from "../src/publisher.ts";

const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "artifact-publisher-v2-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("schema-2 publishing keeps opaque identity and unconditional immutable history", async () => {
  await withTempDir(async (dir) => {
    let idCalls = 0;
    const publisher = new FilePublisher(dir, {
      schemaVersion: 2,
      artifactIdFactory: () => {
        idCalls++;
        return ARTIFACT_ID;
      },
    });
    const first = await publisher.publish({
      slug: "report",
      html: "one\n<!--artifact:footer-->",
      title: "Report",
      version: false,
    });
    const second = await publisher.publish({
      slug: "report",
      html: "two\n<!--artifact:footer-->",
      title: "Report renamed",
      version: false,
      expectedHash: first.hash,
    });
    assert.equal(idCalls, 1);
    assert.equal(first.version, 1);
    assert.equal(second.version, 2);
    const manifest = await readArtifactManifestV2(dir);
    assert.equal(manifest.slugIndex.report, ARTIFACT_ID);
    const artifact = manifest.artifacts[ARTIFACT_ID];
    assert.equal(artifact.title, "Report renamed");
    assert.equal(artifact.revisions.length, 2);
    assert.equal(artifact.revisions[0].provenance.kind, "create");
    assert.equal(artifact.revisions[1].provenance.kind, "update");
    assert.notEqual(artifact.revisions[0].contentHash, artifact.revisions[1].contentHash);
    assert.match(await readFile(join(dir, "revisions", ARTIFACT_ID, "1.html"), "utf8"), /^one/);
    assert.match(await readFile(join(dir, "revisions", ARTIFACT_ID, "2.html"), "utf8"), /^two/);
    assert.match(await readFile(join(dir, "report.v1.html"), "utf8"), /^one/);
    assert.match(await readFile(join(dir, "report.v2.html"), "utf8"), /^two/);
  });
});

test("schema-2 stale guard is atomic and restore appends an auditable revision", async () => {
  await withTempDir(async (dir) => {
    const options = { schemaVersion: 2 as const, artifactIdFactory: () => ARTIFACT_ID };
    const publisher = new FilePublisher(dir, options);
    const first = await publisher.publish({
      slug: "report",
      html: "one\n<!--artifact:footer-->",
    });
    const results = await Promise.allSettled([
      new FilePublisher(dir, options).publish({
        slug: "report",
        html: "two\n<!--artifact:footer-->",
        expectedHash: first.hash,
      }),
      new FilePublisher(dir, options).publish({
        slug: "report",
        html: "three\n<!--artifact:footer-->",
        expectedHash: first.hash,
      }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.ok(rejected.reason instanceof StaleArtifactError);

    await assert.rejects(publisher.restore("report", 1), StaleArtifactError);
    const restored = await publisher.restore("report", 1, 2);
    assert.equal(restored.version, 3);
    const manifest = await readArtifactManifestV2(dir);
    const artifact = manifest.artifacts[ARTIFACT_ID];
    assert.equal(artifact.headRevision, 3);
    assert.equal(artifact.revisions[2].provenance.kind, "restore");
    assert.equal(artifact.revisions[2].provenance.restoredFrom, 1);
    assert.match(await readFile(join(dir, "report.html"), "utf8"), /· v3 ·/);
    assert.match(await readFile(join(dir, "revisions", ARTIFACT_ID, "1.html"), "utf8"), /· v1 ·/);
  });
});

test("schema-2 publishing refuses legacy data until explicit migration, then preserves identity", async () => {
  await withTempDir(async (dir) => {
    const legacyManifest = {
      artifacts: {
        report: {
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
        },
      },
    };
    await writeFile(join(dir, "manifest.json"), JSON.stringify(legacyManifest), "utf8");
    await writeFile(join(dir, "report.html"), "one", "utf8");
    const publisher = new FilePublisher(dir, {
      schemaVersion: 2,
      artifactIdFactory: () => ARTIFACT_ID,
    });
    await assert.rejects(
      publisher.publish({ slug: "report", html: "two" }),
      /run lifecycle migration preflight/,
    );
    assert.equal(await readFile(join(dir, "report.html"), "utf8"), "one");

    const plan = await planArtifactMigration(dir, {
      migrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      artifactIdFactory: () => ARTIFACT_ID,
      now: "2026-08-16T20:00:00Z",
    });
    await executeArtifactMigration(dir, plan);
    const result = await publisher.publish({ slug: "report", html: "two", expectedHash: plan.manifest?.artifacts[ARTIFACT_ID].contentHash.slice(0, 12) });
    assert.equal(result.version, 2);
    const manifest = await readArtifactManifestV2(dir);
    assert.equal(manifest.slugIndex.report, ARTIFACT_ID);
    assert.equal(manifest.artifacts[ARTIFACT_ID].revisions.length, 2);
  });
});
