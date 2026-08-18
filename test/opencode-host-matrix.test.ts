import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARTIFACT_TOOL_CONTRACT,
  OPENCODE_PERMISSION_POLICY,
  OPENCODE_HOST_INSTALL_FLAGS,
  assertArtifactToolContract,
  boundedLog,
  exactStableMatrix,
  packFilename,
  parseServerUrl,
  stableVersionFromNpm,
} from "../scripts/opencode-host-matrix.ts";

test("pack filename accepts npm array and keyed-object JSON while requiring one result", () => {
  assert.equal(packFilename([{ filename: "pkg-1.2.3.tgz" }]), "pkg-1.2.3.tgz");
  assert.equal(
    packFilename({ "pkg@1.2.3": { filename: "pkg-1.2.3.tgz" } }),
    "pkg-1.2.3.tgz",
  );
  assert.throws(() => packFilename([]), /exactly one npm pack result/);
  assert.throws(
    () => packFilename({ first: { filename: "a.tgz" }, second: { filename: "b.tgz" } }),
    /exactly one npm pack result/,
  );
  assert.throws(() => packFilename({ pkg: { filename: "" } }), /exactly one npm pack result/);
});

test("stable host matrix deduplicates identical exact current and oldest cells", () => {
  assert.deepEqual(exactStableMatrix("1.18.18", "1.18.18"), {
    versions: ["1.18.18"],
    deduplicated: true,
  });
  assert.deepEqual(exactStableMatrix("1.19.0", "1.18.18"), {
    versions: ["1.19.0", "1.18.18"],
    deduplicated: false,
  });
});

test("stable version accepts npm scalar and one-item array output only", () => {
  assert.equal(stableVersionFromNpm("1.18.18"), "1.18.18");
  assert.equal(stableVersionFromNpm(["1.18.18"]), "1.18.18");
  assert.throws(() => stableVersionFromNpm([]), /exactly one stable/);
  assert.throws(() => stableVersionFromNpm(["1.18.18", "1.19.0"]), /exactly one stable/);
  assert.throws(() => stableVersionFromNpm("next"), /exactly one stable/);
});

test("host installation suppresses ambient scripts before the matrix runs only OpenCode's exact bootstrap", () => {
  assert.deepEqual(OPENCODE_HOST_INSTALL_FLAGS, ["--ignore-scripts", "--no-audit", "--no-fund"]);
});

test("host discovery requires every shipped tool and documented property", () => {
  const ids = Object.keys(ARTIFACT_TOOL_CONTRACT);
  const tools = Object.entries(ARTIFACT_TOOL_CONTRACT).map(([id, properties]) => ({
    id,
    parameters: { properties: Object.fromEntries(properties.map((property) => [
      property,
      id === "artifact_lifecycle" && property === "op" ? { enum: ["list", "reopen"] } : {},
    ])) },
  }));
  assert.doesNotThrow(() => assertArtifactToolContract(ids, tools));
  assert.throws(
    () => assertArtifactToolContract(ids.filter((id) => id !== "artifact_lifecycle"), tools),
    /missing artifact_lifecycle/,
  );
  const missingSchema = structuredClone(tools);
  const publish = missingSchema.find((item) => item.id === "artifact_publish");
  assert.ok(publish);
  delete publish.parameters.properties.markdown;
  assert.throws(() => assertArtifactToolContract(ids, missingSchema), /artifact_publish schema is missing markdown/);
});

test("host startup parsing is loopback-only and logs stay bounded", () => {
  assert.equal(
    parseServerUrl("notice\nopencode server listening on http://127.0.0.1:49123\n"),
    "http://127.0.0.1:49123",
  );
  assert.equal(parseServerUrl("opencode server listening on http://0.0.0.0:49123"), undefined);
  const output = boundedLog("old", "x".repeat(200), 64);
  assert.ok(Buffer.byteLength(output, "utf8") <= 64);
  assert.match(output, /earlier output truncated/);
});

test("stable permission probe keeps explicit denies under broad auto allow", () => {
  assert.equal(OPENCODE_PERMISSION_POLICY["*"], "allow");
  assert.equal(OPENCODE_PERMISSION_POLICY.artifact_publish, "ask");
  assert.equal(OPENCODE_PERMISSION_POLICY.artifact_datasource, "ask");
  assert.equal(OPENCODE_PERMISSION_POLICY.artifact_deploy, "deny");
  assert.equal(OPENCODE_PERMISSION_POLICY.artifact_audience, "deny");
});
