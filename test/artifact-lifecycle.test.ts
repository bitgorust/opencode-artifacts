import assert from "node:assert/strict";
import { test } from "node:test";
import { access, cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ArtifactLifecycleConflictError,
  ArtifactLifecycleStore,
  ArtifactReferenceError,
} from "../src/artifact-lifecycle.ts";
import { readArtifactManifestV2 } from "../src/artifact-schema.ts";
import { mutateCollectionDocument, readArtifactState, replaceArtifactState, type CollectionPayload } from "../src/artifact-state.ts";
import { modelArchive, modelPreview, modelRestore, modelUnarchive, type ModeledArtifact } from "./model/artifact-lifecycle-model.ts";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "artifact-lifecycle-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("exact references, stale merge payloads, rename, and auditable restore preserve identity", async () => {
  await withTempDir(async (dir) => {
    const ids = [ID_A, ID_B];
    const store = new ArtifactLifecycleStore(dir, { artifactIdFactory: () => ids.shift() ?? ID_B });
    const created = await store.write({
      slug: "report",
      html: "one",
      title: "Report",
      authoringSource: "# One",
      inputFormat: "markdown",
      now: "2026-08-16T20:00:00Z",
    });
    assert.equal(created.id, ID_A);
    assert.equal((await store.status(ID_A)).slug, "report");
    assert.equal((await store.status("report")).id, ID_A);
    assert.equal((await store.status(join(dir, "report.html"))).id, ID_A);
    assert.equal((await store.status(join(dir, "revisions", ID_A, "1.html"))).id, ID_A);

    await assert.rejects(
      store.write({ slug: "report", html: "collision" }),
      (error: unknown) => error instanceof ArtifactLifecycleConflictError && error.merge.inline === "# One",
    );
    await assert.rejects(
      store.write({ artifact: ID_A, slug: "report", html: "stale", expectedRevision: 0 }),
      ArtifactLifecycleConflictError,
    );
    const updated = await store.write({
      artifact: "report",
      slug: "renamed-report",
      html: "two",
      expectedRevision: 1,
      authoringSource: "# Two",
      inputFormat: "markdown",
      now: "2026-08-16T20:01:00Z",
    });
    assert.equal(updated.id, ID_A);
    assert.equal(updated.headRevision, 2);
    await assert.rejects(store.status("report"), ArtifactReferenceError);
    await assert.rejects(access(join(dir, "report.html")));
    assert.equal((await readArtifactManifestV2(dir)).artifacts[ID_A].revisions[0].contentHash, created.contentHash);

    const restored = await store.restore(ID_A, 1, 2);
    assert.equal(restored.headRevision, 3);
    const manifest = await readArtifactManifestV2(dir);
    assert.deepEqual(manifest.artifacts[ID_A].revisions[2].provenance, {
      kind: "restore",
      restoredFrom: 1,
      timestampSource: "recorded",
    });
    assert.equal(await readFile(join(dir, ".sources", ID_A, "3.markdown.txt"), "utf8"), "# One");
    await assert.rejects(store.restore(ID_A, 1, 2), ArtifactLifecycleConflictError);

    await assert.rejects(store.status("Report"), ArtifactReferenceError);
    await assert.rejects(store.status("..%2Foutside.html"), /encoded or backslash/);
    await assert.rejects(store.status("file:///etc/passwd"), /scheme is unsupported/);
    await store.recordDeployment(ID_A, { capability: "public-static", target: "fixture", url: "https://example.test/report.html", createdAt: "2026-08-16T20:03:00Z" });
    assert.equal((await store.status("https://example.test/report.html")).id, ID_A);
    await store.write({ slug: "other", html: "other", now: "2026-08-16T20:04:00Z" });
    await store.recordDeployment(ID_B, { capability: "public-static", target: "fixture-2", url: "https://example.test/report.html", createdAt: "2026-08-16T20:05:00Z" });
    await assert.rejects(store.status("https://example.test/report.html"), /ambiguous/);
    const outside = join(dir, "outside.html");
    await writeFile(outside, "outside", "utf8");
    await symlink(outside, join(dir, "link.html"));
    await assert.rejects(store.status(join(dir, "link.html")), /absent or unsafe/);
  });
});

test("archive confirmation is head-bound, one-use, and recoverable under explicit slug conflict", async () => {
  await withTempDir(async (dir) => {
    const ids = [ID_A, ID_B];
    const store = new ArtifactLifecycleStore(dir, { artifactIdFactory: () => ids.shift() ?? ID_B });
    await store.write({ slug: "report", html: "one", now: "2026-08-16T20:00:00Z" });
    await replaceArtifactState({
      root: dir,
      artifactId: ID_A,
      kind: "decisions",
      expectedRevision: 0,
      operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      payload: { answers: { choice: "yes" } },
      now: "2026-08-16T20:00:00Z",
    });
    const preview = await store.previewArchive(ID_A, {
      token: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      now: "2026-08-16T20:01:00Z",
    });
    assert.equal(preview.artifact.id, ID_A);
    assert.equal(preview.stateStoreCount, 1);
    assert.equal(preview.externalCopiesDeleted, false);

    await store.write({ artifact: ID_A, slug: "report", html: "two", expectedRevision: 1, now: "2026-08-16T20:02:00Z" });
    await assert.rejects(
      store.archive(preview.token, { now: "2026-08-16T20:03:00Z" }),
      /scope changed/,
    );
    const fresh = await store.previewArchive(ID_A, {
      token: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      now: "2026-08-16T20:04:00Z",
    });
    const archived = await store.archive(fresh.token, { now: "2026-08-16T20:05:00Z" });
    assert.equal(archived.active, false);
    assert.equal((await store.status(ID_A)).active, false);
    assert.deepEqual(await store.list(), []);
    await assert.rejects(access(join(dir, "report.html")));
    await assert.rejects(store.archive(fresh.token), /ENOENT/);

    await store.write({ slug: "report", html: "other", now: "2026-08-16T20:06:00Z" });
    await assert.rejects(store.unarchive(ID_A), /belongs to another active artifact/);
    const active = await store.unarchive(ID_A, "recovered-report");
    assert.equal(active.id, ID_A);
    assert.equal(active.slug, "recovered-report");
    assert.equal((await store.status(ID_A)).active, true);
  });
});

test("checksummed directory bundles round-trip identity, history, sources, and state after full preflight", async () => {
  await withTempDir(async (dir) => {
    const sourceRoot = join(dir, "source");
    const source = new ArtifactLifecycleStore(sourceRoot, { artifactIdFactory: () => ID_A });
    await source.write({ slug: "report", html: "one", authoringSource: "# One", inputFormat: "markdown", now: "2026-08-16T20:00:00Z" });
    await source.write({ artifact: ID_A, slug: "report", html: "two", expectedRevision: 1, authoringSource: "# Two", inputFormat: "markdown", now: "2026-08-16T20:01:00Z" });
    await replaceArtifactState({ root: sourceRoot, artifactId: ID_A, kind: "decisions", expectedRevision: 0, operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", payload: { answers: { ship: "yes" } }, now: "2026-08-16T20:02:00Z" });
    await mutateCollectionDocument({ root: sourceRoot, artifactId: ID_A, collection: "notes", id: "n1", operation: "set", document: { text: "keep" }, expectedRevision: 0, expectedDocumentHash: null, operationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", now: "2026-08-16T20:03:00Z" });

    const bundle = join(dir, "bundle");
    const exported = await source.exportBundle(ID_A, bundle);
    assert.equal(exported.files, 6);
    const badBundle = join(dir, "bad-bundle");
    await cp(bundle, badBundle, { recursive: true });
    await writeFile(join(badBundle, "pages", "2.html"), "corrupt", "utf8");
    const targetRoot = join(dir, "target");
    const target = new ArtifactLifecycleStore(targetRoot);
    await assert.rejects(target.importBundle(badBundle), /bundle\/store file exceeds|bundle verification failed/);
    assert.deepEqual(await target.list(), []);
    const extraBundle = join(dir, "extra-bundle");
    await cp(bundle, extraBundle, { recursive: true });
    await writeFile(join(extraBundle, "unlisted.txt"), "surprise", "utf8");
    await assert.rejects(target.importBundle(extraBundle), /missing or unlisted files/);
    const futureBundle = join(dir, "future-bundle");
    await cp(bundle, futureBundle, { recursive: true });
    const futureManifest = JSON.parse(await readFile(join(futureBundle, "bundle.json"), "utf8")) as Record<string, unknown>;
    futureManifest["schemaVersion"] = 99;
    await writeFile(join(futureBundle, "bundle.json"), JSON.stringify(futureManifest), "utf8");
    await assert.rejects(target.importBundle(futureBundle), /unsupported future schema/);

    const imported = await target.importBundle(bundle);
    assert.equal(imported.id, ID_A);
    assert.equal(imported.headRevision, 2);
    assert.equal((await target.read(ID_A, 1)).html, "one");
    assert.equal(await readFile(join(targetRoot, ".sources", ID_A, "2.markdown.txt"), "utf8"), "# Two");
    assert.deepEqual((await readArtifactState(targetRoot, ID_A, "decisions")).payload, { answers: { ship: "yes" } });
    assert.deepEqual((await readArtifactState<CollectionPayload>(targetRoot, ID_A, "collection", "notes")).payload.docs, { n1: { text: "keep" } });
    assert.deepEqual((await readArtifactManifestV2(targetRoot)).artifacts[ID_A], (await readArtifactManifestV2(sourceRoot)).artifacts[ID_A]);
    await assert.rejects(target.importBundle(bundle), /collides/);
  });
});

test("bounded lifecycle model exhaustively keeps restore append-only and archive tokens scope-bound", () => {
  const initial: ModeledArtifact = { id: ID_A, slug: "report", active: true, head: 2, history: ["one", "two"] };
  for (const from of [0, 1, 2, 3]) {
    for (const expected of [1, 2, 3]) {
      const result = modelRestore(initial, from, expected);
      if (from >= 1 && from <= 2 && expected === 2) {
        assert.equal(result.result, "committed");
        assert.equal(result.artifact.head, 3);
        assert.deepEqual(result.artifact.history.slice(0, 2), initial.history);
        assert.equal(result.artifact.history[2], initial.history[from - 1]);
      } else {
        assert.notEqual(result.result, "committed");
        assert.deepEqual(result.artifact, initial);
      }
    }
  }
  const preview = modelPreview(initial);
  assert.equal(modelArchive(initial, preview).result, "committed");
  const changed = modelRestore(initial, 1, 2).artifact;
  assert.equal(modelArchive(changed, preview).result, "stale");
  const archived = modelArchive(initial, preview).artifact;
  assert.equal(modelUnarchive(archived, new Set(["report"])).result, "conflict");
  const recovered = modelUnarchive(archived, new Set(["report"]), "recovered-report");
  assert.equal(recovered.result, "committed");
  assert.equal(recovered.artifact.id, ID_A);
  assert.deepEqual(recovered.artifact.history, initial.history);
});
