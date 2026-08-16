import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLicenseInventory,
  licenseInventoryErrors,
  packCoordinate,
  verifyPublishedDistribution,
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
