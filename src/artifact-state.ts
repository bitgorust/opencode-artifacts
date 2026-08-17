import { randomUUID, createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ARTIFACT_ID_RE } from "./artifact-schema.ts";
import { recoverFileTransactions, runFileTransaction } from "./file-transaction.ts";

export const ARTIFACT_STATE_SCHEMA_VERSION = 2;
export const STATE_OPERATION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const STATE_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ArtifactStateKind = "decisions" | "comments" | "collection";

export interface DecisionPayload {
  answers: Record<string, string>;
}

export interface CommentThreadV2 {
  id: string;
  quote: string;
  text: string;
  createdAt: string;
  resolved: boolean;
}

export interface CommentPayload {
  threads: CommentThreadV2[];
}

export interface CollectionPayload {
  docs: Record<string, unknown>;
}

export type ArtifactStatePayload = DecisionPayload | CommentPayload | CollectionPayload;

export interface StateOperationRecord {
  id: string;
  inputHash: string;
  revision: number;
  contentHash: string;
  committedAt: string;
}

export interface ArtifactStateEnvelope<T extends ArtifactStatePayload = ArtifactStatePayload> {
  schemaVersion: 2;
  artifactId: string;
  kind: ArtifactStateKind;
  key: string;
  revision: number;
  contentHash: string;
  payload: T;
  updatedAt: string;
  operations: StateOperationRecord[];
}

export interface ArtifactStateLimits {
  decisionBytes: number;
  answerCount: number;
  answerKeyBytes: number;
  answerValueBytes: number;
  commentBytes: number;
  threadCount: number;
  threadIdBytes: number;
  quoteBytes: number;
  commentTextBytes: number;
  documentBytes: number;
  collectionDocuments: number;
  collectionBytes: number;
  mutationRatePerMinute: number;
  mutationWarningRatio: number;
  operationRecords: number;
  conflictPreviewBytes: number;
  maxJsonDepth: number;
}

export const DEFAULT_ARTIFACT_STATE_LIMITS: Readonly<ArtifactStateLimits> = Object.freeze({
  decisionBytes: 64 * 1024,
  answerCount: 256,
  answerKeyBytes: 256,
  answerValueBytes: 4 * 1024,
  commentBytes: 256 * 1024,
  threadCount: 200,
  threadIdBytes: 128,
  quoteBytes: 8 * 1024,
  commentTextBytes: 16 * 1024,
  documentBytes: 256 * 1024,
  collectionDocuments: 1_000,
  collectionBytes: 16 * 1024 * 1024,
  mutationRatePerMinute: 120,
  mutationWarningRatio: 0.8,
  operationRecords: 1_000,
  conflictPreviewBytes: 16 * 1024,
  maxJsonDepth: 32,
});

const ABSOLUTE_LIMITS: Readonly<Record<keyof ArtifactStateLimits, number>> = Object.freeze({
  decisionBytes: DEFAULT_ARTIFACT_STATE_LIMITS.decisionBytes * 4,
  answerCount: DEFAULT_ARTIFACT_STATE_LIMITS.answerCount * 4,
  answerKeyBytes: DEFAULT_ARTIFACT_STATE_LIMITS.answerKeyBytes * 4,
  answerValueBytes: DEFAULT_ARTIFACT_STATE_LIMITS.answerValueBytes * 4,
  commentBytes: DEFAULT_ARTIFACT_STATE_LIMITS.commentBytes * 4,
  threadCount: DEFAULT_ARTIFACT_STATE_LIMITS.threadCount * 4,
  threadIdBytes: DEFAULT_ARTIFACT_STATE_LIMITS.threadIdBytes * 4,
  quoteBytes: DEFAULT_ARTIFACT_STATE_LIMITS.quoteBytes * 4,
  commentTextBytes: DEFAULT_ARTIFACT_STATE_LIMITS.commentTextBytes * 4,
  documentBytes: DEFAULT_ARTIFACT_STATE_LIMITS.documentBytes * 4,
  collectionDocuments: DEFAULT_ARTIFACT_STATE_LIMITS.collectionDocuments * 4,
  collectionBytes: DEFAULT_ARTIFACT_STATE_LIMITS.collectionBytes * 4,
  mutationRatePerMinute: 1_000,
  mutationWarningRatio: 0.95,
  operationRecords: DEFAULT_ARTIFACT_STATE_LIMITS.operationRecords * 4,
  conflictPreviewBytes: DEFAULT_ARTIFACT_STATE_LIMITS.conflictPreviewBytes * 4,
  maxJsonDepth: DEFAULT_ARTIFACT_STATE_LIMITS.maxJsonDepth * 4,
});

export type ArtifactStateErrorCode =
  | "invalid"
  | "corrupt"
  | "future-schema"
  | "stale"
  | "replay-conflict"
  | "quota"
  | "rate-limit";

export class ArtifactStateError extends Error {
  readonly code: ArtifactStateErrorCode;
  readonly selectedRevision: number;
  readonly nextAction: string;

  constructor(code: ArtifactStateErrorCode, message: string, selectedRevision: number, nextAction: string) {
    super(message);
    this.name = "ArtifactStateError";
    this.code = code;
    this.selectedRevision = selectedRevision;
    this.nextAction = nextAction;
  }
}

export class ArtifactStateConflictError extends ArtifactStateError {
  readonly currentHash: string;
  readonly current: string;

  constructor(message: string, current: ArtifactStateEnvelope, previewBytes: number) {
    super("stale", message, current.revision, "merge onto the bounded current value and retry with its revision/hash");
    this.name = "ArtifactStateConflictError";
    this.currentHash = current.contentHash;
    const encoded = stableJson(current.payload);
    this.current = Buffer.byteLength(encoded, "utf8") <= previewBytes
      ? encoded
      : `${Buffer.from(encoded, "utf8").subarray(0, previewBytes).toString("utf8")}…`;
  }
}

export interface StateMutationResult<T extends ArtifactStatePayload> {
  status: "committed" | "replayed";
  revision: number;
  contentHash: string;
  envelope: ArtifactStateEnvelope<T>;
  warnings: string[];
}

export interface ReplaceStateInput<T extends ArtifactStatePayload> {
  root: string;
  artifactId: string;
  kind: ArtifactStateKind;
  key?: string;
  expectedRevision: number;
  expectedHash?: string;
  operationId: string;
  payload: T;
  now?: string;
  limits?: Partial<ArtifactStateLimits>;
}

export interface MutateCollectionDocumentInput {
  root: string;
  artifactId: string;
  collection: string;
  id: string;
  operation: "set" | "delete";
  document?: unknown;
  expectedRevision: number;
  expectedDocumentHash: string | null;
  operationId: string;
  now?: string;
  limits?: Partial<ArtifactStateLimits>;
}

export interface LegacyStateMigrationItem {
  sourcePath: string;
  backupPath: string;
  targetPath: string;
  sourceHash: string;
  targetHash: string;
  envelope: ArtifactStateEnvelope;
}

export interface LegacyStateMigrationPlan {
  schemaVersion: 1;
  migrationId: string;
  artifactId: string;
  slug: string;
  createdAt: string;
  items: LegacyStateMigrationItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function errnoCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function normalizeJson(value: unknown, depth = 0, maxDepth = DEFAULT_ARTIFACT_STATE_LIMITS.maxJsonDepth): unknown {
  if (depth > maxDepth) throw new ArtifactStateError("quota", `JSON depth exceeds ${maxDepth}`, 0, "reduce nesting");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((entry) => normalizeJson(entry, depth + 1, maxDepth));
  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      if (utf8Bytes(key) > 1_024) {
        throw new ArtifactStateError("quota", "JSON field name exceeds 1024 bytes", 0, "shorten field names");
      }
      normalized[key] = normalizeJson(value[key], depth + 1, maxDepth);
    }
    return normalized;
  }
  throw new ArtifactStateError("invalid", "payload must be JSON-compatible", 0, "send a JSON value without undefined or non-finite numbers");
}

function stableJson(value: unknown, maxDepth = DEFAULT_ARTIFACT_STATE_LIMITS.maxJsonDepth): string {
  return JSON.stringify(normalizeJson(value, 0, maxDepth));
}

function mergeLimits(overrides: Partial<ArtifactStateLimits> = {}): ArtifactStateLimits {
  const merged: ArtifactStateLimits = { ...DEFAULT_ARTIFACT_STATE_LIMITS, ...overrides };
  for (const key of Object.keys(DEFAULT_ARTIFACT_STATE_LIMITS) as Array<keyof ArtifactStateLimits>) {
    const value = merged[key];
    if (key === "mutationWarningRatio") {
      if (typeof value !== "number" || value <= 0 || value > ABSOLUTE_LIMITS[key]) {
        throw new ArtifactStateError("invalid", `${key} must be within (0, ${ABSOLUTE_LIMITS[key]}]`, 0, "use a bounded limit override");
      }
    } else if (!Number.isSafeInteger(value) || value < 1 || value > ABSOLUTE_LIMITS[key]) {
      throw new ArtifactStateError("invalid", `${key} must be an integer within [1, ${ABSOLUTE_LIMITS[key]}]`, 0, "use a bounded limit override");
    }
  }
  return merged;
}

function statePath(artifactId: string, kind: ArtifactStateKind, key: string): string {
  if (!ARTIFACT_ID_RE.test(artifactId)) {
    throw new ArtifactStateError("invalid", "artifactId must be a UUID", 0, "resolve the artifact to its opaque ID");
  }
  if (!STATE_KEY_RE.test(key)) {
    throw new ArtifactStateError("invalid", "store key must be a safe lowercase identifier", 0, "use lowercase letters, numbers, and internal hyphens");
  }
  return kind === "collection"
    ? `.db/v2/${artifactId}/${key}.json`
    : `.state/v2/${artifactId}/${kind}.json`;
}

function defaultPayload(kind: ArtifactStateKind): ArtifactStatePayload {
  if (kind === "decisions") return { answers: {} };
  if (kind === "comments") return { threads: [] };
  return { docs: {} };
}

function validateDecisionPayload(value: unknown, limits: ArtifactStateLimits, revision: number): asserts value is DecisionPayload {
  if (!isRecord(value) || !exactKeys(value, new Set(["answers"])) || !isRecord(value["answers"])) {
    throw new ArtifactStateError("invalid", "decision payload must be exactly {answers}", revision, "send a string-valued answers object");
  }
  const entries = Object.entries(value["answers"]);
  if (entries.length > limits.answerCount) {
    throw new ArtifactStateError("quota", `answer count exceeds ${limits.answerCount}`, revision, "remove answers before retrying");
  }
  for (const [key, answer] of entries) {
    if (typeof answer !== "string" || utf8Bytes(key) > limits.answerKeyBytes || utf8Bytes(answer) > limits.answerValueBytes) {
      throw new ArtifactStateError("quota", "answer key or value exceeds its limit", revision, "shorten the answer key/value");
    }
  }
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

const THREAD_KEYS = new Set(["id", "quote", "text", "createdAt", "resolved"]);

function validateCommentPayload(value: unknown, limits: ArtifactStateLimits, revision: number): asserts value is CommentPayload {
  if (!isRecord(value) || !exactKeys(value, new Set(["threads"])) || !Array.isArray(value["threads"])) {
    throw new ArtifactStateError("invalid", "comment payload must be exactly {threads}", revision, "send a thread array");
  }
  if (value["threads"].length > limits.threadCount) {
    throw new ArtifactStateError("quota", `thread count exceeds ${limits.threadCount}`, revision, "resolve/archive threads before retrying");
  }
  const ids = new Set<string>();
  for (const thread of value["threads"]) {
    if (
      !isRecord(thread) ||
      !exactKeys(thread, THREAD_KEYS) ||
      typeof thread["id"] !== "string" ||
      typeof thread["quote"] !== "string" ||
      typeof thread["text"] !== "string" ||
      !validTimestamp(thread["createdAt"]) ||
      typeof thread["resolved"] !== "boolean" ||
      ids.has(thread["id"]) ||
      utf8Bytes(thread["id"]) > limits.threadIdBytes ||
      utf8Bytes(thread["quote"]) > limits.quoteBytes ||
      utf8Bytes(thread["text"]) > limits.commentTextBytes
    ) {
      throw new ArtifactStateError("invalid", "comment thread shape, identity, timestamp, or field size is invalid", revision, "send unique bounded exact thread records");
    }
    ids.add(thread["id"]);
  }
}

function validateCollectionPayload(value: unknown, limits: ArtifactStateLimits, revision: number): asserts value is CollectionPayload {
  if (!isRecord(value) || !exactKeys(value, new Set(["docs"])) || !isRecord(value["docs"])) {
    throw new ArtifactStateError("invalid", "collection payload must be exactly {docs}", revision, "send a document object");
  }
  const entries = Object.entries(value["docs"]);
  if (entries.length > limits.collectionDocuments) {
    throw new ArtifactStateError("quota", `document count exceeds ${limits.collectionDocuments}`, revision, "delete documents before retrying");
  }
  for (const [id, document] of entries) {
    if (!STATE_KEY_RE.test(id)) {
      throw new ArtifactStateError("invalid", `document ID ${JSON.stringify(id)} is unsafe`, revision, "use a safe lowercase document ID");
    }
    const bytes = utf8Bytes(stableJson(document, limits.maxJsonDepth));
    if (bytes > limits.documentBytes) {
      throw new ArtifactStateError("quota", `document ${id} exceeds ${limits.documentBytes} bytes`, revision, "reduce the document before retrying");
    }
  }
}

function validatePayload(kind: ArtifactStateKind, value: unknown, limits: ArtifactStateLimits, revision: number): ArtifactStatePayload {
  if (kind === "decisions") validateDecisionPayload(value, limits, revision);
  else if (kind === "comments") validateCommentPayload(value, limits, revision);
  else validateCollectionPayload(value, limits, revision);
  const bytes = utf8Bytes(stableJson(value, limits.maxJsonDepth));
  const cap = kind === "decisions" ? limits.decisionBytes : kind === "comments" ? limits.commentBytes : limits.collectionBytes;
  if (bytes > cap) {
    throw new ArtifactStateError("quota", `${kind} payload exceeds ${cap} encoded bytes`, revision, "reduce state before retrying");
  }
  return value;
}

function encodedStateCap(kind: ArtifactStateKind, limits: ArtifactStateLimits): number {
  return kind === "decisions" ? limits.decisionBytes : kind === "comments" ? limits.commentBytes : limits.collectionBytes;
}

const OPERATION_KEYS = new Set(["id", "inputHash", "revision", "contentHash", "committedAt"]);
const ENVELOPE_KEYS = new Set(["schemaVersion", "artifactId", "kind", "key", "revision", "contentHash", "payload", "updatedAt", "operations"]);
const HASH_RE = /^[0-9a-f]{64}$/;

export function validateArtifactStateEnvelope(
  value: unknown,
  expected: { artifactId: string; kind: ArtifactStateKind; key: string },
  limitsInput: Partial<ArtifactStateLimits> = {},
): ArtifactStateEnvelope {
  const limits = mergeLimits(limitsInput);
  if (isRecord(value) && typeof value["schemaVersion"] === "number" && value["schemaVersion"] !== ARTIFACT_STATE_SCHEMA_VERSION) {
    throw new ArtifactStateError("future-schema", `unsupported state schemaVersion ${String(value["schemaVersion"])}`, 0, "upgrade the runtime or restore a compatible backup");
  }
  if (
    !isRecord(value) ||
    !exactKeys(value, ENVELOPE_KEYS) ||
    value["schemaVersion"] !== ARTIFACT_STATE_SCHEMA_VERSION ||
    value["artifactId"] !== expected.artifactId ||
    value["kind"] !== expected.kind ||
    value["key"] !== expected.key ||
    typeof value["revision"] !== "number" ||
    !Number.isSafeInteger(value["revision"]) ||
    value["revision"] < 1 ||
    typeof value["contentHash"] !== "string" ||
    !HASH_RE.test(value["contentHash"]) ||
    !validTimestamp(value["updatedAt"]) ||
    !Array.isArray(value["operations"]) ||
    value["operations"].length > limits.operationRecords
  ) {
    throw new ArtifactStateError("corrupt", "state envelope is malformed or belongs to another artifact/store", 0, "restore a verified backup or run state repair preflight");
  }
  const seen = new Set<string>();
  let priorOperationRevision = 0;
  let priorOperationTime = -Infinity;
  for (const operation of value["operations"]) {
    if (
      !isRecord(operation) ||
      !exactKeys(operation, OPERATION_KEYS) ||
      typeof operation["id"] !== "string" ||
      !STATE_OPERATION_ID_RE.test(operation["id"]) ||
      seen.has(operation["id"]) ||
      typeof operation["inputHash"] !== "string" ||
      !HASH_RE.test(operation["inputHash"]) ||
      typeof operation["revision"] !== "number" ||
      !Number.isSafeInteger(operation["revision"]) ||
      operation["revision"] < 1 ||
      operation["revision"] > value["revision"] ||
      operation["revision"] <= priorOperationRevision ||
      typeof operation["contentHash"] !== "string" ||
      !HASH_RE.test(operation["contentHash"]) ||
      !validTimestamp(operation["committedAt"]) ||
      Date.parse(operation["committedAt"]) < priorOperationTime ||
      Date.parse(operation["committedAt"]) > Date.parse(value["updatedAt"])
    ) {
      throw new ArtifactStateError("corrupt", "state operation ledger is malformed", value["revision"], "restore a verified backup or run state repair preflight");
    }
    seen.add(operation["id"]);
    priorOperationRevision = operation["revision"];
    priorOperationTime = Date.parse(operation["committedAt"]);
  }
  const payload = validatePayload(expected.kind, value["payload"], limits, value["revision"]);
  const contentHash = sha256(stableJson(payload, limits.maxJsonDepth));
  if (contentHash !== value["contentHash"]) {
    throw new ArtifactStateError("corrupt", "state payload hash does not match its envelope", value["revision"], "restore a verified backup or run state repair preflight");
  }
  return value as unknown as ArtifactStateEnvelope;
}

async function readEnvelopeLocked(
  root: string,
  artifactId: string,
  kind: ArtifactStateKind,
  key: string,
  limits: ArtifactStateLimits,
): Promise<ArtifactStateEnvelope | undefined> {
  const relativePath = statePath(artifactId, kind, key);
  const path = join(root, ...relativePath.split("/"));
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new ArtifactStateError("corrupt", "state path is not a regular file", 0, "remove the unsafe path after preserving evidence");
    }
    const raw = await readFile(path, "utf8");
    if (utf8Bytes(raw) > encodedStateCap(kind, limits)) {
      throw new ArtifactStateError("quota", "encoded state envelope exceeds the read limit", 0, "repair or archive the oversized store");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new ArtifactStateError("corrupt", "state envelope is not valid JSON", 0, "restore a verified backup or run state repair preflight");
    }
    return validateArtifactStateEnvelope(parsed, { artifactId, kind, key }, limits);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

function virtualEnvelope(
  artifactId: string,
  kind: ArtifactStateKind,
  key: string,
  limits: ArtifactStateLimits,
): ArtifactStateEnvelope {
  const payload = validatePayload(kind, defaultPayload(kind), limits, 0);
  return {
    schemaVersion: ARTIFACT_STATE_SCHEMA_VERSION,
    artifactId,
    kind,
    key,
    revision: 0,
    contentHash: sha256(stableJson(payload, limits.maxJsonDepth)),
    payload,
    updatedAt: "1970-01-01T00:00:00.000Z",
    operations: [],
  };
}

export async function readArtifactState<T extends ArtifactStatePayload = ArtifactStatePayload>(
  root: string,
  artifactId: string,
  kind: ArtifactStateKind,
  key = "default",
  overrides: Partial<ArtifactStateLimits> = {},
): Promise<ArtifactStateEnvelope<T>> {
  const limits = mergeLimits(overrides);
  statePath(artifactId, kind, key);
  await recoverFileTransactions(root);
  return (await readEnvelopeLocked(root, artifactId, kind, key, limits) ?? virtualEnvelope(artifactId, kind, key, limits)) as ArtifactStateEnvelope<T>;
}

function assertMutationInput(expectedRevision: number, expectedHash: string | undefined, operationId: string): void {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new ArtifactStateError("invalid", "expectedRevision must be a non-negative integer", 0, "read the current revision and retry");
  }
  if (expectedHash !== undefined && !HASH_RE.test(expectedHash)) {
    throw new ArtifactStateError("invalid", "expectedHash must be a SHA-256 digest", 0, "read the current hash and retry");
  }
  if (!STATE_OPERATION_ID_RE.test(operationId)) {
    throw new ArtifactStateError("invalid", "operationId must be a UUID", 0, "generate one UUID per logical mutation and retain it for retries");
  }
}

function mutationWarnings(operations: StateOperationRecord[], nowMs: number, limits: ArtifactStateLimits): string[] {
  const recent = operations.filter((operation) => nowMs - Date.parse(operation.committedAt) < 60_000);
  if (recent.length >= limits.mutationRatePerMinute) {
    throw new ArtifactStateError("rate-limit", `mutation rate exceeds ${limits.mutationRatePerMinute} per minute`, operations.at(-1)?.revision ?? 0, "wait for the rolling minute window before retrying");
  }
  return recent.length + 1 >= Math.ceil(limits.mutationRatePerMinute * limits.mutationWarningRatio)
    ? [`mutation rate is at ${recent.length + 1}/${limits.mutationRatePerMinute} for the rolling minute`]
    : [];
}

async function mutateInternal<T extends ArtifactStatePayload>(
  input: ReplaceStateInput<T>,
  resolvePayload: (current: ArtifactStateEnvelope<T>) => T,
  conflict: (current: ArtifactStateEnvelope<T>) => boolean,
  inputDescriptor: unknown,
): Promise<StateMutationResult<T>> {
  const key = input.key ?? "default";
  const limits = mergeLimits(input.limits);
  statePath(input.artifactId, input.kind, key);
  assertMutationInput(input.expectedRevision, input.expectedHash, input.operationId);
  const now = input.now ?? new Date().toISOString();
  if (!validTimestamp(now)) throw new ArtifactStateError("invalid", "mutation time is invalid", 0, "use an ISO timestamp with timezone");
  const inputHash = sha256(stableJson(inputDescriptor, limits.maxJsonDepth));
  return runFileTransaction(input.root, async (transaction) => {
    const existing = await readEnvelopeLocked(input.root, input.artifactId, input.kind, key, limits);
    const current = (existing ?? virtualEnvelope(input.artifactId, input.kind, key, limits)) as ArtifactStateEnvelope<T>;
    const replay = current.operations.find((operation) => operation.id === input.operationId);
    if (replay) {
      if (replay.inputHash !== inputHash) {
        throw new ArtifactStateError("replay-conflict", "operationId was already used for different input", current.revision, "generate a new operationId for a different mutation");
      }
      return {
        status: "replayed",
        revision: replay.revision,
        contentHash: replay.contentHash,
        envelope: current,
        warnings: [],
      };
    }
    if (conflict(current)) {
      throw new ArtifactStateConflictError("state mutation precondition is stale", current, limits.conflictPreviewBytes);
    }
    const committedAt = Date.parse(now) < Date.parse(current.updatedAt) ? current.updatedAt : now;
    const warnings = mutationWarnings(current.operations, Date.parse(committedAt), limits);
    const payload = validatePayload(input.kind, resolvePayload(current), limits, current.revision) as T;
    const contentHash = sha256(stableJson(payload, limits.maxJsonDepth));
    const revision = current.revision + 1;
    const operation: StateOperationRecord = {
      id: input.operationId,
      inputHash,
      revision,
      contentHash,
      committedAt,
    };
    const envelope: ArtifactStateEnvelope<T> = {
      schemaVersion: ARTIFACT_STATE_SCHEMA_VERSION,
      artifactId: input.artifactId,
      kind: input.kind,
      key,
      revision,
      contentHash,
      payload,
      updatedAt: committedAt,
      operations: [...current.operations, operation].slice(-limits.operationRecords),
    };
    validateArtifactStateEnvelope(envelope, { artifactId: input.artifactId, kind: input.kind, key }, limits);
    const relativePath = statePath(input.artifactId, input.kind, key);
    const encoded = `${JSON.stringify(envelope, null, 2)}\n`;
    if (utf8Bytes(encoded) > encodedStateCap(input.kind, limits)) {
      throw new ArtifactStateError("quota", `${input.kind} envelope exceeds ${encodedStateCap(input.kind, limits)} encoded bytes`, current.revision, "reduce payload or operation-ledger pressure before retrying");
    }
    await transaction.commit(new Map([[relativePath, encoded]]));
    return { status: "committed", revision, contentHash, envelope, warnings };
  });
}

export async function replaceArtifactState<T extends ArtifactStatePayload>(
  input: ReplaceStateInput<T>,
): Promise<StateMutationResult<T>> {
  return mutateInternal(
    input,
    () => input.payload,
    (current) =>
      current.revision !== input.expectedRevision ||
      (input.expectedHash !== undefined && current.contentHash !== input.expectedHash),
    {
      kind: input.kind,
      key: input.key ?? "default",
      expectedRevision: input.expectedRevision,
      ...(input.expectedHash === undefined ? {} : { expectedHash: input.expectedHash }),
      payload: input.payload,
    },
  );
}

export function artifactDocumentHash(document: unknown): string {
  return sha256(stableJson(document));
}

export async function mutateCollectionDocument(
  input: MutateCollectionDocumentInput,
): Promise<StateMutationResult<CollectionPayload>> {
  if (!STATE_KEY_RE.test(input.id)) {
    throw new ArtifactStateError("invalid", "document ID is unsafe", 0, "use lowercase letters, numbers, and internal hyphens");
  }
  if (input.operation === "set" && input.document === undefined) {
    throw new ArtifactStateError("invalid", "set requires a JSON document", 0, "supply the document body");
  }
  const replacement: ReplaceStateInput<CollectionPayload> = {
    root: input.root,
    artifactId: input.artifactId,
    kind: "collection",
    key: input.collection,
    expectedRevision: input.expectedRevision,
    operationId: input.operationId,
    payload: { docs: {} },
    now: input.now,
    limits: input.limits,
  };
  return mutateInternal(
    replacement,
    (current) => {
      const docs = { ...current.payload.docs };
      if (input.operation === "set") docs[input.id] = normalizeJson(input.document);
      else delete docs[input.id];
      return { docs };
    },
    (current) => {
      const currentDocument = current.payload.docs[input.id];
      const currentDocumentHash = currentDocument === undefined ? null : artifactDocumentHash(currentDocument);
      return currentDocumentHash !== input.expectedDocumentHash;
    },
    {
      collection: input.collection,
      id: input.id,
      operation: input.operation,
      ...(input.document === undefined ? {} : { document: input.document }),
      expectedDocumentHash: input.expectedDocumentHash,
    },
  );
}

async function legacyMigrationItem(
  root: string,
  migrationId: string,
  artifactId: string,
  kind: ArtifactStateKind,
  key: string,
  sourcePath: string,
  now: string,
  limits: ArtifactStateLimits,
): Promise<LegacyStateMigrationItem | undefined> {
  const path = join(root, ...sourcePath.split("/"));
  let bytes: Uint8Array;
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new ArtifactStateError("corrupt", `legacy state path ${sourcePath} is unsafe`, 0, "replace the path with a reviewed regular file before migration");
    }
    if (info.size > limits.collectionBytes + 1024 * 1024) {
      throw new ArtifactStateError("quota", `legacy state ${sourcePath} exceeds the migration read limit`, 0, "archive or reduce the store before migration");
    }
    bytes = await readFile(path);
  } catch (error) {
    if (errnoCode(error) === "ENOENT") return undefined;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch {
    throw new ArtifactStateError("corrupt", `legacy state ${sourcePath} is not valid JSON`, 0, "repair from a verified backup before migration");
  }
  if (isRecord(parsed) && typeof parsed["schemaVersion"] === "number") {
    throw new ArtifactStateError("future-schema", `legacy path ${sourcePath} already carries schemaVersion ${String(parsed["schemaVersion"])}`, 0, "use the matching runtime or an explicit migration adapter");
  }
  const payloadRecord = isRecord(parsed) ? parsed : {};
  const payload = kind === "decisions"
    ? { answers: payloadRecord["answers"] }
    : kind === "comments"
      ? { threads: payloadRecord["threads"] }
      : { docs: payloadRecord["docs"] };
  const validated = validatePayload(kind, payload, limits, 0);
  const contentHash = sha256(stableJson(validated, limits.maxJsonDepth));
  const envelope: ArtifactStateEnvelope = {
    schemaVersion: ARTIFACT_STATE_SCHEMA_VERSION,
    artifactId,
    kind,
    key,
    revision: 1,
    contentHash,
    payload: validated,
    updatedAt: now,
    operations: [],
  };
  validateArtifactStateEnvelope(envelope, { artifactId, kind, key }, limits);
  const targetPath = statePath(artifactId, kind, key);
  const targetText = `${JSON.stringify(envelope, null, 2)}\n`;
  if (utf8Bytes(targetText) > encodedStateCap(kind, limits)) {
    throw new ArtifactStateError("quota", `migrated ${kind} envelope exceeds ${encodedStateCap(kind, limits)} encoded bytes`, 0, "reduce or partition legacy state before migration");
  }
  const existingTarget = await readEnvelopeLocked(root, artifactId, kind, key, limits);
  if (existingTarget) {
    if (existingTarget.contentHash !== envelope.contentHash) {
      throw new ArtifactStateError("stale", `schema-2 target already differs from legacy state: ${targetPath}`, existingTarget.revision, "review both states and choose an explicit repair before migration");
    }
    return undefined;
  }
  return {
    sourcePath,
    backupPath: `.backups/state-v2/${migrationId}/files/${sourcePath}`,
    targetPath,
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    targetHash: createHash("sha256").update(targetText).digest("hex"),
    envelope,
  };
}

export async function planLegacyStateMigration(
  root: string,
  artifactId: string,
  slug: string,
  options: { migrationId?: string; now?: string; limits?: Partial<ArtifactStateLimits> } = {},
): Promise<LegacyStateMigrationPlan> {
  if (!ARTIFACT_ID_RE.test(artifactId) || !STATE_KEY_RE.test(slug)) {
    throw new ArtifactStateError("invalid", "state migration identity or slug is invalid", 0, "use a resolved opaque artifact ID and safe legacy slug");
  }
  const migrationId = options.migrationId ?? randomUUID();
  if (!STATE_OPERATION_ID_RE.test(migrationId)) {
    throw new ArtifactStateError("invalid", "state migrationId must be a UUID", 0, "generate a UUID for the migration attempt");
  }
  const now = options.now ?? new Date().toISOString();
  if (!validTimestamp(now)) throw new ArtifactStateError("invalid", "state migration time is invalid", 0, "use an ISO timestamp with timezone");
  const limits = mergeLimits(options.limits);
  await recoverFileTransactions(root);
  const items: LegacyStateMigrationItem[] = [];
  for (const candidate of [
    await legacyMigrationItem(root, migrationId, artifactId, "decisions", "default", `.state/${slug}.json`, now, limits),
    await legacyMigrationItem(root, migrationId, artifactId, "comments", "default", `.state/${slug}.comments.json`, now, limits),
  ]) {
    if (candidate) items.push(candidate);
  }
  const dbRoot = join(root, ".db", slug);
  const entries = await readdir(dbRoot, { withFileTypes: true }).catch((error: unknown) => {
    if (errnoCode(error) === "ENOENT") return [];
    throw error;
  });
  if (entries.length > limits.collectionDocuments) {
    throw new ArtifactStateError("quota", "legacy collection-file count exceeds the migration limit", 0, "archive collections before migration");
  }
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(entry.name);
    if (!entry.isFile() || !match) {
      throw new ArtifactStateError("corrupt", `unsafe legacy collection entry ${entry.name}`, 0, "remove or rename the unsupported entry after preserving evidence");
    }
    const candidate = await legacyMigrationItem(root, migrationId, artifactId, "collection", match[1], `.db/${slug}/${entry.name}`, now, limits);
    if (candidate) items.push(candidate);
  }
  return { schemaVersion: 1, migrationId, artifactId, slug, createdAt: now, items };
}

function stateMigrationInventory(plan: LegacyStateMigrationPlan): string {
  return `${JSON.stringify({
    schemaVersion: 1,
    migrationId: plan.migrationId,
    artifactId: plan.artifactId,
    slug: plan.slug,
    createdAt: plan.createdAt,
    items: plan.items.map(({ sourcePath, backupPath, targetPath, sourceHash, targetHash }) => ({ sourcePath, backupPath, targetPath, sourceHash, targetHash })),
  }, null, 2)}\n`;
}

export async function executeLegacyStateMigration(root: string, plan: LegacyStateMigrationPlan): Promise<void> {
  const inventoryPath = `.backups/state-v2/${plan.migrationId}/inventory.json`;
  const inventory = stateMigrationInventory(plan);
  await runFileTransaction(root, async (transaction) => {
    const existing = await readFile(join(root, ...inventoryPath.split("/"))).catch((error: unknown) => {
      if (errnoCode(error) === "ENOENT") return undefined;
      throw error;
    });
    if (existing !== undefined) {
      if (Buffer.from(existing).toString("utf8") !== inventory) throw new ArtifactStateError("corrupt", "state migration token conflicts with its inventory", 0, "generate a new plan after reviewing the recorded migration");
      return;
    }
    await transaction.commit(new Map([[inventoryPath, inventory]]));
  });
  for (const item of plan.items) {
    await runFileTransaction(root, async (transaction) => {
      const source = await readFile(join(root, ...item.sourcePath.split("/")));
      if (createHash("sha256").update(source).digest("hex") !== item.sourceHash) {
        throw new ArtifactStateError("stale", `legacy state changed after preflight: ${item.sourcePath}`, 0, "regenerate the migration plan");
      }
      const targetText = `${JSON.stringify(item.envelope, null, 2)}\n`;
      const existing = await readFile(join(root, ...item.targetPath.split("/"))).catch((error: unknown) => {
        if (errnoCode(error) === "ENOENT") return undefined;
        throw error;
      });
      if (existing !== undefined) {
        if (createHash("sha256").update(existing).digest("hex") !== item.targetHash) {
          throw new ArtifactStateError("corrupt", `state migration target conflicts: ${item.targetPath}`, 0, "preserve evidence and run repair preflight");
        }
        return;
      }
      await transaction.commit(new Map<string, string | Uint8Array | null>([[item.backupPath, source], [item.targetPath, targetText]]));
    });
  }
}

export async function rollbackLegacyStateMigration(root: string, plan: LegacyStateMigrationPlan): Promise<void> {
  for (const item of [...plan.items].reverse()) {
    await runFileTransaction(root, async (transaction) => {
      const backup = await readFile(join(root, ...item.backupPath.split("/")));
      const target = await readFile(join(root, ...item.targetPath.split("/")));
      if (
        createHash("sha256").update(backup).digest("hex") !== item.sourceHash ||
        createHash("sha256").update(target).digest("hex") !== item.targetHash
      ) {
        throw new ArtifactStateError("corrupt", `state rollback verification failed for ${item.targetPath}`, 0, "preserve both copies and run repair preflight");
      }
      await transaction.commit(new Map([[item.targetPath, null]]));
    });
  }
}
