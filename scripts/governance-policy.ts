import { readFile } from "node:fs/promises";
import { join } from "node:path";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  required: string[],
  path: string,
  errors: string[],
): void {
  for (const key of required) {
    if (!(key in value)) errors.push(`${path} is missing ${key}`);
  }
  for (const key of Object.keys(value)) {
    if (!required.includes(key)) errors.push(`${path} has unexpected field ${key}`);
  }
}

function textField(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
    return false;
  }
  return true;
}

const REQUIRED_SUPPORT_IDS = [
  "observed-linux-opencode",
  "ubuntu-lts-desktop",
  "macos-current-desktop",
  "macos-previous-desktop",
  "windows-11-native-desktop",
  "windows-11-wsl-desktop",
  "android-chrome-viewer",
  "ios-safari-viewer",
  "node-before-24",
];

const REQUIRED_MODES = [
  "portable-local",
  "loopback-service",
  "github-pages-public",
  "cloudflare-public",
  "authenticated-hosting",
  "viewer-connectors",
  "journey-study",
  "release-evidence",
];

const REQUIRED_BOUNDARIES = [
  "portable-page",
  "trusted-html",
  "filesystem",
  "loopback",
  "deployment",
  "public-static",
  "hosted-content-control",
  "audience-identity",
  "mutable-state",
  "connectors",
];

export function validateGovernancePolicy(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["policy must be an object"];
  exactKeys(
    value,
    ["schemaVersion", "policyVersion", "reviewedAt", "owners", "providerPrerequisites", "supportCells", "dataInventory", "threatBoundaries"],
    "policy",
    errors,
  );
  if (value["schemaVersion"] !== 1) errors.push("policy.schemaVersion must be 1");
  if (value["policyVersion"] !== 1) errors.push("policy.policyVersion must be 1");
  if (typeof value["reviewedAt"] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value["reviewedAt"])) {
    errors.push("policy.reviewedAt must be an ISO date");
  }

  const owners = value["owners"];
  const ownerKeys = ["security", "privacy", "compatibility", "release"];
  if (!isRecord(owners)) {
    errors.push("policy.owners must be an object");
  } else {
    exactKeys(owners, ownerKeys, "policy.owners", errors);
    for (const key of ownerKeys) textField(owners[key], `policy.owners.${key}`, errors);
  }

  const prerequisites = value["providerPrerequisites"];
  if (!Array.isArray(prerequisites)) {
    errors.push("policy.providerPrerequisites must be an array");
  } else {
    const ids = new Set<string>();
    for (let index = 0; index < prerequisites.length; index++) {
      const item = prerequisites[index];
      const path = `policy.providerPrerequisites[${index}]`;
      if (!isRecord(item)) {
        errors.push(`${path} must be an object`);
        continue;
      }
      exactKeys(item, ["id", "status", "checkedAt", "evidence", "claim"], path, errors);
      if (textField(item["id"], `${path}.id`, errors)) {
        if (ids.has(item["id"])) errors.push(`${path}.id is duplicated`);
        ids.add(item["id"]);
      }
      if (!new Set(["pass", "failed", "unverified"]).has(String(item["status"]))) {
        errors.push(`${path}.status is invalid`);
      }
      textField(item["checkedAt"], `${path}.checkedAt`, errors);
      textField(item["evidence"], `${path}.evidence`, errors);
      textField(item["claim"], `${path}.claim`, errors);
    }
    for (const id of ["github-private-vulnerability-reporting", "npm-trusted-publishing"]) {
      if (!ids.has(id)) errors.push(`policy.providerPrerequisites is missing ${id}`);
    }
  }

  const cells = value["supportCells"];
  if (!Array.isArray(cells)) {
    errors.push("policy.supportCells must be an array");
  } else {
    const ids = new Set<string>();
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      const path = `policy.supportCells[${index}]`;
      if (!isRecord(cell)) {
        errors.push(`${path} must be an object`);
        continue;
      }
      exactKeys(cell, ["id", "class", "status", "os", "node", "opencode", "browser", "scope", "testedAt", "evidence"], path, errors);
      if (textField(cell["id"], `${path}.id`, errors)) {
        if (ids.has(cell["id"])) errors.push(`${path}.id is duplicated`);
        ids.add(cell["id"]);
      }
      const status = String(cell["status"]);
      if (!new Set(["target", "tested", "supported", "unsupported", "unverified"]).has(status)) {
        errors.push(`${path}.status is invalid`);
      }
      if (!new Set(["target", "tested", "unsupported"]).has(String(cell["class"]))) {
        errors.push(`${path}.class is invalid`);
      }
      for (const field of ["os", "node", "opencode", "browser", "scope"]) {
        textField(cell[field], `${path}.${field}`, errors);
      }
      const hasDate = typeof cell["testedAt"] === "string" && cell["testedAt"] !== "";
      const hasEvidence = typeof cell["evidence"] === "string" && cell["evidence"] !== "";
      if ((status === "tested" || status === "supported") && (!hasDate || !hasEvidence)) {
        errors.push(`${path} cannot be ${status} without dated evidence`);
      }
      if (status === "unverified" && (hasDate || hasEvidence)) {
        errors.push(`${path} cannot be unverified with pass evidence`);
      }
    }
    for (const id of REQUIRED_SUPPORT_IDS) {
      if (!ids.has(id)) errors.push(`policy.supportCells is missing ${id}`);
    }
  }

  const inventory = value["dataInventory"];
  if (!Array.isArray(inventory)) {
    errors.push("policy.dataInventory must be an array");
  } else {
    const modes = new Set<string>();
    const fields = ["mode", "availability", "fields", "purpose", "controllerOperator", "recipientLocation", "sensitivity", "retention", "deletion"];
    for (let index = 0; index < inventory.length; index++) {
      const item = inventory[index];
      const path = `policy.dataInventory[${index}]`;
      if (!isRecord(item)) {
        errors.push(`${path} must be an object`);
        continue;
      }
      exactKeys(item, fields, path, errors);
      for (const field of fields) textField(item[field], `${path}.${field}`, errors);
      if (typeof item["mode"] === "string") {
        if (modes.has(item["mode"])) errors.push(`${path}.mode is duplicated`);
        modes.add(item["mode"]);
      }
      if (!new Set(["current", "partial", "planned", "protocol-ready"]).has(String(item["availability"]))) {
        errors.push(`${path}.availability is invalid`);
      }
    }
    for (const mode of REQUIRED_MODES) {
      if (!modes.has(mode)) errors.push(`policy.dataInventory is missing ${mode}`);
    }
  }

  const boundaries = value["threatBoundaries"];
  if (!Array.isArray(boundaries)) {
    errors.push("policy.threatBoundaries must be an array");
  } else {
    const ids = new Set<string>();
    for (let index = 0; index < boundaries.length; index++) {
      const item = boundaries[index];
      const path = `policy.threatBoundaries[${index}]`;
      if (!isRecord(item)) {
        errors.push(`${path} must be an object`);
        continue;
      }
      exactKeys(item, ["id", "availability", "evidence"], path, errors);
      if (textField(item["id"], `${path}.id`, errors)) ids.add(item["id"]);
      if (!new Set(["current", "partial", "planned"]).has(String(item["availability"]))) {
        errors.push(`${path}.availability is invalid`);
      }
      textField(item["evidence"], `${path}.evidence`, errors);
    }
    for (const id of REQUIRED_BOUNDARIES) {
      if (!ids.has(id)) errors.push(`policy.threatBoundaries is missing ${id}`);
    }
  }
  return errors;
}

export interface GovernanceClaimInputs {
  readme: string;
  security: string;
  support: string;
  dataGovernance: string;
  hosted: string;
  packageJson: unknown;
}

export function validateGovernanceClaims(inputs: GovernanceClaimInputs): string[] {
  const errors: string[] = [];
  if (inputs.readme.includes("with provenance attestations")) {
    errors.push("README claims provenance attestations without registry evidence");
  }
  for (const link of ["docs/support-policy.md", "docs/security.md", "docs/data-governance.md"]) {
    if (!inputs.readme.includes(link)) errors.push(`README is missing governance link ${link}`);
  }
  if (!inputs.security.includes("Private vulnerability reporting is currently **unavailable**")) {
    errors.push("SECURITY.md must expose unavailable private reporting");
  }
  if (!inputs.support.includes("no fully supported platform/browser cells")) {
    errors.push("support policy must expose the empty supported matrix");
  }
  if (!inputs.dataGovernance.includes("Local rendering sends no project usage telemetry")) {
    errors.push("data policy must state the no-default-telemetry boundary");
  }
  if (!inputs.hosted.includes("public by default")) {
    errors.push("Cloudflare guide must expose public-by-default operation");
  }
  if (!isRecord(inputs.packageJson) || !isRecord(inputs.packageJson["engines"]) ||
      inputs.packageJson["engines"]["node"] !== ">=24") {
    errors.push("package engines.node must match the Node 24 support floor");
  }
  return errors;
}

export async function validateGovernanceRepository(root: string): Promise<string[]> {
  const read = (path: string): Promise<string> => readFile(join(root, path), "utf8");
  try {
    const [policyText, readme, security, support, dataGovernance, hosted, packageText] = await Promise.all([
      read("docs/governance-policy.json"),
      read("README.md"),
      read("SECURITY.md"),
      read("docs/support-policy.md"),
      read("docs/data-governance.md"),
      read("docs/hosted-cloudflare.md"),
      read("package.json"),
    ]);
    const policy = JSON.parse(policyText) as unknown;
    return [
      ...validateGovernancePolicy(policy),
      ...validateGovernanceClaims({
        readme,
        security,
        support,
        dataGovernance,
        hosted,
        packageJson: JSON.parse(packageText) as unknown,
      }),
    ];
  } catch (error) {
    return [`cannot load governance policy: ${error instanceof Error ? error.message : String(error)}`];
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const root = join(import.meta.dirname, "..");
  const errors = await validateGovernanceRepository(root);
  if (errors.length > 0) {
    for (const error of errors) console.error(`FAIL - ${error}`);
    process.exit(1);
  }
  console.log("ok - governance policy and claims are consistent");
}
