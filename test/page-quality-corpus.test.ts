import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { PAGE_QUALITY_TASK_IDS, validatePageQualityCorpus } from "../scripts/page-quality-corpus.ts";
import { preflightDocument } from "../src/preflight.ts";

const root = resolve(import.meta.dirname, "..");
const corpusPath = join(root, "benchmarks/page-quality/v1/corpus.json");

interface CorpusFixture {
  id: string;
  fixture: string;
}

interface CorpusDocument {
  bundles: CorpusFixture[];
}

async function corpus(): Promise<CorpusDocument> {
  return JSON.parse(await readFile(corpusPath, "utf8")) as CorpusDocument;
}

test("canonical page-quality corpus binds eight permission-safe fixtures", async () => {
  const result = await validatePageQualityCorpus(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.corpusId, "page-quality-v1");
  assert.equal(result.bundleCount, 8);
  assert.deepEqual((await corpus()).bundles.map((bundle) => bundle.id), PAGE_QUALITY_TASK_IDS);
});

test("every normalized corpus fixture passes real authoring preflight", async () => {
  for (const bundle of (await corpus()).bundles) {
    const markdown = await readFile(join(root, bundle.fixture), "utf8");
    const result = await preflightDocument(markdown, { worktreeRoot: root });
    assert.deepEqual(
      result.diagnostics.filter((item) => item.severity === "error"),
      [],
      bundle.id,
    );
  }
});

test("corpus validation rejects changed fixture bytes and incomplete stress cases", async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), "page-quality-corpus-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const document = await corpus();
  for (const bundle of document.bundles) {
    const destination = join(temporary, bundle.fixture);
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(root, bundle.fixture), destination);
  }
  const mutable = JSON.parse(await readFile(corpusPath, "utf8")) as { bundles: Array<Record<string, unknown>> };
  mutable.bundles[0]!["stressCases"] = ["narrow-viewport"];
  await mkdir(join(temporary, "benchmarks/page-quality/v1"), { recursive: true });
  await writeFile(join(temporary, "benchmarks/page-quality/v1/corpus.json"), JSON.stringify(mutable));
  await writeFile(join(temporary, document.bundles[0]!.fixture), "changed bytes");
  const result = await validatePageQualityCorpus(temporary);
  assert.match(result.errors.join("\n"), /canonical stress case/);
  assert.match(result.errors.join("\n"), /fixtureSha256 does not match/);
});
