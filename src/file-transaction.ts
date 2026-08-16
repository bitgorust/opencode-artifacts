import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

export const TRANSACTION_DIRECTORY = ".transactions";

const LOCK_DIRECTORY = "lock";
const OWNER_FILE = "owner.json";
const FENCE_FILE = "fence";
const JOURNAL_FILE = "journal.json";
const JOURNAL_SCHEMA_VERSION = 1;
const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_POLL_INTERVAL_MS = 20;
const OWNER_INITIALIZATION_GRACE_MS = 1_000;
const MAX_TRANSACTION_TARGETS = 64;
const MAX_TRANSACTION_BYTES = 64 * 1024 * 1024;
const TRANSACTION_ID_RE = /^\d+-\d+-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export type TransactionFaultPoint =
  | "stage-created"
  | "target-staged"
  | "journal-prepared"
  | "commit-decided"
  | "target-backed-up"
  | "target-replaced"
  | "commit-verified"
  | "journal-committed";

export interface FileTransactionOptions {
  signal?: AbortSignal;
  lockTimeoutMs?: number;
  pollIntervalMs?: number;
  fault?: (point: TransactionFaultPoint, target?: string) => void;
}

export interface FileTransactionContext {
  commit(files: ReadonlyMap<string, string | Uint8Array>): Promise<void>;
}

interface LockOwner {
  schemaVersion: 1;
  pid: number;
  token: string;
  fence: number;
  createdAt: string;
}

type JournalState = "prepared" | "committing" | "committed";

interface JournalTarget {
  path: string;
  existed: boolean;
  oldHash: string | null;
  newHash: string;
  bytes: number;
}

interface TransactionJournal {
  schemaVersion: 1;
  id: string;
  fence: number;
  state: JournalState;
  targets: JournalTarget[];
}

interface HeldLock {
  token: string;
  fence: number;
  release(): Promise<void>;
}

export class TransactionLockTimeoutError extends Error {
  readonly root: string;

  constructor(root: string) {
    super(`timed out waiting for the artifact transaction lock in ${root}`);
    this.name = "TransactionLockTimeoutError";
    this.root = root;
  }
}

export class TransactionRecoveryError extends Error {
  readonly transactionId: string;

  constructor(transactionId: string, message: string) {
    super(`transaction ${transactionId} cannot be recovered safely: ${message}`);
    this.name = "TransactionRecoveryError";
    this.transactionId = transactionId;
  }
}

export class TransactionCommitError extends Error {
  readonly transactionId: string;
  readonly selectedState = "old" as const;
  readonly cause: unknown;

  constructor(transactionId: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`transaction ${transactionId} did not commit; the old state remains selected: ${detail}`);
    this.name = "TransactionCommitError";
    this.transactionId = transactionId;
    this.cause = cause;
  }
}

function hashBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function errnoCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return false;
    throw error;
  }
}

function parseInteger(value: string): number | undefined {
  if (!/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLockOwner(value: unknown): LockOwner | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value["schemaVersion"] !== 1 ||
    typeof value["pid"] !== "number" ||
    !Number.isSafeInteger(value["pid"]) ||
    typeof value["token"] !== "string" ||
    typeof value["fence"] !== "number" ||
    !Number.isSafeInteger(value["fence"]) ||
    typeof value["createdAt"] !== "string"
  ) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    pid: value["pid"],
    token: value["token"],
    fence: value["fence"],
    createdAt: value["createdAt"],
  };
}

function parseJournal(value: unknown): TransactionJournal | undefined {
  if (!isRecord(value)) return undefined;
  if (
    value["schemaVersion"] !== JOURNAL_SCHEMA_VERSION ||
    typeof value["id"] !== "string" ||
    !TRANSACTION_ID_RE.test(value["id"]) ||
    typeof value["fence"] !== "number" ||
    !Number.isSafeInteger(value["fence"]) ||
    (value["state"] !== "prepared" &&
      value["state"] !== "committing" &&
      value["state"] !== "committed") ||
    !Array.isArray(value["targets"])
  ) {
    return undefined;
  }
  const targets: JournalTarget[] = [];
  for (const target of value["targets"]) {
    if (
      !isRecord(target) ||
      typeof target["path"] !== "string" ||
      typeof target["existed"] !== "boolean" ||
      (target["oldHash"] !== null && typeof target["oldHash"] !== "string") ||
      typeof target["newHash"] !== "string" ||
      !SHA256_RE.test(target["newHash"]) ||
      typeof target["bytes"] !== "number" ||
      !Number.isSafeInteger(target["bytes"]) ||
      target["bytes"] < 0 ||
      (target["existed"] &&
        (typeof target["oldHash"] !== "string" || !SHA256_RE.test(target["oldHash"]))) ||
      (!target["existed"] && target["oldHash"] !== null)
    ) {
      return undefined;
    }
    targets.push({
      path: target["path"],
      existed: target["existed"],
      oldHash: target["oldHash"],
      newHash: target["newHash"],
      bytes: target["bytes"],
    });
  }
  if (targets.length === 0 || targets.length > MAX_TRANSACTION_TARGETS) return undefined;
  if (new Set(targets.map((target) => target.path)).size !== targets.length) return undefined;
  if (targets.reduce((sum, target) => sum + target.bytes, 0) > MAX_TRANSACTION_BYTES) {
    return undefined;
  }
  return {
    schemaVersion: 1,
    id: value["id"],
    fence: value["fence"],
    state: value["state"],
    targets,
  };
}

function safeSegments(relativePath: string): string[] {
  if (
    relativePath === "" ||
    relativePath.includes("\\") ||
    relativePath.startsWith("/") ||
    relativePath.endsWith("/")
  ) {
    throw new Error(`unsafe transaction target ${JSON.stringify(relativePath)}`);
  }
  const segments = relativePath.split("/");
  if (
    segments.some(
      (segment) =>
        segment === "" || segment === "." || segment === ".." || segment === TRANSACTION_DIRECTORY,
    )
  ) {
    throw new Error(`unsafe transaction target ${JSON.stringify(relativePath)}`);
  }
  return segments;
}

async function containedPath(root: string, relativePath: string): Promise<string> {
  const segments = safeSegments(relativePath);
  const rootPath = resolve(root);
  let current = rootPath;
  for (let index = 0; index < segments.length - 1; index++) {
    current = join(current, segments[index]);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) {
        throw new Error(`transaction target parent is not a real directory: ${relativePath}`);
      }
    } catch (error) {
      if (errnoCode(error) !== "ENOENT") throw error;
      break;
    }
  }
  const target = join(rootPath, ...segments);
  if (target !== rootPath && !target.startsWith(`${rootPath}${sep}`)) {
    throw new Error(`transaction target escapes its root: ${relativePath}`);
  }
  if (await exists(target)) {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new Error(`transaction target is not a regular file: ${relativePath}`);
    }
  }
  return target;
}

async function syncFile(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(path: string): Promise<void> {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeDurable(path: string, value: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(dirname(path));
}

async function replaceDurable(path: string, value: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeDurable(temporary, Buffer.from(value, "utf8"));
  await rename(temporary, path);
  await syncDirectory(dirname(path));
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return errnoCode(error) === "EPERM";
  }
}

function abortError(): Error {
  const error = new Error("artifact transaction was cancelled");
  error.name = "AbortError";
  return error;
}

async function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw abortError();
  await new Promise<void>((resolveWait, rejectWait) => {
    const onAbort = () => {
      clearTimeout(timer);
      rejectWait(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolveWait();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function stealDeadLock(lockPath: string): Promise<boolean> {
  let owner: LockOwner | undefined;
  try {
    owner = parseLockOwner(await readJson(join(lockPath, OWNER_FILE)));
    if (!owner) throw new Error("artifact transaction lock owner metadata is invalid");
  } catch (error) {
    if (errnoCode(error) !== "ENOENT") throw error;
  }
  if (owner && processIsAlive(owner.pid)) return false;
  if (!owner) {
    const info = await stat(lockPath);
    if (Date.now() - info.mtimeMs < OWNER_INITIALIZATION_GRACE_MS) return false;
  }
  const stalePath = `${lockPath}.stale-${randomUUID()}`;
  try {
    await rename(lockPath, stalePath);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return true;
    throw error;
  }
  await rm(stalePath, { recursive: true, force: true });
  return true;
}

async function acquireLock(root: string, options: FileTransactionOptions): Promise<HeldLock> {
  await mkdir(root, { recursive: true });
  const transactionsPath = join(root, TRANSACTION_DIRECTORY);
  await mkdir(transactionsPath, { recursive: true });
  const lockPath = join(transactionsPath, LOCK_DIRECTORY);
  const deadline = Date.now() + (options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS);
  const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  for (;;) {
    if (options.signal?.aborted) throw abortError();
    try {
      await mkdir(lockPath);
      const priorFence = await readFile(join(transactionsPath, FENCE_FILE), "utf8").then(
        (value) => parseInteger(value) ?? 0,
        (error: unknown) => {
          if (errnoCode(error) === "ENOENT") return 0;
          throw error;
        },
      );
      const fence = priorFence + 1;
      await replaceDurable(join(transactionsPath, FENCE_FILE), `${fence}\n`);
      const token = randomUUID();
      const owner: LockOwner = {
        schemaVersion: 1,
        pid: process.pid,
        token,
        fence,
        createdAt: new Date().toISOString(),
      };
      await replaceDurable(join(lockPath, OWNER_FILE), `${JSON.stringify(owner)}\n`);
      await syncDirectory(lockPath);
      let released = false;
      return {
        token,
        fence,
        async release() {
          if (released) return;
          released = true;
          let current: LockOwner | undefined;
          try {
            current = parseLockOwner(await readJson(join(lockPath, OWNER_FILE)));
          } catch (error) {
            if (errnoCode(error) !== "ENOENT") throw error;
          }
          if (current?.token === token) {
            await rm(lockPath, { recursive: true, force: true });
            await syncDirectory(transactionsPath);
          }
        },
      };
    } catch (error) {
      if (errnoCode(error) !== "EEXIST") throw error;
    }

    if (await stealDeadLock(lockPath)) continue;
    if (Date.now() >= deadline) throw new TransactionLockTimeoutError(root);
    await wait(pollInterval, options.signal);
  }
}

async function assertLock(root: string, lock: HeldLock): Promise<void> {
  const transactionsPath = join(root, TRANSACTION_DIRECTORY);
  const owner = parseLockOwner(await readJson(join(transactionsPath, LOCK_DIRECTORY, OWNER_FILE)));
  const fence = parseInteger(await readFile(join(transactionsPath, FENCE_FILE), "utf8"));
  if (!owner || owner.token !== lock.token || owner.fence !== lock.fence || fence !== lock.fence) {
    throw new Error("artifact transaction lock ownership changed before commit");
  }
}

async function writeJournal(transactionPath: string, journal: TransactionJournal): Promise<void> {
  await replaceDurable(join(transactionPath, JOURNAL_FILE), `${JSON.stringify(journal, null, 2)}\n`);
  await syncDirectory(transactionPath);
}

async function targetHash(path: string): Promise<string | undefined> {
  try {
    return hashBytes(await readFile(path));
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

async function restorePrepared(root: string, transactionPath: string, journal: TransactionJournal): Promise<void> {
  for (const target of journal.targets) {
    const destination = await containedPath(root, target.path);
    const backup = join(transactionPath, "old", ...safeSegments(target.path));
    const current = await targetHash(destination);
    if (current === target.newHash) {
      if (!target.existed) {
        await rm(destination, { force: true });
      } else if (await exists(backup)) {
        await mkdir(dirname(destination), { recursive: true });
        await rename(backup, destination);
        await syncDirectory(dirname(backup));
        await syncDirectory(dirname(destination));
      } else {
        throw new TransactionRecoveryError(journal.id, `old bytes missing for ${target.path}`);
      }
    } else if (target.existed && current !== target.oldHash) {
      if (await exists(backup)) {
        await mkdir(dirname(destination), { recursive: true });
        await rename(backup, destination);
        await syncDirectory(dirname(backup));
        await syncDirectory(dirname(destination));
      } else {
        throw new TransactionRecoveryError(journal.id, `unexpected old bytes for ${target.path}`);
      }
    }
    const restored = await targetHash(destination);
    if ((target.existed && restored !== target.oldHash) || (!target.existed && restored !== undefined)) {
      throw new TransactionRecoveryError(journal.id, `rollback verification failed for ${target.path}`);
    }
  }
  await rm(transactionPath, { recursive: true, force: true });
  await syncDirectory(join(root, TRANSACTION_DIRECTORY));
}

async function rollForward(root: string, transactionPath: string, journal: TransactionJournal): Promise<void> {
  for (const target of journal.targets) {
    const destination = await containedPath(root, target.path);
    const staged = join(transactionPath, "new", ...safeSegments(target.path));
    const backup = join(transactionPath, "old", ...safeSegments(target.path));
    const current = await targetHash(destination);
    if (current === target.newHash) continue;
    if (!(await exists(staged)) || (await targetHash(staged)) !== target.newHash) {
      throw new TransactionRecoveryError(journal.id, `staged bytes missing for ${target.path}`);
    }
    if (current !== undefined) {
      if (!target.existed || current !== target.oldHash) {
        throw new TransactionRecoveryError(journal.id, `unexpected selected bytes for ${target.path}`);
      }
      await mkdir(dirname(backup), { recursive: true });
      if (!(await exists(backup))) await rename(destination, backup);
      else await rm(destination, { force: true });
      await syncDirectory(dirname(backup));
      await syncDirectory(dirname(destination));
    }
    await mkdir(dirname(destination), { recursive: true });
    await rename(staged, destination);
    await syncFile(destination);
    await syncDirectory(dirname(staged));
    await syncDirectory(dirname(destination));
  }
  for (const target of journal.targets) {
    const destination = await containedPath(root, target.path);
    if ((await targetHash(destination)) !== target.newHash) {
      throw new TransactionRecoveryError(journal.id, `commit verification failed for ${target.path}`);
    }
  }
  const committed: TransactionJournal = { ...journal, state: "committed" };
  await writeJournal(transactionPath, committed);
  await rm(transactionPath, { recursive: true, force: true });
  await syncDirectory(join(root, TRANSACTION_DIRECTORY));
}

async function recoverHeld(root: string): Promise<void> {
  const transactionsPath = join(root, TRANSACTION_DIRECTORY);
  const entries = await readdir(transactionsPath, { withFileTypes: true });
  const candidates = entries
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name !== LOCK_DIRECTORY && !entry.name.startsWith(`${LOCK_DIRECTORY}.stale-`),
    )
    .map((entry) => entry.name)
    .sort();
  for (const name of candidates) {
    if (!TRANSACTION_ID_RE.test(name)) {
      throw new TransactionRecoveryError(name, "unexpected directory in the transaction store");
    }
    const transactionPath = join(transactionsPath, name);
    let journal: TransactionJournal | undefined;
    try {
      journal = parseJournal(await readJson(join(transactionPath, JOURNAL_FILE)));
    } catch (error) {
      if (errnoCode(error) === "ENOENT") {
        await rm(transactionPath, { recursive: true, force: true });
        continue;
      }
      throw new TransactionRecoveryError(name, "journal is unreadable");
    }
    if (!journal || journal.id !== name) {
      throw new TransactionRecoveryError(name, "journal is malformed or mismatched");
    }
    for (const target of journal.targets) safeSegments(target.path);
    if (journal.state === "prepared") await restorePrepared(root, transactionPath, journal);
    else await rollForward(root, transactionPath, journal);
  }
}

async function commitHeld(
  root: string,
  lock: HeldLock,
  files: ReadonlyMap<string, string | Uint8Array>,
  options: FileTransactionOptions,
): Promise<void> {
  if (files.size === 0) throw new Error("artifact transaction has no target files");
  if (files.size > MAX_TRANSACTION_TARGETS) {
    throw new Error(`artifact transaction has ${files.size} targets; limit is ${MAX_TRANSACTION_TARGETS}`);
  }
  const normalized = [...files.entries()]
    .map(([path, value]) => [path, typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  const totalBytes = normalized.reduce((sum, [, value]) => sum + value.byteLength, 0);
  if (totalBytes > MAX_TRANSACTION_BYTES) {
    throw new Error(`artifact transaction has ${totalBytes} bytes; limit is ${MAX_TRANSACTION_BYTES}`);
  }
  const unique = new Set(normalized.map(([path]) => path));
  if (unique.size !== normalized.length) throw new Error("artifact transaction contains duplicate targets");
  for (const [path] of normalized) await containedPath(root, path);
  await assertLock(root, lock);

  const id = `${Date.now()}-${process.pid}-${randomUUID()}`;
  const transactionPath = join(root, TRANSACTION_DIRECTORY, id);
  await mkdir(join(transactionPath, "new"), { recursive: true });
  await mkdir(join(transactionPath, "old"), { recursive: true });
  options.fault?.("stage-created");

  const targets: JournalTarget[] = [];
  for (const [path, value] of normalized) {
    const destination = await containedPath(root, path);
    const current = await readFile(destination).then(
      (bytes) => bytes,
      (error: unknown) => {
        if (errnoCode(error) === "ENOENT") return undefined;
        throw error;
      },
    );
    await writeDurable(join(transactionPath, "new", ...safeSegments(path)), value);
    targets.push({
      path,
      existed: current !== undefined,
      oldHash: current === undefined ? null : hashBytes(current),
      newHash: hashBytes(value),
      bytes: value.byteLength,
    });
    options.fault?.("target-staged", path);
  }

  let journal: TransactionJournal = {
    schemaVersion: JOURNAL_SCHEMA_VERSION,
    id,
    fence: lock.fence,
    state: "prepared",
    targets,
  };
  try {
    await writeJournal(transactionPath, journal);
    options.fault?.("journal-prepared");
    await assertLock(root, lock);
    journal = { ...journal, state: "committing" };
    await writeJournal(transactionPath, journal);
    options.fault?.("commit-decided");

    for (const target of targets) {
      await assertLock(root, lock);
      const destination = await containedPath(root, target.path);
      const backup = join(transactionPath, "old", ...safeSegments(target.path));
      const staged = join(transactionPath, "new", ...safeSegments(target.path));
      if (target.existed) {
        await mkdir(dirname(backup), { recursive: true });
        await rename(destination, backup);
        await syncDirectory(dirname(backup));
        await syncDirectory(dirname(destination));
        options.fault?.("target-backed-up", target.path);
      }
      await mkdir(dirname(destination), { recursive: true });
      await rename(staged, destination);
      await syncFile(destination);
      await syncDirectory(dirname(staged));
      await syncDirectory(dirname(destination));
      options.fault?.("target-replaced", target.path);
    }

    for (const target of targets) {
      const destination = await containedPath(root, target.path);
      if ((await targetHash(destination)) !== target.newHash) {
        throw new TransactionRecoveryError(id, `verification failed for ${target.path}`);
      }
    }
    options.fault?.("commit-verified");
    journal = { ...journal, state: "committed" };
    await writeJournal(transactionPath, journal);
    options.fault?.("journal-committed");
    await rm(transactionPath, { recursive: true, force: true });
    await syncDirectory(join(root, TRANSACTION_DIRECTORY));
  } catch (error) {
    await recoverHeld(root);
    const selectedNew =
      targets.length > 0 &&
      (await Promise.all(
        targets.map(async (target) => {
          const destination = await containedPath(root, target.path);
          return (await targetHash(destination)) === target.newHash;
        }),
      )).every(Boolean);
    if (selectedNew) return;
    throw new TransactionCommitError(id, error);
  }
}

export async function runFileTransaction<T>(
  root: string,
  operation: (context: FileTransactionContext) => Promise<T>,
  options: FileTransactionOptions = {},
): Promise<T> {
  const resolvedRoot = resolve(root);
  const lock = await acquireLock(resolvedRoot, options);
  try {
    await recoverHeld(resolvedRoot);
    let committed = false;
    const result = await operation({
      async commit(files) {
        if (committed) throw new Error("artifact transaction already committed");
        committed = true;
        await commitHeld(resolvedRoot, lock, files, options);
      },
    });
    return result;
  } finally {
    await lock.release();
  }
}

export async function recoverFileTransactions(
  root: string,
  options: FileTransactionOptions = {},
): Promise<void> {
  await runFileTransaction(root, async () => {}, options);
}
