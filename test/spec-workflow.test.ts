import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  archiveChange,
  scaffoldChange,
  validateChange,
  validateSpecRepository,
  withdrawChange,
  type ChangeMetadata,
} from "../scripts/spec-workflow-lib.ts";

const repositoryRoot = join(import.meta.dirname, "..");
const templatesRoot = join(repositoryRoot, "specs", "templates");

async function temporaryRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "spec-workflow-"));
  await mkdir(join(root, "specs", "changes"), { recursive: true });
  await mkdir(join(root, "specs", "archive"), { recursive: true });
  await mkdir(join(root, "specs", "current"), { recursive: true });
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "test"), { recursive: true });
  await writeFile(join(root, "docs", "product-spec.md"), "- **LIFE-01:** Durable lifecycle.\n", "utf8");
  return root;
}

test("scaffold creates lane-specific packets and rejects unsafe IDs", async () => {
  const root = await temporaryRepository();
  try {
    const standard = await scaffoldChange(
      root,
      "clear-errors",
      "standard",
      "Make failures actionable",
      templatesRoot,
      new Date("2026-08-15T00:00:00Z"),
    );
    assert.equal(existsSync(join(standard, "proposal.md")), true);
    assert.equal(existsSync(join(standard, "design.md")), false);
    const standardMetadata = JSON.parse(await readFile(join(standard, "change.json"), "utf8")) as ChangeMetadata;
    assert.equal(standardMetadata.createdAt, "2026-08-15");
    assert.equal(standardMetadata.status, "draft");
    assert.deepEqual(standardMetadata.withdrawal, { by: "", at: "", reason: "" });

    const highRisk = await scaffoldChange(root, "atomic-publish", "high-risk", "Serialize publication", templatesRoot);
    assert.equal(existsSync(join(highRisk, "design.md")), true);
    await assert.rejects(
      scaffoldChange(root, "../escaped", "standard", "Escape", templatesRoot),
      /invalid change ID/,
    );
    await assert.rejects(
      scaffoldChange(root, "clear-errors", "standard", "Duplicate", templatesRoot),
      /already exists/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("withdrawal retains rejected proposals without claiming delivered behavior", async () => {
  const root = await temporaryRepository();
  try {
    const directory = await scaffoldChange(
      root,
      "rejected-direction",
      "standard",
      "Try a rejected direction",
      templatesRoot,
    );
    await assert.rejects(
      withdrawChange(root, "rejected-direction", "", "Not the right outcome"),
      /actor must not be empty/,
    );
    await assert.rejects(
      withdrawChange(root, "rejected-direction", "maintainer", ""),
      /reason must not be empty/,
    );

    const destination = await withdrawChange(
      root,
      "rejected-direction",
      "maintainer",
      "Conflicts with the canonical requirement",
      new Date("2026-08-17T10:30:00Z"),
    );
    assert.equal(existsSync(directory), false);
    assert.equal(destination, join(root, "specs", "archive", "2026-08-17-rejected-direction"));
    const metadata = JSON.parse(await readFile(join(destination, "change.json"), "utf8")) as ChangeMetadata;
    assert.equal(metadata.status, "withdrawn");
    assert.equal(metadata.archivedAt, "2026-08-17");
    assert.deepEqual(metadata.currentSpecs, []);
    assert.equal(metadata.currentSpecsUpdated, false);
    assert.deepEqual(metadata.withdrawal, {
      by: "maintainer",
      at: "2026-08-17T10:30:00.000Z",
      reason: "Conflicts with the canonical requirement",
    });

    const verified = await scaffoldChange(root, "verified-direction", "standard", "Verified", templatesRoot);
    const verifiedMetadata = JSON.parse(await readFile(join(verified, "change.json"), "utf8")) as ChangeMetadata;
    verifiedMetadata.status = "verified";
    await writeFile(join(verified, "change.json"), `${JSON.stringify(verifiedMetadata, null, 2)}\n`, "utf8");
    await assert.rejects(
      withdrawChange(root, "verified-direction", "maintainer", "Too late"),
      /with status verified cannot be withdrawn/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy schema-one packets without withdrawal metadata remain valid", async () => {
  const root = await temporaryRepository();
  try {
    const directory = await scaffoldChange(root, "legacy-packet", "standard", "Legacy packet", templatesRoot);
    const metadata = JSON.parse(await readFile(join(directory, "change.json"), "utf8")) as Record<string, unknown>;
    delete metadata["withdrawal"];
    await writeFile(join(directory, "change.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    assert.deepEqual(await validateChange(root, "legacy-packet", "structure"), []);
    const destination = await withdrawChange(
      root,
      "legacy-packet",
      "maintainer",
      "Superseded before implementation",
      new Date("2026-08-18T00:00:00Z"),
    );
    const withdrawn = JSON.parse(await readFile(join(destination, "change.json"), "utf8")) as ChangeMetadata;
    assert.equal(withdrawn.status, "withdrawn");
    assert.equal(withdrawn.withdrawal.reason, "Superseded before implementation");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("proposal and implementation gates expose ambiguity and missing approval", async () => {
  const root = await temporaryRepository();
  try {
    const directory = await scaffoldChange(root, "lifecycle-delta", "standard", "Durable lifecycle", templatesRoot);
    const metadata = JSON.parse(await readFile(join(directory, "change.json"), "utf8")) as ChangeMetadata;
    metadata.affectedRequirements = ["LIFE-01"];
    metadata.currentSpecs = ["../escaped.spec.md"];
    await writeFile(join(directory, "change.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

    const proposalErrors = await validateChange(root, "lifecycle-delta", "proposal");
    assert.ok(proposalErrors.some((error) => error.includes("current spec path must be")));
    assert.ok(proposalErrors.includes("proposal.md has unresolved clarification markers"));
    assert.ok(proposalErrors.includes("delta.md has unresolved clarification markers"));
    assert.ok(proposalErrors.includes("delta.md has no requirement block for LIFE-01"));

    const implementationErrors = await validateChange(root, "lifecycle-delta", "implementation");
    assert.ok(implementationErrors.includes("implementation requires approved, implementing, or verified status"));
    assert.ok(implementationErrors.includes("implementation requires recorded human approval"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("verified packet requires exact evidence and archives with current truth", async () => {
  const root = await temporaryRepository();
  try {
    const directory = await scaffoldChange(root, "durable-lifecycle", "standard", "Durable lifecycle", templatesRoot);
    const metadata = JSON.parse(await readFile(join(directory, "change.json"), "utf8")) as ChangeMetadata;
    metadata.status = "verified";
    metadata.affectedRequirements = ["LIFE-01"];
    metadata.currentSpecs = ["specs/current/lifecycle.spec.md"];
    metadata.currentSpecsUpdated = true;
    metadata.approval = { by: "maintainer", at: "2026-08-15T09:00:00Z" };
    await writeFile(join(directory, "change.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    await writeFile(
      join(directory, "proposal.md"),
      "# Proposal: Durable lifecycle\n\n## Outcome\n\nPublication is durable.\n\n## Context\n\nA race exists.\n\n## Scope\n\nAtomic publication.\n\n## Risks and rollback\n\nRetain the old format for rollback.\n\n## Validation plan\n\nExercise concurrent publication.\n",
      "utf8",
    );
    await writeFile(
      join(directory, "delta.md"),
      "# Specification delta\n\n## MODIFIED\n\n### Requirement: LIFE-01\n\nPublication is atomic.\n\n#### Scenario: Normal behavior\n\n- **Given:** one writer\n- **When:** it publishes\n- **Then:** the new head is complete\n\n#### Scenario: Failure behavior\n\n- **Given:** a failed write\n- **When:** recovery runs\n- **Then:** the old head remains complete\n\n#### Scenario: Concurrency boundary\n\n- **Given:** two writers\n- **When:** they publish the same expected head\n- **Then:** exactly one commits\n",
      "utf8",
    );
    await writeFile(
      join(directory, "tasks.md"),
      "# Tasks\n\n- [x] Approve.\n- [x] Test.\n- [x] Implement.\n- [x] Verify.\n- [x] Update current truth.\n",
      "utf8",
    );
    await writeFile(
      join(directory, "evidence.md"),
      "# Evidence\n\n## Requirement: LIFE-01\n\n- Validation: [NEEDS CLARIFICATION: user result]\n- Verification:\n- Result: pass\n- Evidence: [@test](../escaped.ts)\n",
      "utf8",
    );
    const unsafeEvidenceErrors = await validateChange(root, "durable-lifecycle", "archive");
    assert.ok(unsafeEvidenceErrors.includes("evidence.md has unresolved clarification markers"));
    assert.ok(unsafeEvidenceErrors.includes("evidence.md LIFE-01 has no verification result"));
    assert.ok(unsafeEvidenceErrors.includes("evidence path escapes the repository: ../escaped.ts"));

    await writeFile(
      join(directory, "evidence.md"),
      "# Evidence\n\n## Requirement: LIFE-01\n\n- Validation: concurrent authors keep a recoverable head\n- Verification: the deterministic race test admits one winner\n- Result: pass\n- Evidence: [@test](test/proof.test.ts)\n",
      "utf8",
    );
    await writeFile(
      join(root, "specs", "current", "lifecycle.spec.md"),
      "# Lifecycle\n\nLIFE-01 publication is atomic.\n",
      "utf8",
    );
    await writeFile(join(root, "test", "proof.test.ts"), "// retained verification evidence\n", "utf8");

    assert.deepEqual(await validateChange(root, "durable-lifecycle", "proposal"), []);
    assert.deepEqual(await validateChange(root, "durable-lifecycle", "implementation"), []);
    assert.deepEqual(await validateChange(root, "durable-lifecycle", "archive"), []);

    const destination = await archiveChange(root, "durable-lifecycle", new Date("2026-08-16T00:00:00Z"));
    assert.equal(existsSync(directory), false);
    assert.equal(destination, join(root, "specs", "archive", "2026-08-16-durable-lifecycle"));
    const archived = JSON.parse(await readFile(join(destination, "change.json"), "utf8")) as ChangeMetadata;
    assert.equal(archived.status, "archived");
    assert.equal(archived.archivedAt, "2026-08-16");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository workflow records and active packet structures validate", async () => {
  assert.deepEqual(await validateSpecRepository(repositoryRoot), []);
});
