import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidateProvenance,
  createLicenseInventory,
  licenseInventoryErrors,
  packCoordinate,
  PREVIEW_POSTPUBLISH_GATES,
  PREVIEW_PREPUBLISH_GATES,
  releaseCandidateGateFailures,
  releaseTransitionFailures,
  validateLicenseDispositions,
  verifyPublishedDistribution,
  verifyTagVersion,
  type ReleaseTransitionChecks,
} from "../scripts/release-integrity.ts";

test("license inventory reports missing and compound dispositions", () => {
  const inventory = createLicenseInventory({
    packages: {
      "": { license: "MIT" },
      "node_modules/a": { license: "MIT" },
      "node_modules/b": { license: "(MPL-2.0 OR Apache-2.0)" },
      "node_modules/c": {},
    },
  });
  assert.deepEqual(inventory.licenses, { MIT: 1, "(MPL-2.0 OR Apache-2.0)": 1, MISSING: 1 });
  assert.deepEqual(inventory.missingLicenseEntries, ["node_modules/c"]);
  assert.equal(inventory.reviewRequired.length, 1);
  assert.equal(licenseInventoryErrors(inventory).length, 2);
});

test("installed manifest metadata fills lockfile license omissions", () => {
  const inventory = createLicenseInventory(
    { packages: { "": { license: "MIT" }, "node_modules/a": { version: "1.0.0" } } },
    { "node_modules/a": "BSD-3-Clause" },
  );
  assert.deepEqual(inventory.licenses, { "BSD-3-Clause": 1 });
  assert.deepEqual(licenseInventoryErrors(inventory), []);
});

test("exact hash-bound license dispositions clear only their reviewed findings", () => {
  const lockfile = {
    packages: {
      "": { license: "MIT" },
      "node_modules/missing": { version: "1.0.0" },
      "node_modules/choice": { version: "2.0.0", license: "(MPL-2.0 OR Apache-2.0)" },
    },
  };
  const value = {
    schemaVersion: 1,
    reviewedAt: "2026-08-16",
    approvedBy: "maintainer",
    approvedAt: "2026-08-16T14:57:27Z",
    dispositions: [
      {
        path: "node_modules/missing",
        version: "1.0.0",
        declaredLicense: null,
        selectedLicense: "MIT",
        licenseFile: "node_modules/missing/LICENSE",
        sha256: "a".repeat(64),
      },
      {
        path: "node_modules/choice",
        version: "2.0.0",
        declaredLicense: "(MPL-2.0 OR Apache-2.0)",
        selectedLicense: "Apache-2.0",
        licenseFile: "node_modules/choice/LICENSE-APACHE",
        sha256: "b".repeat(64),
      },
    ],
  };
  const inventory = createLicenseInventory(lockfile);
  const validation = validateLicenseDispositions(lockfile, {}, value, {
    "node_modules/missing/LICENSE": "a".repeat(64),
    "node_modules/choice/LICENSE-APACHE": "b".repeat(64),
  });
  assert.deepEqual(validation.errors, []);
  assert.deepEqual([...validation.approvedPaths], ["node_modules/missing", "node_modules/choice"]);
  assert.deepEqual(licenseInventoryErrors(inventory, validation.approvedPaths), []);

  const changed = structuredClone(value);
  changed.dispositions[1].version = "2.0.1";
  changed.dispositions[1].selectedLicense = "GPL-3.0";
  changed.dispositions[1].sha256 = "c".repeat(64);
  const errors = validateLicenseDispositions(lockfile, {}, changed, {
    "node_modules/missing/LICENSE": "a".repeat(64),
    "node_modules/choice/LICENSE-APACHE": "b".repeat(64),
  }).errors.join("\n");
  assert.match(errors, /version does not match/);
  assert.match(errors, /selectedLicense is not a branch/);
  assert.match(errors, /sha256 does not match/);
});

test("release candidate property model blocks every failed constituent gate", () => {
  const passing = {
    audit: true,
    licenses: true,
    csp: true,
    offline: true,
    adversarialPayloads: true,
    compatibility: true,
    packedBytes: true,
  };
  assert.deepEqual(releaseCandidateGateFailures(passing), []);
  for (const name of Object.keys(passing) as Array<keyof typeof passing>) {
    assert.deepEqual(releaseCandidateGateFailures({ ...passing, [name]: false }), [name]);
  }
});

function previewChecks(): ReleaseTransitionChecks {
  return {
    hardGates: Object.fromEntries(
      [...PREVIEW_PREPUBLISH_GATES, ...PREVIEW_POSTPUBLISH_GATES].map((gate) => [gate, true]),
    ) as ReleaseTransitionChecks["hardGates"],
    previewLabel: true,
    unsupportedDisclosure: true,
    missingEvidenceVisible: true,
    certificationClaim: false,
    out02: "incomplete",
    out03: "incomplete",
    support: "unverified",
  };
}

test("public preview state machine permits visible missing certification evidence but no hard-gate failure", () => {
  const base = previewChecks();
  assert.deepEqual(releaseTransitionFailures("preview-candidate", base), []);
  assert.deepEqual(releaseTransitionFailures("public-preview", base), []);

  for (const gate of PREVIEW_PREPUBLISH_GATES) {
    const changed = structuredClone(base);
    changed.hardGates[gate] = false;
    assert.match(releaseTransitionFailures("preview-candidate", changed).join("\n"), new RegExp(gate));
    assert.match(releaseTransitionFailures("public-preview", changed).join("\n"), new RegExp(gate));
  }
  for (const gate of PREVIEW_POSTPUBLISH_GATES) {
    const changed = structuredClone(base);
    changed.hardGates[gate] = false;
    assert.deepEqual(releaseTransitionFailures("preview-candidate", changed), []);
    assert.match(releaseTransitionFailures("public-preview", changed).join("\n"), new RegExp(gate));
  }

  for (const field of ["previewLabel", "unsupportedDisclosure", "missingEvidenceVisible"] as const) {
    const changed = structuredClone(base);
    changed[field] = false;
    assert.notDeepEqual(releaseTransitionFailures("preview-candidate", changed), []);
  }
  const inflated = structuredClone(base);
  inflated.certificationClaim = true;
  assert.match(releaseTransitionFailures("public-preview", inflated).join("\n"), /cannot claim certification/);
});

test("certification never inherits a public-preview waiver", () => {
  const preview = previewChecks();
  const failures = releaseTransitionFailures("certified-local-core", preview).join("\n");
  assert.match(failures, /preview label/);
  assert.match(failures, /unsupported status/);
  assert.match(failures, /must claim its exact certified level/);
  assert.match(failures, /out02/);
  assert.match(failures, /out03/);
  assert.match(failures, /support/);

  const certified = structuredClone(preview);
  certified.previewLabel = false;
  certified.unsupportedDisclosure = false;
  certified.missingEvidenceVisible = false;
  certified.certificationClaim = true;
  certified.out02 = "pass";
  certified.out03 = "pass";
  certified.support = "pass";
  assert.deepEqual(releaseTransitionFailures("certified-local-core", certified), []);
});

test("release tag must match the coordinated package version", () => {
  assert.deepEqual(verifyTagVersion({ version: "0.14.4" }, "v0.14.4"), []);
  assert.match(verifyTagVersion({ version: "0.14.4" }, "v0.14.5").join("\n"), /does not match/);
  assert.match(verifyTagVersion({}, "v0.14.4").join("\n"), /must contain a version/);
});

test("pack coordinate binds filename, hashes, package name, and version", () => {
  assert.deepEqual(
    packCoordinate(
      [{ filename: "pkg-1.2.3.tgz", integrity: "sha512-abc", shasum: "def" }],
      { name: "pkg", version: "1.2.3" },
    ),
    {
      filename: "pkg-1.2.3.tgz",
      integrity: "sha512-abc",
      shasum: "def",
      packageSpec: "pkg@1.2.3",
    },
  );
  assert.deepEqual(
    packCoordinate(
      { pkg: { filename: "pkg-1.2.3.tgz", integrity: "sha512-abc", shasum: "def" } },
      { name: "pkg", version: "1.2.3" },
    ),
    {
      filename: "pkg-1.2.3.tgz",
      integrity: "sha512-abc",
      shasum: "def",
      packageSpec: "pkg@1.2.3",
    },
  );
});

test("candidate provenance binds exact tarball bytes, commit, workflow, and run", () => {
  const value = candidateProvenance(
    [{ filename: "pkg-1.2.3.tgz", integrity: "sha512-abc", shasum: "def" }],
    { name: "pkg", version: "1.2.3" },
    "a".repeat(64),
    {
      repository: "owner/repo",
      commit: "b".repeat(40),
      workflowRef: "owner/repo/.github/workflows/ci.yml@refs/pull/1/merge",
      runId: "123",
      runAttempt: "2",
      serverUrl: "https://github.com",
    },
  );
  assert.deepEqual(value["subject"], [{ name: "pkg-1.2.3.tgz", digest: { sha256: "a".repeat(64) } }]);
  assert.equal(value["predicateType"], "https://slsa.dev/provenance/v1");
  assert.match(JSON.stringify(value), /owner\/repo\/actions\/runs\/123\/attempts\/2/);
  assert.throws(
    () => candidateProvenance(
      [{ filename: "pkg.tgz", integrity: "sha512-abc", shasum: "def" }],
      { name: "pkg", version: "1.2.3" },
      "bad",
      { repository: "", commit: "", workflowRef: "", runId: "", runAttempt: "", serverUrl: "" },
    ),
    /SHA-256/,
  );
});

test("registry verification requires matching bytes, signature, and provenance", () => {
  const pack = { integrity: "sha512-abc", shasum: "def" };
  assert.deepEqual(
    verifyPublishedDistribution(pack, {
      ...pack,
      attestations: { provenance: { predicateType: "https://slsa.dev/provenance/v1" } },
      signatures: [{ keyid: "key", sig: "signature" }],
    }),
    [],
  );
  assert.deepEqual(
    verifyPublishedDistribution(pack, { integrity: "wrong", shasum: "def", signatures: [] }),
    [
      "registry integrity does not match the packed bytes",
      "registry provenance attestation is missing",
      "registry package signature is missing",
    ],
  );
});
