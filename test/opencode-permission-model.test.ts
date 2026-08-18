import assert from "node:assert/strict";
import { test } from "node:test";
import {
  evaluatePermissionModel,
  type ModelPermission,
} from "./model/opencode-permission-model.ts";

test("permission model requires every requested scope before mutation", () => {
  for (const datasource of [false, true]) {
    for (const deploy of [false, true]) {
      const allowed = evaluatePermissionModel({ datasource, deploy, decisions: {}, autoAllow: true });
      assert.equal(allowed.canMutate, true);
      for (const denied of allowed.requested) {
        const decisions = Object.fromEntries(
          allowed.requested.map((permission) => [permission, permission === denied ? "deny" : "allow"]),
        ) as Record<ModelPermission, "allow" | "deny">;
        const result = evaluatePermissionModel({ datasource, deploy, decisions, autoAllow: true });
        assert.equal(result.canMutate, false);
        assert.equal(result.denied, denied);
        assert.deepEqual(result.reached, allowed.requested.slice(0, allowed.requested.indexOf(denied) + 1));
      }
    }
  }
});

test("explicit deny remains effective under broad auto allow", () => {
  const result = evaluatePermissionModel({
    datasource: true,
    deploy: true,
    decisions: { artifact_deploy: "deny" },
    autoAllow: true,
  });
  assert.equal(result.canMutate, false);
  assert.equal(result.denied, "artifact_deploy");
  assert.deepEqual(result.reached, ["artifact_publish", "artifact_datasource", "artifact_deploy"]);
});
