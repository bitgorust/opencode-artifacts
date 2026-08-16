import { access, readFile, writeFile } from "node:fs/promises";
import { FilePublisher, StaleArtifactError } from "../../src/publisher.ts";
import {
  runFileTransaction,
  type TransactionFaultPoint,
} from "../../src/file-transaction.ts";

async function waitFor(path: string): Promise<void> {
  for (;;) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 5));
    }
  }
}

async function publishWorker(args: string[]): Promise<void> {
  const [dir, slug, html, expectedHash, readyPath, goPath] = args;
  if (!dir || !slug || !html || !readyPath || !goPath) throw new Error("missing publish worker argument");
  await writeFile(readyPath, "ready", "utf8");
  await waitFor(goPath);
  try {
    const result = await new FilePublisher(dir).publish({
      slug,
      html,
      expectedHash: expectedHash === "-" ? undefined : expectedHash,
    });
    process.stdout.write(`${JSON.stringify({ status: "committed", hash: result.hash })}\n`);
  } catch (error) {
    if (error instanceof StaleArtifactError) {
      process.stdout.write(`${JSON.stringify({ status: "stale", hash: error.currentHash })}\n`);
      return;
    }
    throw error;
  }
}

async function crashWorker(args: string[]): Promise<void> {
  const [dir, faultSpec] = args;
  if (!dir || !faultSpec) throw new Error("missing crash worker argument");
  const [faultPoint, faultTarget] = faultSpec.split("@");
  await runFileTransaction(
    dir,
    async (transaction) => {
      await transaction.commit(
        new Map([
          ["a.txt", "new-a"],
          ["b.txt", "new-b"],
        ]),
      );
    },
    {
      fault(point, target) {
        if (
          point === (faultPoint as TransactionFaultPoint) &&
          (faultTarget === undefined || target === faultTarget)
        ) {
          process.exit(86);
        }
      },
    },
  );
}

async function holdWorker(args: string[]): Promise<void> {
  const [dir, readyPath, releasePath] = args;
  if (!dir || !readyPath || !releasePath) throw new Error("missing hold worker argument");
  await runFileTransaction(dir, async () => {
    await writeFile(readyPath, String(process.pid), "utf8");
    await waitFor(releasePath);
  });
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "publish") return publishWorker(args);
  if (mode === "crash") return crashWorker(args);
  if (mode === "hold") return holdWorker(args);
  if (mode === "read") {
    const [path] = args;
    if (!path) throw new Error("missing read path");
    process.stdout.write(await readFile(path, "utf8"));
    return;
  }
  throw new Error(`unknown worker mode ${JSON.stringify(mode)}`);
}

await main();
