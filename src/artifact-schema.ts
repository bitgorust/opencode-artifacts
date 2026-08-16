import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { recoverFileTransactions } from "./file-transaction.ts";

export const ARTIFACT_MANIFEST_SCHEMA_VERSION = 2;
export const ARTIFACT_MANIFEST_FILE = "manifest.json";
export const ARTIFACT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const ARTIFACT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CONTENT_HASH_RE = /^[0-9a-f]{64}$/;

const MAX_ARTIFACTS = 10_000;
const MAX_REVISIONS_PER_ARTIFACT = 10_000;
const MAX_TEXT_LENGTH = 16_384;
const MAX_DEPLOYMENT_REFERENCES = 1_000;

export type RevisionProvenanceKind = "create" | "update" | "restore" | "migration";

export interface RevisionProvenanceV2 {
  kind: RevisionProvenanceKind;
  restoredFrom?: number;
  legacyRevision?: number;
  timestampSource?: "recorded" | "legacy-artifact" | "unknown";
}

export interface RevisionRecordV2 {
  revision: number;
  createdAt: string | null;
  bytes: number;
  contentHash: string;
  pagePath: string;
  title: string;
  icon: string;
  description?: string;
  source?: string;
  author?: string;
  charts: number;
  provenance: RevisionProvenanceV2;
}

export interface DeploymentReferenceV2 {
  capability: "public-static" | "authenticated" | "connector-capable";
  target: string;
  url: string;
  revision: number;
  createdAt: string;
}

export interface ArtifactRecordV2 {
  id: string;
  slug: string;
  title: string;
  icon: string;
  description?: string;
  source?: string;
  author?: string;
  createdAt: string | null;
  updatedAt: string | null;
  headRevision: number;
  revisions: RevisionRecordV2[];
  charts: number;
  bytes: number;
  contentHash: string;
  deploymentReferences: DeploymentReferenceV2[];
}

export interface ArtifactManifestV2 {
  schemaVersion: 2;
  artifacts: Record<string, ArtifactRecordV2>;
  slugIndex: Record<string, string>;
}

export class ArtifactSchemaError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`artifact manifest schema validation failed: ${issues.join("; ")}`);
    this.name = "ArtifactSchemaError";
    this.issues = [...issues];
  }
}

export class ArtifactMigrationRequiredError extends Error {
  constructor() {
    super("artifact manifest uses a legacy schema; run lifecycle migration preflight before enabling schema 2");
    this.name = "ArtifactMigrationRequiredError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function boundedString(value: unknown, allowEmpty = false): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_TEXT_LENGTH &&
    (allowEmpty || value.length > 0)
  );
}

function validTimestamp(value: unknown, nullable = false): value is string | null {
  if (nullable && value === null) return true;
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

const PROVENANCE_KEYS = new Set([
  "kind",
  "restoredFrom",
  "legacyRevision",
  "timestampSource",
]);

function validateProvenance(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value) || !hasOnlyKeys(value, PROVENANCE_KEYS)) {
    issues.push(`${path} must be an exact provenance object`);
    return;
  }
  if (
    value["kind"] !== "create" &&
    value["kind"] !== "update" &&
    value["kind"] !== "restore" &&
    value["kind"] !== "migration"
  ) {
    issues.push(`${path}.kind is invalid`);
  }
  if (value["restoredFrom"] !== undefined && !positiveInteger(value["restoredFrom"])) {
    issues.push(`${path}.restoredFrom must be a positive integer`);
  }
  if (value["legacyRevision"] !== undefined && !positiveInteger(value["legacyRevision"])) {
    issues.push(`${path}.legacyRevision must be a positive integer`);
  }
  if (
    value["timestampSource"] !== undefined &&
    value["timestampSource"] !== "recorded" &&
    value["timestampSource"] !== "legacy-artifact" &&
    value["timestampSource"] !== "unknown"
  ) {
    issues.push(`${path}.timestampSource is invalid`);
  }
  if (value["kind"] === "restore" && !positiveInteger(value["restoredFrom"])) {
    issues.push(`${path}.restoredFrom is required for restore provenance`);
  }
}

const REVISION_KEYS = new Set([
  "revision",
  "createdAt",
  "bytes",
  "contentHash",
  "pagePath",
  "title",
  "icon",
  "description",
  "source",
  "author",
  "charts",
  "provenance",
]);

function validateRevision(
  value: unknown,
  artifactId: string,
  expectedRevision: number,
  path: string,
  issues: string[],
): void {
  if (!isRecord(value) || !hasOnlyKeys(value, REVISION_KEYS)) {
    issues.push(`${path} must be an exact revision object`);
    return;
  }
  if (value["revision"] !== expectedRevision) {
    issues.push(`${path}.revision must be contiguous and equal ${expectedRevision}`);
  }
  if (!validTimestamp(value["createdAt"], true)) issues.push(`${path}.createdAt is invalid`);
  if (!nonNegativeInteger(value["bytes"])) issues.push(`${path}.bytes is invalid`);
  if (typeof value["contentHash"] !== "string" || !CONTENT_HASH_RE.test(value["contentHash"])) {
    issues.push(`${path}.contentHash must be a SHA-256 digest`);
  }
  if (value["pagePath"] !== `revisions/${artifactId}/${expectedRevision}.html`) {
    issues.push(`${path}.pagePath is not canonical`);
  }
  for (const key of ["title", "icon"] as const) {
    if (!boundedString(value[key])) issues.push(`${path}.${key} is invalid`);
  }
  for (const key of ["description", "source", "author"] as const) {
    if (value[key] !== undefined && !boundedString(value[key], true)) {
      issues.push(`${path}.${key} is invalid`);
    }
  }
  if (!nonNegativeInteger(value["charts"])) issues.push(`${path}.charts is invalid`);
  validateProvenance(value["provenance"], `${path}.provenance`, issues);
}

const DEPLOYMENT_KEYS = new Set([
  "capability",
  "target",
  "url",
  "revision",
  "createdAt",
]);

function validateDeployment(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value) || !hasOnlyKeys(value, DEPLOYMENT_KEYS)) {
    issues.push(`${path} must be an exact deployment reference`);
    return;
  }
  if (
    value["capability"] !== "public-static" &&
    value["capability"] !== "authenticated" &&
    value["capability"] !== "connector-capable"
  ) {
    issues.push(`${path}.capability is invalid`);
  }
  if (!boundedString(value["target"])) issues.push(`${path}.target is invalid`);
  if (!boundedString(value["url"])) {
    issues.push(`${path}.url is invalid`);
  } else {
    try {
      const url = new URL(value["url"]);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        issues.push(`${path}.url must use http or https`);
      }
    } catch {
      issues.push(`${path}.url is invalid`);
    }
  }
  if (!positiveInteger(value["revision"])) issues.push(`${path}.revision is invalid`);
  if (!validTimestamp(value["createdAt"])) issues.push(`${path}.createdAt is invalid`);
}

const ARTIFACT_KEYS = new Set([
  "id",
  "slug",
  "title",
  "icon",
  "description",
  "source",
  "author",
  "createdAt",
  "updatedAt",
  "headRevision",
  "revisions",
  "charts",
  "bytes",
  "contentHash",
  "deploymentReferences",
]);

function validateArtifact(value: unknown, id: string, path: string, issues: string[]): void {
  if (!isRecord(value) || !hasOnlyKeys(value, ARTIFACT_KEYS)) {
    issues.push(`${path} must be an exact artifact object`);
    return;
  }
  if (value["id"] !== id || !ARTIFACT_ID_RE.test(id)) issues.push(`${path}.id is invalid`);
  if (typeof value["slug"] !== "string" || !ARTIFACT_SLUG_RE.test(value["slug"])) {
    issues.push(`${path}.slug is invalid`);
  }
  for (const key of ["title", "icon"] as const) {
    if (!boundedString(value[key])) issues.push(`${path}.${key} is invalid`);
  }
  for (const key of ["description", "source", "author"] as const) {
    if (value[key] !== undefined && !boundedString(value[key], true)) {
      issues.push(`${path}.${key} is invalid`);
    }
  }
  if (!validTimestamp(value["createdAt"], true)) issues.push(`${path}.createdAt is invalid`);
  if (!validTimestamp(value["updatedAt"], true)) issues.push(`${path}.updatedAt is invalid`);
  if (!positiveInteger(value["headRevision"])) issues.push(`${path}.headRevision is invalid`);
  if (
    !Array.isArray(value["revisions"]) ||
    value["revisions"].length === 0 ||
    value["revisions"].length > MAX_REVISIONS_PER_ARTIFACT
  ) {
    issues.push(`${path}.revisions must be a bounded non-empty array`);
  } else {
    for (let index = 0; index < value["revisions"].length; index++) {
      validateRevision(value["revisions"][index], id, index + 1, `${path}.revisions[${index}]`, issues);
    }
    const head = value["revisions"].at(-1);
    if (value["headRevision"] !== value["revisions"].length) {
      issues.push(`${path}.headRevision must select the latest contiguous revision`);
    }
    if (isRecord(head)) {
      for (const key of ["title", "icon", "description", "source", "author", "charts", "bytes", "contentHash"] as const) {
        if (value[key] !== head[key]) issues.push(`${path}.${key} must match the head revision`);
      }
      if (value["updatedAt"] !== head["createdAt"]) {
        issues.push(`${path}.updatedAt must match the head revision timestamp`);
      }
    }
  }
  if (!nonNegativeInteger(value["charts"])) issues.push(`${path}.charts is invalid`);
  if (!nonNegativeInteger(value["bytes"])) issues.push(`${path}.bytes is invalid`);
  if (typeof value["contentHash"] !== "string" || !CONTENT_HASH_RE.test(value["contentHash"])) {
    issues.push(`${path}.contentHash is invalid`);
  }
  if (
    !Array.isArray(value["deploymentReferences"]) ||
    value["deploymentReferences"].length > MAX_DEPLOYMENT_REFERENCES
  ) {
    issues.push(`${path}.deploymentReferences is invalid`);
  } else {
    for (let index = 0; index < value["deploymentReferences"].length; index++) {
      validateDeployment(
        value["deploymentReferences"][index],
        `${path}.deploymentReferences[${index}]`,
        issues,
      );
    }
  }
}

const MANIFEST_KEYS = new Set(["schemaVersion", "artifacts", "slugIndex"]);

export function validateArtifactManifestV2(value: unknown): ArtifactManifestV2 {
  const issues: string[] = [];
  if (!isRecord(value) || !hasOnlyKeys(value, MANIFEST_KEYS)) {
    throw new ArtifactSchemaError(["manifest must be an exact object"]);
  }
  if (value["schemaVersion"] !== ARTIFACT_MANIFEST_SCHEMA_VERSION) {
    issues.push(`schemaVersion must equal ${ARTIFACT_MANIFEST_SCHEMA_VERSION}`);
  }
  if (!isRecord(value["artifacts"])) {
    issues.push("artifacts must be an object");
  } else {
    const entries = Object.entries(value["artifacts"]);
    if (entries.length > MAX_ARTIFACTS) issues.push(`artifacts exceeds ${MAX_ARTIFACTS}`);
    for (const [id, artifact] of entries) {
      validateArtifact(artifact, id, `artifacts.${id}`, issues);
    }
  }
  if (!isRecord(value["slugIndex"])) {
    issues.push("slugIndex must be an object");
  } else if (isRecord(value["artifacts"])) {
    const expected = new Map<string, string>();
    for (const [id, artifact] of Object.entries(value["artifacts"])) {
      if (isRecord(artifact) && typeof artifact["slug"] === "string") {
        if (expected.has(artifact["slug"])) issues.push(`duplicate active slug ${artifact["slug"]}`);
        expected.set(artifact["slug"], id);
      }
    }
    for (const [slug, id] of Object.entries(value["slugIndex"])) {
      if (!ARTIFACT_SLUG_RE.test(slug) || typeof id !== "string") {
        issues.push(`slugIndex.${slug} is invalid`);
      } else if (expected.get(slug) !== id) {
        issues.push(`slugIndex.${slug} does not match artifact records`);
      }
    }
    if (Object.keys(value["slugIndex"]).length !== expected.size) {
      issues.push("slugIndex does not contain exactly one entry per artifact");
    }
  }
  if (issues.length > 0) throw new ArtifactSchemaError(issues);
  return value as unknown as ArtifactManifestV2;
}

export function emptyArtifactManifestV2(): ArtifactManifestV2 {
  return { schemaVersion: ARTIFACT_MANIFEST_SCHEMA_VERSION, artifacts: {}, slugIndex: {} };
}

export function parseArtifactManifestV2(raw: string): ArtifactManifestV2 {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ArtifactSchemaError([`manifest is not valid JSON: ${detail}`]);
  }
  if (isRecord(value) && value["schemaVersion"] === ARTIFACT_MANIFEST_SCHEMA_VERSION) {
    return validateArtifactManifestV2(value);
  }
  if (isRecord(value) && typeof value["schemaVersion"] === "number") {
    throw new ArtifactSchemaError([`unsupported future or unknown schemaVersion ${String(value["schemaVersion"])}`]);
  }
  throw new ArtifactMigrationRequiredError();
}

export async function readArtifactManifestV2(dir: string): Promise<ArtifactManifestV2> {
  await recoverFileTransactions(dir);
  const manifestPath = join(dir, ARTIFACT_MANIFEST_FILE);
  let raw: string;
  try {
    const info = await lstat(manifestPath);
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new ArtifactSchemaError(["manifest path must be a regular file"]);
    }
    raw = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyArtifactManifestV2();
    }
    throw error;
  }
  return parseArtifactManifestV2(raw);
}
