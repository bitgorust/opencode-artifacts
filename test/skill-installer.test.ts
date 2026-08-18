import assert from "node:assert/strict";
import { test } from "node:test";
import { cp, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUNDLED_SKILL_FILES,
  bundledSkillSource,
  installBundledSkill,
  skillDestination,
} from "../src/skill-installer.ts";

async function temporaryRoot(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix));
}

test("project skill installation is packed-byte complete and idempotent", async () => {
  const root = await temporaryRoot("skill-project-");
  const source = join(root, "packed", "artifact-pages");
  const project = join(root, "project");
  try {
    await cp(bundledSkillSource(), source, { recursive: true });
    await mkdir(project, { recursive: true });
    const first = await installBundledSkill({ scope: "project", projectRoot: project, sourceRoot: source });
    assert.equal(first.status, "installed");
    assert.equal(first.destination, join(project, ".opencode", "skills", "artifact-pages"));
    assert.deepEqual(first.files, [...BUNDLED_SKILL_FILES]);
    const second = await installBundledSkill({ scope: "project", projectRoot: project, sourceRoot: source });
    assert.equal(second.status, "unchanged");
    assert.equal(second.digest, first.digest);
    await rm(join(root, "packed"), { recursive: true, force: true });
    for (const file of BUNDLED_SKILL_FILES) {
      assert.ok((await readFile(join(first.destination, ...file.split("/")))).length > 0);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("global install uses the official OpenCode config skill directory", async () => {
  const home = await temporaryRoot("skill-global-");
  try {
    const result = await installBundledSkill({ scope: "global", homeRoot: home });
    assert.equal(result.destination, join(home, ".config", "opencode", "skills", "artifact-pages"));
    assert.equal(result.destination, skillDestination({ scope: "global", homeRoot: home }));
    assert.equal(result.status, "installed");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("differing skills are preserved unless force names the exact directory", async () => {
  const project = await temporaryRoot("skill-collision-");
  try {
    const installed = await installBundledSkill({ scope: "project", projectRoot: project });
    const skillFile = join(installed.destination, "SKILL.md");
    await writeFile(skillFile, "user customization\n", "utf8");
    await assert.rejects(
      installBundledSkill({ scope: "project", projectRoot: project }),
      /left unchanged/,
    );
    assert.equal(await readFile(skillFile, "utf8"), "user customization\n");
    await assert.rejects(
      installBundledSkill({ scope: "project", projectRoot: project, forceDestination: join(project, "wrong") }),
      /left unchanged/,
    );
    const replaced = await installBundledSkill({
      scope: "project",
      projectRoot: project,
      forceDestination: installed.destination,
    });
    assert.equal(replaced.status, "replaced");
    assert.ok(replaced.backup);
    assert.equal(await readFile(join(replaced.backup, "SKILL.md"), "utf8"), "user customization\n");
    assert.match(await readFile(skillFile, "utf8"), /^---\nname: artifact-pages/m);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("destination and parent symlinks are refused even with force", async (context) => {
  if (process.platform === "win32") {
    context.skip("symlink creation requires platform-specific privileges on Windows");
    return;
  }
  const root = await temporaryRoot("skill-symlink-");
  try {
    const project = join(root, "project");
    const outside = join(root, "outside");
    await mkdir(join(project, ".opencode", "skills"), { recursive: true });
    await mkdir(outside, { recursive: true });
    const destination = join(project, ".opencode", "skills", "artifact-pages");
    await symlink(outside, destination, "dir");
    await assert.rejects(
      installBundledSkill({ scope: "project", projectRoot: project, forceDestination: destination }),
      /destination is unsafe/,
    );
    assert.equal((await readdirNames(outside)).length, 0);

    const second = join(root, "second");
    await mkdir(join(second, ".opencode"), { recursive: true });
    await symlink(outside, join(second, ".opencode", "skills"), "dir");
    await assert.rejects(
      installBundledSkill({ scope: "project", projectRoot: second }),
      /parent is unsafe/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function readdirNames(path: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  return await readdir(path);
}

test("missing or unexpected packed inventory creates no partial destination", async () => {
  const root = await temporaryRoot("skill-inventory-");
  const source = join(root, "source");
  const project = join(root, "project");
  try {
    await cp(bundledSkillSource(), source, { recursive: true });
    await writeFile(join(source, "unexpected.md"), "unexpected", "utf8");
    await mkdir(project, { recursive: true });
    await assert.rejects(
      installBundledSkill({ scope: "project", projectRoot: project, sourceRoot: source }),
      /inventory differs/,
    );
    await assert.rejects(lstat(skillDestination({ scope: "project", projectRoot: project })));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("bundled skill carries official bounded discovery frontmatter", async () => {
  const body = await readFile(join(bundledSkillSource(), "SKILL.md"), "utf8");
  const frontmatter = body.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
  assert.match(frontmatter, /^name: artifact-pages$/m);
  const description = frontmatter.match(/^description: (.+)$/m)?.[1] ?? "";
  assert.ok(description.length > 20 && description.length <= 1024);
  assert.doesNotMatch(frontmatter, /<script|\{\{/i);
});
