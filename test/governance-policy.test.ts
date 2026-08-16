import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateGovernanceClaims,
  validateGovernancePolicy,
  validateGovernanceRepository,
} from "../scripts/governance-policy.ts";

const root = new URL("..", import.meta.url).pathname;
const policy = JSON.parse(await readFile(new URL("../docs/governance-policy.json", import.meta.url), "utf8")) as Record<string, unknown>;

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
  assert.match(errors, /unavailable private reporting/);
});
