import { createHash } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ArtifactMigrationRequiredError,
  ArtifactSchemaError,
  emptyArtifactManifestV2,
  readArtifactManifestV2,
  validateArtifactManifestV2,
  type ArtifactManifestV2,
} from "../src/artifact-schema.ts";

const ID = "11111111-1111-4111-8111-111111111111";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validManifest(): ArtifactManifestV2 {
  const contentHash = sha256("page");
  return {
    schemaVersion: 2,
    artifacts: {
      [ID]: {
        id: ID,
        slug: "report",
        title: "Report",
        icon: "📄",
        createdAt: "2026-08-16T10:00:00Z",
        updatedAt: "2026-08-16T11:00:00Z",
        headRevision: 1,
        revisions: [
          {
            revision: 1,
            createdAt: "2026-08-16T11:00:00Z",
            bytes: 4,
            contentHash,
            pagePath: `revisions/${ID}/1.html`,
            title: "Report",
            icon: "📄",
            charts: 0,
            provenance: { kind: "create", timestampSource: "recorded" },
          },
        ],
        charts: 0,
        bytes: 4,
        contentHash,
        deploymentReferences: [],
      },
    },
    slugIndex: { report: ID },
  };
}

test("schema 2 validates exact identity, revision, head, and slug-index invariants", () => {
  assert.deepEqual(validateArtifactManifestV2(validManifest()), validManifest());

  const extra = structuredClone(validManifest()) as ArtifactManifestV2 & { surprise?: boolean };
  extra.surprise = true;
  assert.throws(() => validateArtifactManifestV2(extra), ArtifactSchemaError);

  const badRevision = structuredClone(validManifest());
  badRevision.artifacts[ID].revisions[0].revision = 2;
  assert.throws(() => validateArtifactManifestV2(badRevision), /must be contiguous/);

  const badIndex = structuredClone(validManifest());
  badIndex.slugIndex.report = "22222222-2222-4222-8222-222222222222";
  assert.throws(() => validateArtifactManifestV2(badIndex), /does not match artifact records/);

  const badHead = structuredClone(validManifest());
  badHead.artifacts[ID].contentHash = sha256("other");
  assert.throws(() => validateArtifactManifestV2(badHead), /must match the head revision/);
});

test("schema reader distinguishes absent, legacy, malformed, and unknown future manifests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "artifact-schema-"));
  try {
    assert.deepEqual(await readArtifactManifestV2(dir), emptyArtifactManifestV2());

    await writeFile(join(dir, "manifest.json"), JSON.stringify({ artifacts: {} }), "utf8");
    await assert.rejects(readArtifactManifestV2(dir), ArtifactMigrationRequiredError);

    await writeFile(join(dir, "manifest.json"), "{", "utf8");
    await assert.rejects(readArtifactManifestV2(dir), ArtifactSchemaError);

    const future = `${JSON.stringify({ schemaVersion: 99, artifacts: {}, slugIndex: {} })}\n`;
    await writeFile(join(dir, "manifest.json"), future, "utf8");
    await assert.rejects(readArtifactManifestV2(dir), /unsupported future or unknown schemaVersion 99/);
    assert.equal(await readFile(join(dir, "manifest.json"), "utf8"), future);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("schema reader rejects a manifest symlink", async () => {
  const dir = await mkdtemp(join(tmpdir(), "artifact-schema-link-"));
  try {
    const outside = join(dir, "outside.json");
    await writeFile(outside, JSON.stringify(emptyArtifactManifestV2()), "utf8");
    await symlink(outside, join(dir, "manifest.json"));
    await assert.rejects(readArtifactManifestV2(dir), /manifest path must be a regular file/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
