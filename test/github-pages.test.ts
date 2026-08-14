import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitHubPagesPublisher, pagesBaseUrl, type Runner } from "../src/github-pages.ts";

function fakeRunner(calls: string[], options: { cloneFailsOnce?: boolean } = {}): Runner {
  let cloneAttempts = 0;
  return async (command, args) => {
    calls.push(`${command} ${args.join(" ")}`);
    if (args[0] === "repo" && args[1] === "clone") {
      cloneAttempts++;
      if (options.cloneFailsOnce && cloneAttempts === 1) {
        throw new Error("GraphQL: Could not resolve to a Repository");
      }
    }
    if (command === "git" && args.includes("status")) return "M index.html\n";
    return "";
  };
}

test("pagesBaseUrl handles project and user sites", () => {
  assert.equal(pagesBaseUrl("bitgorust/artifacts"), "https://bitgorust.github.io/artifacts/");
  assert.equal(pagesBaseUrl("bitgorust/bitgorust.github.io"), "https://bitgorust.github.io/");
});

test("publish syncs artifacts to the clone, commits, pushes, and returns the public url", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ghpages-"));
  const cloneDir = join(dir, "clone");
  const localDir = join(dir, "local");
  await mkdir(join(cloneDir, ".git"), { recursive: true });
  await mkdir(join(localDir, ".state"), { recursive: true });
  await writeFile(join(localDir, ".state", "secret.json"), "{}");

  const calls: string[] = [];
  const publisher = new GitHubPagesPublisher(localDir, {
    repo: "bitgorust/artifacts",
    cloneDir,
    runner: fakeRunner(calls),
  });

  const result = await publisher.publish({ slug: "demo", html: "<h1>hi</h1>", title: "Demo" });

  assert.equal(result.url, "https://bitgorust.github.io/artifacts/demo.html");
  assert.ok(calls.some((c) => c.includes("add -A")));
  assert.ok(calls.some((c) => c.includes("commit -m publish demo v1")));
  assert.ok(calls.some((c) => c.includes("push origin HEAD:main")));
  assert.ok(calls.some((c) => c.includes("api repos/bitgorust/artifacts/pages")));

  assert.match(await readFile(join(cloneDir, "demo.html"), "utf8"), /<h1>hi<\/h1>/);
  assert.match(await readFile(join(cloneDir, "index.html"), "utf8"), /Demo/);
  await rm(dir, { recursive: true, force: true });
});

test("local state directories are never published", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ghpages-"));
  const cloneDir = join(dir, "clone");
  const localDir = join(dir, "local");
  await mkdir(join(cloneDir, ".git"), { recursive: true });
  await mkdir(join(localDir, ".state"), { recursive: true });
  await mkdir(join(localDir, ".db"), { recursive: true });
  await writeFile(join(localDir, ".state", "answers.json"), "{}");
  await writeFile(join(localDir, ".db", "x.json"), "{}");

  const publisher = new GitHubPagesPublisher(localDir, {
    repo: "bitgorust/artifacts",
    cloneDir,
    runner: fakeRunner([]),
  });
  await publisher.publish({ slug: "demo", html: "x" });

  await assert.rejects(readFile(join(cloneDir, ".state", "answers.json"), "utf8"));
  await assert.rejects(readFile(join(cloneDir, ".db", "x.json"), "utf8"));
  await rm(dir, { recursive: true, force: true });
});

test("a missing repo is created then cloned", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ghpages-"));
  const calls: string[] = [];
  const publisher = new GitHubPagesPublisher(join(dir, "local"), {
    repo: "bitgorust/artifacts",
    cloneDir: join(dir, "clone"),
    runner: fakeRunner(calls, { cloneFailsOnce: true }),
  });
  await publisher.publish({ slug: "demo", html: "x" });
  const create = calls.findIndex((c) => c.includes("repo create bitgorust/artifacts --public"));
  const clones = calls.flatMap((c, i) => (c.includes("repo clone") ? [i] : []));
  assert.ok(create > -1, "repo create was called");
  assert.ok(clones.length === 2 && clones[1] > create, "clone retried after create");
  await rm(dir, { recursive: true, force: true });
});
