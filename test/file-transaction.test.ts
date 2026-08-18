import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  recoverFileTransactions,
  runFileTransaction,
  TransactionCommitError,
  TransactionLockTimeoutError,
  TransactionRecoveryError,
  TRANSACTION_DIRECTORY,
} from "../src/file-transaction.ts";
import { FilePublisher, type Manifest } from "../src/publisher.ts";
import {
  ALL_TRANSACTION_FAULT_POINTS,
  modeledOutcome,
} from "./model/file-transaction-model.ts";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "file-transaction-worker.ts");

interface WorkerResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "file-transaction-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function startWorker(args: string[]): {
  child: ChildProcessWithoutNullStreams;
  result: Promise<WorkerResult>;
} {
  const child = spawn(process.execPath, [FIXTURE, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const result = new Promise<WorkerResult>((resolveResult, rejectResult) => {
    child.on("error", rejectResult);
    child.on("exit", (code) => resolveResult({ code, stdout, stderr }));
  });
  return { child, result };
}

async function waitForFiles(paths: string[]): Promise<void> {
  const deadline = Date.now() + 5_000;
  for (;;) {
    const found = await Promise.all(
      paths.map((path) => access(path).then(() => true, () => false)),
    );
    if (found.every(Boolean)) return;
    if (Date.now() >= deadline) throw new Error(`workers did not reach barrier: ${paths.join(", ")}`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}

test("independent processes allow one same-head winner", async () => {
  await withTempDir(async (dir) => {
    const first = await new FilePublisher(dir).publish({ slug: "report", html: "one" });
    const readyA = join(dir, "ready-a");
    const readyB = join(dir, "ready-b");
    const go = join(dir, "go");
    const workerA = startWorker(["publish", dir, "report", "two", first.hash, readyA, go]);
    const workerB = startWorker(["publish", dir, "report", "three", first.hash, readyB, go]);
    await waitForFiles([readyA, readyB]);
    await writeFile(go, "go", "utf8");
    const results = await Promise.all([workerA.result, workerB.result]);
    assert.deepEqual(results.map((result) => result.code), [0, 0]);
    const statuses = results.map((result) => {
      assert.equal(result.stderr, "");
      return (JSON.parse(result.stdout) as { status: string }).status;
    });
    assert.deepEqual(statuses.sort(), ["committed", "stale"]);
  });
});

test("rapid in-process lock handoff retries when the observed lock already vanished", async () => {
  await withTempDir(async (dir) => {
    const completions = await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        runFileTransaction(dir, async () => index, { lockTimeoutMs: 10_000, pollIntervalMs: 1 })),
    );
    assert.deepEqual(completions.sort((left, right) => left - right), Array.from({ length: 24 }, (_, index) => index));
  });
});

test("independent processes do not lose different-artifact manifest entries", async () => {
  await withTempDir(async (dir) => {
    const readyA = join(dir, "ready-a");
    const readyB = join(dir, "ready-b");
    const go = join(dir, "go");
    const workerA = startWorker(["publish", dir, "alpha", "one", "-", readyA, go]);
    const workerB = startWorker(["publish", dir, "beta", "two", "-", readyB, go]);
    await waitForFiles([readyA, readyB]);
    await writeFile(go, "go", "utf8");
    const results = await Promise.all([workerA.result, workerB.result]);
    for (const result of results) {
      assert.equal(result.code, 0, result.stderr);
      assert.equal((JSON.parse(result.stdout) as { status: string }).status, "committed");
    }
    const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as Manifest;
    assert.deepEqual(Object.keys(manifest.artifacts).sort(), ["alpha", "beta"]);
  });
});

test("every crash boundary recovers the modeled complete old or new transaction", { timeout: 20_000 }, async () => {
  const cases = ALL_TRANSACTION_FAULT_POINTS.flatMap((point) =>
    point === "target-staged" || point === "target-backed-up" || point === "target-replaced"
      ? [`${point}@a.txt`, `${point}@b.txt`]
      : [point],
  );
  for (const faultSpec of cases) {
    const point = faultSpec.split("@")[0] as (typeof ALL_TRANSACTION_FAULT_POINTS)[number];
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "a.txt"), "old-a", "utf8");
      await writeFile(join(dir, "b.txt"), "old-b", "utf8");
      const worker = startWorker(["crash", dir, faultSpec]);
      const result = await worker.result;
      assert.equal(result.code, 86, `${faultSpec}: ${result.stderr}`);
      await recoverFileTransactions(dir);
      const outcome = modeledOutcome(point);
      assert.equal(
        await readFile(join(dir, "a.txt"), "utf8"),
        outcome === "old" ? "old-a" : "new-a",
        faultSpec,
      );
      assert.equal(
        await readFile(join(dir, "b.txt"), "utf8"),
        outcome === "old" ? "old-b" : "new-b",
        faultSpec,
      );
      assert.deepEqual(await readdir(join(dir, TRANSACTION_DIRECTORY)), ["fence"]);
    });
  }
});

test("a live owner cannot be stolen and lock wait is bounded", async () => {
  await withTempDir(async (dir) => {
    const ready = join(dir, "ready");
    const release = join(dir, "release");
    const worker = startWorker(["hold", dir, ready, release]);
    await waitForFiles([ready]);
    await assert.rejects(
      recoverFileTransactions(dir, { lockTimeoutMs: 50, pollIntervalMs: 5 }),
      TransactionLockTimeoutError,
    );
    const controller = new AbortController();
    const cancelled = recoverFileTransactions(dir, {
      signal: controller.signal,
      lockTimeoutMs: 5_000,
      pollIntervalMs: 5,
    });
    controller.abort();
    await assert.rejects(cancelled, { name: "AbortError" });
    await writeFile(release, "release", "utf8");
    const result = await worker.result;
    assert.equal(result.code, 0, result.stderr);
  });
});

test("caught failures report the selected old state or finish recovered new state", async () => {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "value.txt"), "old", "utf8");
    await assert.rejects(
      runFileTransaction(
        dir,
        (transaction) => transaction.commit(new Map([["value.txt", "new"]])),
        {
          fault(point) {
            if (point === "journal-prepared") throw new Error("before decision");
          },
        },
      ),
      TransactionCommitError,
    );
    assert.equal(await readFile(join(dir, "value.txt"), "utf8"), "old");

    await runFileTransaction(
      dir,
      (transaction) => transaction.commit(new Map([["value.txt", "new"]])),
      {
        fault(point) {
          if (point === "target-backed-up") throw new Error("after decision");
        },
      },
    );
    assert.equal(await readFile(join(dir, "value.txt"), "utf8"), "new");
  });
});

test("transactional deletion rolls back before decision and finishes after decision", async () => {
  await withTempDir(async (dir) => {
    const target = join(dir, "remove.txt");
    await writeFile(target, "old", "utf8");
    await assert.rejects(
      runFileTransaction(
        dir,
        (transaction) => transaction.commit(new Map([["remove.txt", null]])),
        {
          fault(point) {
            if (point === "journal-prepared") throw new Error("before deletion decision");
          },
        },
      ),
      TransactionCommitError,
    );
    assert.equal(await readFile(target, "utf8"), "old");

    await runFileTransaction(
      dir,
      (transaction) => transaction.commit(new Map([["remove.txt", null]])),
      {
        fault(point) {
          if (point === "target-backed-up") throw new Error("after deletion decision");
        },
      },
    );
    await assert.rejects(readFile(target, "utf8"));
  });
});

test("unknown transaction directories and invalid live-lock metadata fail closed", async () => {
  await withTempDir(async (dir) => {
    const transactions = join(dir, TRANSACTION_DIRECTORY);
    const unexpected = join(transactions, "user-data");
    await mkdir(unexpected, { recursive: true });
    await writeFile(join(unexpected, "marker"), "keep", "utf8");
    await assert.rejects(recoverFileTransactions(dir), TransactionRecoveryError);
    assert.equal(await readFile(join(unexpected, "marker"), "utf8"), "keep");
    await rm(unexpected, { recursive: true, force: true });

    const lock = join(transactions, "lock");
    await mkdir(lock, { recursive: true });
    await writeFile(join(lock, "owner.json"), "{}", "utf8");
    await assert.rejects(
      recoverFileTransactions(dir, { lockTimeoutMs: 20, pollIntervalMs: 5 }),
      /owner metadata is invalid/,
    );
    assert.equal(await readFile(join(lock, "owner.json"), "utf8"), "{}");
  });
});

test("transaction targets reject symlink escape and excessive target count", async () => {
  await withTempDir(async (dir) => {
    const outside = await mkdtemp(join(tmpdir(), "file-transaction-outside-"));
    try {
      await symlink(outside, join(dir, "linked"), "dir");
      await assert.rejects(
        runFileTransaction(dir, (transaction) =>
          transaction.commit(new Map([["linked/escape.txt", "no"]])),
        ),
        /not a real directory/,
      );
      await assert.rejects(readFile(join(outside, "escape.txt"), "utf8"));

      const tooMany = new Map<string, string>();
      for (let index = 0; index < 65; index++) tooMany.set(`target-${index}.txt`, "x");
      await assert.rejects(
        runFileTransaction(dir, (transaction) => transaction.commit(tooMany)),
        /65 targets; limit is 64/,
      );
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
