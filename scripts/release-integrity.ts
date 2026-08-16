#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface LicenseInventory {
  packageEntries: number;
  licenses: Record<string, number>;
  missingLicenseEntries: string[];
  reviewRequired: Array<{ path: string; license: string }>;
}

export function createLicenseInventory(
  value: unknown,
  installedLicenses: Readonly<Record<string, string>> = {},
): LicenseInventory {
  if (!isRecord(value) || !isRecord(value["packages"])) {
    throw new Error("lockfile.packages must be an object");
  }
  const licenses: Record<string, number> = {};
  const missingLicenseEntries: string[] = [];
  const reviewRequired: Array<{ path: string; license: string }> = [];
  let packageEntries = 0;
  for (const [path, detail] of Object.entries(value["packages"])) {
    if (path === "") continue;
    packageEntries++;
    const lockLicense = isRecord(detail) && typeof detail["license"] === "string"
      ? detail["license"].trim()
      : "";
    const installedLicense = installedLicenses[path]?.trim() ?? "";
    const license = lockLicense || installedLicense;
    if (license === "") {
      missingLicenseEntries.push(path);
      licenses["MISSING"] = (licenses["MISSING"] ?? 0) + 1;
      continue;
    }
    licenses[license] = (licenses[license] ?? 0) + 1;
    if (/[()]|\b(?:AND|OR|WITH)\b/.test(license)) reviewRequired.push({ path, license });
  }
  return { packageEntries, licenses, missingLicenseEntries, reviewRequired };
}

export function licenseInventoryErrors(
  inventory: LicenseInventory,
  approvedPaths: ReadonlySet<string> = new Set(),
): string[] {
  const errors: string[] = [];
  const missing = inventory.missingLicenseEntries.filter((path) => !approvedPaths.has(path));
  if (missing.length > 0) {
    errors.push(`missing license metadata: ${missing.join(", ")}`);
  }
  const reviewRequired = inventory.reviewRequired.filter((entry) => !approvedPaths.has(entry.path));
  if (reviewRequired.length > 0) {
    errors.push(
      `compound licenses need an explicit branch disposition: ${reviewRequired
        .map((entry) => `${entry.path} (${entry.license})`)
        .join(", ")}`,
    );
  }
  return errors;
}

export interface LicenseDisposition {
  path: string;
  version: string;
  declaredLicense: string | null;
  selectedLicense: string;
  licenseFile: string;
  sha256: string;
}

export interface LicenseDispositionValidation {
  errors: string[];
  approvedPaths: Set<string>;
  entries: LicenseDisposition[];
}

const DISPOSITION_KEYS = [
  "path",
  "version",
  "declaredLicense",
  "selectedLicense",
  "licenseFile",
  "sha256",
];

function exactKeys(value: Record<string, unknown>, expected: string[], path: string, errors: string[]): void {
  for (const key of expected) {
    if (!(key in value)) errors.push(`${path} is missing ${key}`);
  }
  for (const key of Object.keys(value)) {
    if (!expected.includes(key)) errors.push(`${path} has unexpected field ${key}`);
  }
}

function requiredText(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
    return false;
  }
  return true;
}

function packageEntries(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) && isRecord(value["packages"]) ? value["packages"] : undefined;
}

function lockLicense(detail: unknown, installedLicenses: Readonly<Record<string, string>>, path: string): string | null {
  if (isRecord(detail) && typeof detail["license"] === "string" && detail["license"].trim() !== "") {
    return detail["license"].trim();
  }
  const installed = installedLicenses[path]?.trim();
  return installed ? installed : null;
}

export function validateLicenseDispositions(
  lockfile: unknown,
  installedLicenses: Readonly<Record<string, string>>,
  value: unknown,
  licenseFileHashes: Readonly<Record<string, string>>,
): LicenseDispositionValidation {
  const errors: string[] = [];
  const approvedPaths = new Set<string>();
  const entries: LicenseDisposition[] = [];
  const packages = packageEntries(lockfile);
  if (!packages) return { errors: ["lockfile.packages must be an object"], approvedPaths, entries };
  if (!isRecord(value)) return { errors: ["license disposition document must be an object"], approvedPaths, entries };
  exactKeys(value, ["schemaVersion", "reviewedAt", "approvedBy", "approvedAt", "dispositions"], "dispositions", errors);
  if (value["schemaVersion"] !== 1) errors.push("dispositions.schemaVersion must be 1");
  for (const field of ["reviewedAt", "approvedBy", "approvedAt"]) {
    requiredText(value[field], `dispositions.${field}`, errors);
  }
  if (typeof value["approvedAt"] === "string" && Number.isNaN(Date.parse(value["approvedAt"]))) {
    errors.push("dispositions.approvedAt must be a valid timestamp");
  }
  if (!Array.isArray(value["dispositions"])) {
    errors.push("dispositions.dispositions must be an array");
    return { errors, approvedPaths, entries };
  }

  const seen = new Set<string>();
  for (let index = 0; index < value["dispositions"].length; index++) {
    const item = value["dispositions"][index];
    const itemPath = `dispositions.dispositions[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${itemPath} must be an object`);
      continue;
    }
    exactKeys(item, DISPOSITION_KEYS, itemPath, errors);
    const startErrors = errors.length;
    const pathOk = requiredText(item["path"], `${itemPath}.path`, errors);
    const versionOk = requiredText(item["version"], `${itemPath}.version`, errors);
    const selectedOk = requiredText(item["selectedLicense"], `${itemPath}.selectedLicense`, errors);
    const fileOk = requiredText(item["licenseFile"], `${itemPath}.licenseFile`, errors);
    const hashOk = requiredText(item["sha256"], `${itemPath}.sha256`, errors);
    const declared = item["declaredLicense"];
    if (declared !== null && (typeof declared !== "string" || declared.trim() === "")) {
      errors.push(`${itemPath}.declaredLicense must be a non-empty string or null`);
    }
    if (!pathOk || !versionOk || !selectedOk || !fileOk || !hashOk ||
        (declared !== null && typeof declared !== "string")) continue;
    const entry: LicenseDisposition = {
      path: item["path"],
      version: item["version"],
      declaredLicense: declared,
      selectedLicense: item["selectedLicense"],
      licenseFile: item["licenseFile"],
      sha256: item["sha256"],
    };
    entries.push(entry);
    if (seen.has(entry.path)) errors.push(`${itemPath}.path is duplicated`);
    seen.add(entry.path);
    const detail = packages[entry.path];
    if (!isRecord(detail)) {
      errors.push(`${itemPath}.path is absent from the lockfile`);
    } else {
      if (detail["version"] !== entry.version) errors.push(`${itemPath}.version does not match the lockfile`);
      const actualDeclared = lockLicense(detail, installedLicenses, entry.path);
      if (actualDeclared !== entry.declaredLicense) errors.push(`${itemPath}.declaredLicense does not match installed metadata`);
      if (actualDeclared !== null && !/[()]|\b(?:AND|OR|WITH)\b/.test(actualDeclared)) {
        errors.push(`${itemPath} is not a missing or compound license disposition`);
      }
      if (actualDeclared !== null && !actualDeclared.includes(entry.selectedLicense)) {
        errors.push(`${itemPath}.selectedLicense is not a branch of declaredLicense`);
      }
    }
    const safeFile = !isAbsolute(entry.licenseFile) && !entry.licenseFile.split(/[\\/]/).includes("..") &&
      entry.licenseFile.startsWith(`${entry.path}/`);
    if (!safeFile) errors.push(`${itemPath}.licenseFile must remain inside the disposed package`);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) errors.push(`${itemPath}.sha256 must be a lowercase SHA-256 digest`);
    if (licenseFileHashes[entry.licenseFile] !== entry.sha256) errors.push(`${itemPath}.sha256 does not match the installed license file`);
    if (errors.length === startErrors) approvedPaths.add(entry.path);
  }

  return { errors, approvedPaths, entries };
}

export async function installedPackageLicenses(lockfile: unknown, root: string): Promise<Record<string, string>> {
  const packages = packageEntries(lockfile);
  if (!packages) throw new Error("lockfile.packages must be an object");
  const licenses: Record<string, string> = {};
  await Promise.all(Object.keys(packages).filter((path) => path !== "").map(async (path) => {
    try {
      const manifest = JSON.parse(await readFile(resolve(root, path, "package.json"), "utf8")) as unknown;
      if (isRecord(manifest) && typeof manifest["license"] === "string" && manifest["license"].trim() !== "") {
        licenses[path] = manifest["license"].trim();
      }
    } catch {
      // Missing/unreadable installed metadata remains an explicit license finding.
    }
  }));
  return licenses;
}

async function licenseFileHashes(root: string, value: unknown): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  if (!isRecord(value) || !Array.isArray(value["dispositions"])) return hashes;
  const rootPath = resolve(root);
  await Promise.all(value["dispositions"].map(async (item) => {
    if (!isRecord(item) || typeof item["licenseFile"] !== "string") return;
    const file = item["licenseFile"];
    const absolute = resolve(rootPath, file);
    if (isAbsolute(file) || (absolute !== rootPath && !absolute.startsWith(`${rootPath}${sep}`))) return;
    try {
      hashes[file] = createHash("sha256").update(await readFile(absolute)).digest("hex");
    } catch {
      // A missing file is reported as a hash mismatch by disposition validation.
    }
  }));
  return hashes;
}

export interface ReleaseCandidateChecks {
  audit: boolean;
  licenses: boolean;
  csp: boolean;
  offline: boolean;
  adversarialPayloads: boolean;
  compatibility: boolean;
  packedBytes: boolean;
}

export function releaseCandidateGateFailures(checks: ReleaseCandidateChecks): string[] {
  return (Object.entries(checks) as Array<[keyof ReleaseCandidateChecks, boolean]>)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
}

export const PREVIEW_PREPUBLISH_GATES = [
  "tests",
  "build",
  "structural",
  "package",
  "finalSecretScan",
  "csp",
  "audit",
  "licenses",
  "redistribution",
  "privateIntake",
  "trustedPublishing",
] as const;

export const PREVIEW_POSTPUBLISH_GATES = [
  "registryIntegrity",
  "signature",
  "provenance",
] as const;

export type PreviewPrepublishGate = typeof PREVIEW_PREPUBLISH_GATES[number];
export type PreviewPostpublishGate = typeof PREVIEW_POSTPUBLISH_GATES[number];
export type ReleaseEvidenceStatus = "pass" | "failed" | "incomplete" | "unverified";
export type ReleaseTransitionTarget =
  | "development"
  | "preview-candidate"
  | "public-preview"
  | "certified-local-core";

export interface ReleaseTransitionChecks {
  hardGates: Record<PreviewPrepublishGate | PreviewPostpublishGate, boolean>;
  previewLabel: boolean;
  unsupportedDisclosure: boolean;
  missingEvidenceVisible: boolean;
  certificationClaim: boolean;
  out02: ReleaseEvidenceStatus;
  out03: ReleaseEvidenceStatus;
  support: ReleaseEvidenceStatus;
}

function failedGates(
  checks: ReleaseTransitionChecks,
  gates: ReadonlyArray<PreviewPrepublishGate | PreviewPostpublishGate>,
): string[] {
  return gates.filter((gate) => !checks.hardGates[gate]).map((gate) => `hard gate failed: ${gate}`);
}

function certificationEvidenceIsMissing(checks: ReleaseTransitionChecks): boolean {
  return checks.out02 !== "pass" || checks.out03 !== "pass" || checks.support !== "pass";
}

export function releaseTransitionFailures(
  target: ReleaseTransitionTarget,
  checks: ReleaseTransitionChecks,
): string[] {
  if (target === "development") return [];

  const failures = failedGates(checks, PREVIEW_PREPUBLISH_GATES);
  if (target !== "preview-candidate") {
    failures.push(...failedGates(checks, PREVIEW_POSTPUBLISH_GATES));
  }

  if (target === "preview-candidate" || target === "public-preview") {
    if (!checks.previewLabel) failures.push("public preview label is missing");
    if (!checks.unsupportedDisclosure) failures.push("unsupported disclosure is missing");
    if (checks.certificationClaim) failures.push("public preview cannot claim certification");
    if (certificationEvidenceIsMissing(checks) && !checks.missingEvidenceVisible) {
      failures.push("missing certification evidence is hidden");
    }
    return failures;
  }

  if (checks.previewLabel) failures.push("certified release cannot retain a preview label");
  if (checks.unsupportedDisclosure) failures.push("certified release cannot claim unsupported status");
  if (!checks.certificationClaim) failures.push("certified release must claim its exact certified level");
  for (const field of ["out02", "out03", "support"] as const) {
    if (checks[field] !== "pass") failures.push(`certification evidence is not pass: ${field}`);
  }
  return failures;
}

export interface PackCoordinate {
  filename: string;
  integrity: string;
  shasum: string;
  packageSpec: string;
}

export function packCoordinate(pack: unknown, packageJson: unknown): PackCoordinate {
  let result: Record<string, unknown> | undefined;
  if (Array.isArray(pack) && pack.length === 1 && isRecord(pack[0])) result = pack[0];
  else if (isRecord(pack)) {
    const values = Object.values(pack);
    if (values.length === 1 && isRecord(values[0])) result = values[0];
  }
  if (!result) throw new Error("npm pack JSON must contain exactly one result");
  if (!isRecord(packageJson)) throw new Error("package.json must be an object");
  for (const field of ["filename", "integrity", "shasum"]) {
    if (typeof result[field] !== "string" || result[field].trim() === "") {
      throw new Error(`npm pack result is missing ${field}`);
    }
  }
  if (typeof packageJson["name"] !== "string" || typeof packageJson["version"] !== "string") {
    throw new Error("package.json must contain name and version");
  }
  return {
    filename: result["filename"] as string,
    integrity: result["integrity"] as string,
    shasum: result["shasum"] as string,
    packageSpec: `${packageJson["name"]}@${packageJson["version"]}`,
  };
}

export interface CandidateProvenanceEnvironment {
  repository: string;
  commit: string;
  workflowRef: string;
  runId: string;
  runAttempt: string;
  serverUrl: string;
}

export function candidateProvenance(
  pack: unknown,
  packageJson: unknown,
  sha256: string,
  environment: CandidateProvenanceEnvironment,
): Record<string, unknown> {
  const coordinate = packCoordinate(pack, packageJson);
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("candidate SHA-256 digest is invalid");
  for (const [name, value] of Object.entries(environment)) {
    if (value.trim() === "") throw new Error(`candidate provenance is missing ${name}`);
  }
  const repositoryUrl = `${environment.serverUrl}/${environment.repository}`;
  const invocationUrl = `${repositoryUrl}/actions/runs/${environment.runId}/attempts/${environment.runAttempt}`;
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: coordinate.filename, digest: { sha256 } }],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://github.com/actions/runner",
        externalParameters: { repository: repositoryUrl, commit: environment.commit },
        internalParameters: { workflowRef: environment.workflowRef },
        resolvedDependencies: [{
          uri: `git+${repositoryUrl}.git@${environment.commit}`,
          digest: { gitCommit: environment.commit },
        }],
      },
      runDetails: {
        builder: { id: invocationUrl },
        metadata: { invocationId: invocationUrl },
      },
    },
  };
}

export function verifyPublishedDistribution(pack: unknown, dist: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(pack) || !isRecord(dist)) return ["pack coordinate and registry dist must be objects"];
  for (const field of ["integrity", "shasum"]) {
    if (typeof pack[field] !== "string" || dist[field] !== pack[field]) {
      errors.push(`registry ${field} does not match the packed bytes`);
    }
  }
  const attestations = dist["attestations"];
  if (!isRecord(attestations) || !isRecord(attestations["provenance"]) ||
      typeof attestations["provenance"]["predicateType"] !== "string") {
    errors.push("registry provenance attestation is missing");
  }
  if (!Array.isArray(dist["signatures"]) || dist["signatures"].length === 0) {
    errors.push("registry package signature is missing");
  }
  return errors;
}

export function verifyTagVersion(packageJson: unknown, tag: string): string[] {
  if (!isRecord(packageJson) || typeof packageJson["version"] !== "string") {
    return ["package.json must contain a version"];
  }
  const expected = `v${packageJson["version"]}`;
  return tag === expected ? [] : [`release tag ${tag || "<empty>"} does not match package version ${expected}`];
}

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "licenses" && args.length === 2) {
    const lockPath = resolve(args[0]);
    const root = dirname(lockPath);
    const lockfile = await json(lockPath);
    const dispositionValue = await json(args[1]);
    const installedLicenses = await installedPackageLicenses(lockfile, root);
    const inventory = createLicenseInventory(lockfile, installedLicenses);
    const validation = validateLicenseDispositions(
      lockfile,
      installedLicenses,
      dispositionValue,
      await licenseFileHashes(root, dispositionValue),
    );
    console.log(JSON.stringify({ inventory, approvedDispositions: validation.entries }, null, 2));
    const errors = [...validation.errors, ...licenseInventoryErrors(inventory, validation.approvedPaths)];
    for (const error of errors) console.error(`FAIL - ${error}`);
    if (errors.length > 0) process.exitCode = 1;
    return;
  }
  if (command === "pack-output" && args.length === 2) {
    const coordinate = packCoordinate(await json(args[0]), await json(args[1]));
    console.log(`tarball=${coordinate.filename}`);
    console.log(`package_spec=${coordinate.packageSpec}`);
    console.log(`integrity=${coordinate.integrity}`);
    console.log(`shasum=${coordinate.shasum}`);
    return;
  }
  if (command === "candidate-provenance" && args.length === 2) {
    const pack = await json(args[0]);
    const packageJson = await json(args[1]);
    const coordinate = packCoordinate(pack, packageJson);
    const digest = createHash("sha256").update(await readFile(resolve(coordinate.filename))).digest("hex");
    const provenance = candidateProvenance(pack, packageJson, digest, {
      repository: process.env["GITHUB_REPOSITORY"] ?? "",
      commit: process.env["GITHUB_SHA"] ?? "",
      workflowRef: process.env["GITHUB_WORKFLOW_REF"] ?? "",
      runId: process.env["GITHUB_RUN_ID"] ?? "",
      runAttempt: process.env["GITHUB_RUN_ATTEMPT"] ?? "",
      serverUrl: process.env["GITHUB_SERVER_URL"] ?? "https://github.com",
    });
    console.log(JSON.stringify(provenance, null, 2));
    return;
  }
  if (command === "verify-registry" && args.length === 3) {
    const coordinate = packCoordinate(await json(args[0]), await json(args[1]));
    const errors = verifyPublishedDistribution(coordinate, await json(args[2]));
    for (const error of errors) console.error(`FAIL - ${error}`);
    if (errors.length > 0) process.exitCode = 1;
    else console.log("ok - registry integrity, signature, and provenance match the packed release");
    return;
  }
  if (command === "tag-version" && args.length === 2) {
    const errors = verifyTagVersion(await json(args[0]), args[1]);
    for (const error of errors) console.error(`FAIL - ${error}`);
    if (errors.length > 0) process.exitCode = 1;
    else console.log(`ok - release tag ${args[1]} matches package version`);
    return;
  }
  console.error("Usage: release-integrity.ts licenses <package-lock.json> <license-dispositions.json> | pack-output <pack.json> <package.json> | candidate-provenance <pack.json> <package.json> | verify-registry <pack.json> <package.json> <dist.json> | tag-version <package.json> <tag>");
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
