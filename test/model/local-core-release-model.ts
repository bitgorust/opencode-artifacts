import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  certificationFailures,
  transitionCertification,
  validateCertificationRecord,
} from "../../scripts/local-core-certification-lib.ts";

const template = JSON.parse(await readFile(new URL("../../docs/evidence/releases/local-core-certification.template.json", import.meta.url), "utf8")) as Record<string, unknown>;

function passingRecord(): Record<string, unknown> {
  const value = structuredClone(template);
  const digest = "a".repeat(64);
  value["candidate"] = {
    status: "frozen",
    commit: "b".repeat(40),
    version: "0.15.0",
    tarball: "opencode-artifacts-0.15.0.tgz",
    sha256: digest,
    sri: `sha512-${"A".repeat(86)}==`,
    corpusVersions: { pageQuality: "page-quality-v1", journey: 1 },
  };
  value["requirements"] = (value["requirements"] as Record<string, unknown>[]).map((row) => ({
    ...row,
    status: "pass",
    evidence: [{
      path: `synthetic/${row["id"]}.json`,
      date: "2026-08-18",
      owner: "synthetic-model-test",
      result: "pass",
      candidateSha256: digest,
      scope: "Synthetic model test only; not release evidence.",
      environment: "deterministic test",
    }],
  }));
  value["signoffs"] = (value["signoffs"] as Record<string, unknown>[]).map((signoff) => ({ ...signoff, status: "approved", by: "synthetic-model-test", at: "2026-08-18T16:00:00Z" }));
  value["blockers"] = [];
  value["claims"] = { certification: true, equalOrBetter: true, supportedPlatformIds: ["synthetic-platform"] };
  return value;
}

test("checked-in certification template is valid and fail-closed", () => {
  assert.deepEqual(validateCertificationRecord(template), []);
  const failures = certificationFailures(template).join("\n");
  assert.match(failures, /candidate is not frozen/);
  assert.match(failures, /page-quality/);
  assert.match(failures, /first-use/);
  assert.match(failures, /support/);
  assert.match(failures, /unresolved blockers/);
});

test("certified is reachable only from one complete immutable candidate", () => {
  const value = passingRecord();
  assert.deepEqual(validateCertificationRecord(value), []);
  assert.deepEqual(certificationFailures(value), []);
  const before = structuredClone(value);
  assert.deepEqual(transitionCertification(value, "certified"), { decision: "certified", failures: [], providerMutations: 0 });
  assert.deepEqual(value, before);
});

test("every certification constituent independently prevents the transition", () => {
  const mutations: Array<(value: Record<string, unknown>) => void> = [
    (value) => { value["candidate"] = structuredClone(template["candidate"]); },
    (value) => { ((value["requirements"] as Record<string, unknown>[])[0] as Record<string, unknown>)["status"] = "pending"; },
    (value) => { ((value["signoffs"] as Record<string, unknown>[])[0] as Record<string, unknown>)["status"] = "pending"; ((value["signoffs"] as Record<string, unknown>[])[0] as Record<string, unknown>)["by"] = null; ((value["signoffs"] as Record<string, unknown>[])[0] as Record<string, unknown>)["at"] = null; },
    (value) => { value["blockers"] = ["synthetic blocker"]; },
    (value) => { (value["claims"] as Record<string, unknown>)["certification"] = false; },
    (value) => { (value["claims"] as Record<string, unknown>)["equalOrBetter"] = false; },
    (value) => { (value["claims"] as Record<string, unknown>)["supportedPlatformIds"] = []; },
  ];
  for (const mutate of mutations) {
    const value = passingRecord();
    mutate(value);
    const result = transitionCertification(value, "certified");
    assert.equal(result.decision, "refused");
    assert.ok(result.failures.length > 0);
    assert.equal(result.providerMutations, 0);
  }
});

test("cross-candidate evidence and not-applicable waivers are rejected", () => {
  const mismatch = passingRecord();
  const evidence = ((mismatch["requirements"] as Record<string, unknown>[])[0]?.["evidence"] as Record<string, unknown>[])[0];
  assert.ok(evidence);
  evidence["candidateSha256"] = "c".repeat(64);
  assert.match(certificationFailures(mismatch).join("\n"), /evidence candidate mismatch/);

  const waived = passingRecord();
  const row = (waived["requirements"] as Record<string, unknown>[])[0];
  assert.ok(row);
  row["status"] = "not-applicable";
  row["applicabilityReason"] = "Synthetic attempted waiver";
  assert.match(validateCertificationRecord(waived).join("\n"), /cannot be not-applicable/);
});
