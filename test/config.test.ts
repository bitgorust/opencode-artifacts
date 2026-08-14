import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  globalConfigPath,
  loadConfig,
  projectConfigPath,
  resolveDeploy,
  saveConfig,
} from "../src/config.ts";

test("project config wins over global, missing files yield empty config", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cfg-"));
  try {
    assert.deepEqual(await loadConfig(dir), {});
    await saveConfig(projectConfigPath(dir), { deploy: { target: "github", repo: "a/b" } });
    assert.equal((await loadConfig(dir)).deploy?.repo, "a/b");
    assert.ok(globalConfigPath().includes("opencode-artifacts"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("resolveDeploy prefers explicit args, then configured defaults", () => {
  assert.deepEqual(resolveDeploy({ repo: "x/y" }, {}), {
    target: "github",
    repo: "x/y",
    branch: undefined,
  });

  assert.deepEqual(resolveDeploy({}, { deploy: { target: "github", repo: "cfg/repo" } }), {
    target: "github",
    repo: "cfg/repo",
    branch: undefined,
  });

  assert.deepEqual(
    resolveDeploy({ target: "cloudflare" }, { deploy: { target: "cloudflare", workerName: "w" } }),
    { target: "cloudflare", workerName: "w" },
  );

  assert.throws(() => resolveDeploy({}, {}), /opencode-artifacts init/);
});

test("saved config file is valid and re-loadable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cfg-"));
  const path = join(dir, "nested", "config.json");
  try {
    await saveConfig(path, { deploy: { target: "cloudflare", workerName: "my-artifacts" } });
    const raw = JSON.parse(await readFile(path, "utf8")) as { deploy: { target: string } };
    assert.equal(raw.deploy.target, "cloudflare");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
