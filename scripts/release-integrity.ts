#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface LicenseInventory {
  packageEntries: number;
  licenses: Record<string, number>;
  missingLicenseEntries: string[];
  reviewRequired: Array<{ path: string; license: string }>;
}

export function createLicenseInventory(value: unknown): LicenseInventory {
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
    if (!isRecord(detail) || typeof detail["license"] !== "string" || detail["license"].trim() === "") {
      missingLicenseEntries.push(path);
      licenses["MISSING"] = (licenses["MISSING"] ?? 0) + 1;
      continue;
    }
    const license = detail["license"];
    licenses[license] = (licenses[license] ?? 0) + 1;
    if (/[()]|\b(?:AND|OR|WITH)\b/.test(license)) reviewRequired.push({ path, license });
  }
  return { packageEntries, licenses, missingLicenseEntries, reviewRequired };
}

export function licenseInventoryErrors(inventory: LicenseInventory): string[] {
  const errors: string[] = [];
  if (inventory.missingLicenseEntries.length > 0) {
    errors.push(`missing license metadata: ${inventory.missingLicenseEntries.join(", ")}`);
  }
  if (inventory.reviewRequired.length > 0) {
    errors.push(
      `compound licenses need an explicit branch disposition: ${inventory.reviewRequired
        .map((entry) => `${entry.path} (${entry.license})`)
        .join(", ")}`,
    );
  }
  return errors;
}

export interface PackCoordinate {
  filename: string;
  integrity: string;
  shasum: string;
  packageSpec: string;
}

export function packCoordinate(pack: unknown, packageJson: unknown): PackCoordinate {
  if (!Array.isArray(pack) || pack.length !== 1 || !isRecord(pack[0])) {
    throw new Error("npm pack JSON must contain exactly one result");
  }
  if (!isRecord(packageJson)) throw new Error("package.json must be an object");
  const result = pack[0];
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

async function json(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command === "licenses" && args.length === 1) {
    const inventory = createLicenseInventory(await json(args[0]));
    console.log(JSON.stringify(inventory, null, 2));
    const errors = licenseInventoryErrors(inventory);
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
  if (command === "verify-registry" && args.length === 3) {
    const coordinate = packCoordinate(await json(args[0]), await json(args[1]));
    const errors = verifyPublishedDistribution(coordinate, await json(args[2]));
    for (const error of errors) console.error(`FAIL - ${error}`);
    if (errors.length > 0) process.exitCode = 1;
    else console.log("ok - registry integrity, signature, and provenance match the packed release");
    return;
  }
  console.error("Usage: release-integrity.ts licenses <package-lock.json> | pack-output <pack.json> <package.json> | verify-registry <pack.json> <package.json> <dist.json>");
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
