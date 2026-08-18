import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { test } from "node:test";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ArtifactStateConflictError,
  ArtifactStateError,
  artifactDocumentHash,
  executeLegacyStateMigration,
  mutateCollectionDocument,
  planLegacyStateMigration,
  readArtifactState,
  replaceArtifactState,
  rollbackLegacyStateMigration,
  validateArtifactStateEnvelope,
  type CollectionPayload,
  type DecisionPayload,
} from "../src/artifact-state.ts";
import {
  initialModeledState,
  modelDocument,
  modelReplace,
} from "./model/artifact-state-model.ts";

const ARTIFACT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const OP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WORKER = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "artifact-state-worker.ts");

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "artifact-state-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

interface WorkerResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function worker(args: string[]): { child: ChildProcessWithoutNullStreams; result: Promise<WorkerResult> } {
  const child = spawn(process.execPath, [WORKER, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  return {
    child,
    result: new Promise((resolveResult, rejectResult) => {
      child.on("error", rejectResult);
      child.on("exit", (code) => resolveResult({ code, stdout, stderr }));
    }),
  };
}

async function waitForFiles(paths: string[]): Promise<void> {
  const deadline = Date.now() + 5_000;
  for (;;) {
    const ready = await Promise.all(paths.map((path) => access(path).then(() => true, () => false)));
    if (ready.every(Boolean)) return;
    if (Date.now() >= deadline) throw new Error("state workers did not reach their barrier");
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}

test("decision CAS commits once, returns bounded conflict state, and replays exactly once", async () => {
  await withTempDir(async (root) => {
    const first = await replaceArtifactState({
      root,
      artifactId: ARTIFACT_ID,
      kind: "decisions",
      expectedRevision: 0,
      operationId: OP_A,
      payload: { answers: { layout: "tabs" } },
      now: "2026-08-16T20:00:00Z",
    });
    assert.equal(first.status, "committed");
    assert.equal(first.revision, 1);

    const replay = await replaceArtifactState({
      root,
      artifactId: ARTIFACT_ID,
      kind: "decisions",
      expectedRevision: 0,
      operationId: OP_A,
      payload: { answers: { layout: "tabs" } },
      now: "2026-08-16T20:00:01Z",
    });
    assert.equal(replay.status, "replayed");
    assert.equal(replay.revision, 1);
    assert.equal(replay.envelope.revision, 1);

    await assert.rejects(
      replaceArtifactState({
        root,
        artifactId: ARTIFACT_ID,
        kind: "decisions",
        expectedRevision: 0,
        operationId: OP_B,
        payload: { answers: { layout: "dense" } },
        now: "2026-08-16T20:00:02Z",
        limits: { conflictPreviewBytes: 16 },
      }),
      (error: unknown) => {
        assert.ok(error instanceof ArtifactStateConflictError);
        assert.equal(error.selectedRevision, 1);
        assert.ok(Buffer.byteLength(error.current, "utf8") <= 19);
        return true;
      },
    );
    const selected = await readArtifactState<DecisionPayload>(root, ARTIFACT_ID, "decisions");
    assert.deepEqual(selected.payload.answers, { layout: "tabs" });
  });
});

test("independent processes allow one winner for the same expected state revision", async () => {
  await withTempDir(async (root) => {
    const readyA = join(root, "ready-a");
    const readyB = join(root, "ready-b");
    const go = join(root, "go");
    const left = worker([root, ARTIFACT_ID, OP_A, "tabs", readyA, go]);
    const right = worker([root, ARTIFACT_ID, OP_B, "dense", readyB, go]);
    await waitForFiles([readyA, readyB]);
    await writeFile(go, "go", "utf8");
    const results = await Promise.all([left.result, right.result]);
    for (const result of results) assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(
      results.map((result) => (JSON.parse(result.stdout) as { status: string }).status).sort(),
      ["committed", "stale"],
    );
  });
});

test("distinct document mutations merge while same-document stale mutations conflict", async () => {
  await withTempDir(async (root) => {
    const [one, two] = await Promise.all([
      mutateCollectionDocument({
        root,
        artifactId: ARTIFACT_ID,
        collection: "notes",
        id: "one",
        operation: "set",
        document: { text: "first" },
        expectedRevision: 0,
        expectedDocumentHash: null,
        operationId: OP_A,
        now: "2026-08-16T20:00:00Z",
      }),
      mutateCollectionDocument({
        root,
        artifactId: ARTIFACT_ID,
        collection: "notes",
        id: "two",
        operation: "set",
        document: { text: "second" },
        expectedRevision: 0,
        expectedDocumentHash: null,
        operationId: OP_B,
        now: "2026-08-16T20:00:01Z",
      }),
    ]);
    assert.deepEqual([one.revision, two.revision].sort((a, b) => a - b), [1, 2]);
    const collection = await readArtifactState<CollectionPayload>(root, ARTIFACT_ID, "collection", "notes");
    assert.deepEqual(collection.payload.docs, {
      one: { text: "first" },
      two: { text: "second" },
    });

    await assert.rejects(
      mutateCollectionDocument({
        root,
        artifactId: ARTIFACT_ID,
        collection: "notes",
        id: "one",
        operation: "set",
        document: { text: "overwritten" },
        expectedRevision: 0,
        expectedDocumentHash: null,
        operationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
      ArtifactStateConflictError,
    );
    assert.equal(artifactDocumentHash({ text: "first" }), artifactDocumentHash(collection.payload.docs.one));
  });
});

test("shape, encoded-size, override, and rolling-rate limits reject before commit", async () => {
  await withTempDir(async (root) => {
    await assert.rejects(
      replaceArtifactState({
        root,
        artifactId: ARTIFACT_ID,
        kind: "decisions",
        expectedRevision: 0,
        operationId: OP_A,
        payload: { answers: { choice: "x".repeat(20) } },
        limits: { answerValueBytes: 8 },
      }),
      (error: unknown) => error instanceof ArtifactStateError && error.code === "quota",
    );
    assert.equal((await readArtifactState(root, ARTIFACT_ID, "decisions")).revision, 0);

    await assert.rejects(
      readArtifactState(root, ARTIFACT_ID, "decisions", "default", { answerCount: 2_000 }),
      /answerCount must be an integer within/,
    );

    const first = await replaceArtifactState({
      root,
      artifactId: ARTIFACT_ID,
      kind: "decisions",
      expectedRevision: 0,
      operationId: OP_A,
      payload: { answers: { one: "1" } },
      now: "2026-08-16T20:00:00Z",
      limits: { mutationRatePerMinute: 2, mutationWarningRatio: 0.5 },
    });
    assert.equal(first.warnings.length, 1);
    await assert.rejects(
      replaceArtifactState({
        root,
        artifactId: ARTIFACT_ID,
        kind: "decisions",
        expectedRevision: 1,
        operationId: OP_B,
        payload: { answers: { two: "2" } },
        now: "2026-08-16T20:00:01Z",
        limits: { mutationRatePerMinute: 1 },
      }),
      (error: unknown) => error instanceof ArtifactStateError && error.code === "rate-limit",
    );
    assert.equal((await readArtifactState(root, ARTIFACT_ID, "decisions")).revision, 1);
  });
});

test("future schemas, malformed hashes, symlinks, and cross-artifact envelopes fail closed", async () => {
  await withTempDir(async (root) => {
    const path = join(root, ".state", "v2", ARTIFACT_ID, "decisions.json");
    await mkdir(join(root, ".state", "v2", ARTIFACT_ID), { recursive: true });
    await writeFile(path, JSON.stringify({ schemaVersion: 99 }), "utf8");
    await assert.rejects(
      readArtifactState(root, ARTIFACT_ID, "decisions"),
      (error: unknown) => error instanceof ArtifactStateError && error.code === "future-schema",
    );

    const good = await readArtifactState<DecisionPayload>(root, OTHER_ID, "decisions");
    const wrong = { ...good, revision: 1, artifactId: OTHER_ID, updatedAt: "2026-08-16T20:00:00Z" };
    assert.throws(
      () => validateArtifactStateEnvelope(wrong, { artifactId: ARTIFACT_ID, kind: "decisions", key: "default" }),
      /belongs to another artifact/,
    );

    await rm(path);
    const outside = join(root, "outside.json");
    await writeFile(outside, "{}", "utf8");
    await symlink(outside, path);
    await assert.rejects(readArtifactState(root, ARTIFACT_ID, "decisions"), /not a regular file/);
    assert.equal(await readFile(outside, "utf8"), "{}");
  });
});

test("operation ledgers stay revision-ordered when caller clocks move backward", async () => {
  await withTempDir(async (root) => {
    const first = await replaceArtifactState({
      root,
      artifactId: ARTIFACT_ID,
      kind: "decisions",
      expectedRevision: 0,
      operationId: OP_A,
      payload: { answers: { layout: "tabs" } },
      now: "2026-08-16T20:00:01Z",
    });
    const second = await replaceArtifactState({
      root,
      artifactId: ARTIFACT_ID,
      kind: "decisions",
      expectedRevision: 1,
      operationId: OP_B,
      payload: { answers: { layout: "dense" } },
      now: "2026-08-16T20:00:00Z",
    });
    assert.equal(second.envelope.updatedAt, first.envelope.updatedAt);
    assert.equal(second.envelope.operations[1]?.committedAt, first.envelope.updatedAt);

    const unordered = structuredClone(second.envelope);
    unordered.operations[1]!.revision = 1;
    assert.throws(
      () => validateArtifactStateEnvelope(unordered, { artifactId: ARTIFACT_ID, kind: "decisions", key: "default" }),
      /operation ledger is malformed/,
    );

    const futureDated = structuredClone(second.envelope);
    futureDated.operations[1]!.committedAt = "2026-08-16T20:00:02Z";
    assert.throws(
      () => validateArtifactStateEnvelope(futureDated, { artifactId: ARTIFACT_ID, kind: "decisions", key: "default" }),
      /operation ledger is malformed/,
    );
  });
});

test("bounded CAS model exhaustively preserves one-winner, replay, and distinct-document properties", () => {
  const values = ["a", "b"];
  for (const left of values) {
    for (const right of values) {
      for (const order of [[left, right], [right, left]]) {
        let state = initialModeledState();
        const first = modelReplace(state, "op-a", 0, { choice: order[0] });
        state = first.state;
        const second = modelReplace(state, "op-b", 0, { choice: order[1] });
        assert.deepEqual([first.result, second.result], ["committed", "stale"]);
        assert.equal(state.revision, 1);
        const replay = modelReplace(state, "op-a", 0, { choice: order[0] });
        assert.equal(replay.result, "replayed");
        assert.equal(replay.state.revision, 1);
        assert.equal(modelReplace(state, "op-a", 1, { choice: "different" }).result, "replay-conflict");
      }
    }
  }

  let documents = initialModeledState();
  documents = modelDocument(documents, "op-a", "one", undefined, "first").state;
  documents = modelDocument(documents, "op-b", "two", undefined, "second").state;
  assert.deepEqual(documents.value, { one: "first", two: "second" });
  assert.equal(documents.revision, 2);
  assert.equal(modelDocument(documents, "op-c", "one", undefined, "lost").result, "stale");
});

test("legacy decision, comment, and collection stores migrate idempotently with exact backup and rollback", async () => {
  await withTempDir(async (root) => {
    await mkdir(join(root, ".state"), { recursive: true });
    await mkdir(join(root, ".db", "board"), { recursive: true });
    const decisions = `${JSON.stringify({ answers: { layout: "tabs" }, updatedAt: "old" }, null, 2)}\n`;
    const comments = `${JSON.stringify({ threads: [{ id: "t1", quote: "q", text: "fix", createdAt: "2026-08-16T20:00:00Z", resolved: false }] }, null, 2)}\n`;
    const collection = `${JSON.stringify({ docs: { n1: { text: "one" } } }, null, 2)}\n`;
    await writeFile(join(root, ".state", "board.json"), decisions, "utf8");
    await writeFile(join(root, ".state", "board.comments.json"), comments, "utf8");
    await writeFile(join(root, ".db", "board", "notes.json"), collection, "utf8");
    const plan = await planLegacyStateMigration(root, ARTIFACT_ID, "board", {
      migrationId: OP_A,
      now: "2026-08-16T20:00:00Z",
    });
    assert.equal(plan.items.length, 3);
    await executeLegacyStateMigration(root, plan);
    await executeLegacyStateMigration(root, plan);
    assert.deepEqual((await readArtifactState<DecisionPayload>(root, ARTIFACT_ID, "decisions")).payload.answers, { layout: "tabs" });
    assert.deepEqual((await readArtifactState<CollectionPayload>(root, ARTIFACT_ID, "collection", "notes")).payload.docs, { n1: { text: "one" } });
    assert.equal(
      await readFile(join(root, ".backups", "state-v2", OP_A, "files", ".state", "board.json"), "utf8"),
      decisions,
    );
    await rollbackLegacyStateMigration(root, plan);
    assert.equal(await readFile(join(root, ".state", "board.json"), "utf8"), decisions);
    await assert.rejects(readFile(join(root, ".state", "v2", ARTIFACT_ID, "decisions.json"), "utf8"));
  });
});
