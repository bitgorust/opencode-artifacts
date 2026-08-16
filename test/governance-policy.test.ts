import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateGovernanceClaims,
  validateGovernancePolicy,
  validateGovernanceRepository,
  validateRedistributionInventory,
} from "../scripts/governance-policy.ts";

const root = new URL("..", import.meta.url).pathname;
const policy = JSON.parse(await readFile(new URL("../docs/governance-policy.json", import.meta.url), "utf8")) as Record<string, unknown>;
const redistribution = JSON.parse(
  await readFile(new URL("../docs/redistribution-inventory.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

function inventoriedAssets(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    (value["binaryAssets"] as Array<Record<string, string>>).map((item) => [item["path"], item["sha256"]]),
  );
}

test("checked-in governance policy is complete and claim-consistent", async () => {
  assert.deepEqual(validateGovernancePolicy(policy), []);
  assert.deepEqual(await validateGovernanceRepository(root), []);
});

test("support claims cannot pass without exact dated evidence", () => {
  const changed = structuredClone(policy);
  const cells = changed["supportCells"] as Array<Record<string, unknown>>;
  cells[1]["status"] = "supported";
  const errors = validateGovernancePolicy(changed).join("\n");
  assert.match(errors, /cannot be supported without dated evidence/);
});

test("required target cells, data modes, and threat boundaries cannot disappear", () => {
  const changed = structuredClone(policy);
  (changed["supportCells"] as unknown[]).pop();
  (changed["dataInventory"] as unknown[]).pop();
  (changed["threatBoundaries"] as unknown[]).pop();
  const errors = validateGovernancePolicy(changed).join("\n");
  assert.match(errors, /supportCells is missing node-before-24/);
  assert.match(errors, /dataInventory is missing release-evidence/);
  assert.match(errors, /threatBoundaries is missing connectors/);
});

test("inflated README provenance and mismatched Node claims fail consistency", () => {
  const errors = validateGovernanceClaims({
    readme: "with provenance attestations",
    security: "",
    support: "",
    dataGovernance: "",
    hosted: "",
    packageJson: { engines: { node: ">=20" } },
  }).join("\n");
  assert.match(errors, /claims provenance attestations/);
  assert.match(errors, /engines.node must match/);
  assert.match(errors, /verified private reporting/);
  assert.match(errors, /public-preview status/);
  assert.match(errors, /separate public preview from certification/);
});

test("redistribution inventory binds every retained binary and keeps official references link-only", () => {
  const actualAssets = inventoriedAssets(redistribution);
  assert.deepEqual(validateRedistributionInventory(redistribution, actualAssets), []);

  const missing = structuredClone(redistribution);
  (missing["binaryAssets"] as unknown[]).pop();
  assert.match(validateRedistributionInventory(missing, actualAssets).join("\n"), /binaryAssets is missing/);

  const changed = structuredClone(redistribution);
  ((changed["binaryAssets"] as Array<Record<string, unknown>>)[0])["sha256"] = "a".repeat(64);
  ((changed["externalBenchmarkReferences"] as Array<Record<string, unknown>>)[0])["localCopy"] = "copied.png";
  const changedErrors = validateRedistributionInventory(changed, actualAssets).join("\n");
  assert.match(changedErrors, /sha256 does not match retained bytes/);
  assert.match(changedErrors, /localCopy must be null/);

  const withFont = { ...actualAssets, "docs/fonts/unreviewed.woff2": "b".repeat(64) };
  const fontErrors = validateRedistributionInventory(redistribution, withFont).join("\n");
  assert.match(fontErrors, /binaryAssets is missing docs\/fonts\/unreviewed\.woff2/);
  assert.match(fontErrors, /embeds an undisposed font/);
});
