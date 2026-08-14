import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument } from "../src/markdown.ts";

test("parses frontmatter title and icon", () => {
  const doc = parseDocument("---\ntitle: Deploy Report\nicon: 📊\n---\n# Hello\n");
  assert.equal(doc.meta.title, "Deploy Report");
  assert.equal(doc.meta.icon, "📊");
  assert.match(doc.bodyHtml, /<h1>Hello<\/h1>/);
});

test("missing frontmatter leaves meta empty and warns about nothing", () => {
  const doc = parseDocument("# Hello\n");
  assert.deepEqual(doc.meta, {});
  assert.equal(doc.warnings.length, 0);
});

test("malformed frontmatter lines warn but never throw", () => {
  const doc = parseDocument("---\nnot a kv line\ntitle: X\n---\nbody\n");
  assert.equal(doc.meta.title, "X");
  assert.equal(doc.warnings.length, 1);
});

test("chart fences become placeholders in document order", () => {
  const src = [
    "```vega-lite",
    '{"mark":"bar"}',
    "```",
    "some text",
    "```echarts",
    '{"series":[]}',
    "```",
  ].join("\n");
  const doc = parseDocument(src);
  assert.equal(doc.charts.length, 2);
  assert.equal(doc.charts[0].kind, "vega-lite");
  assert.equal(doc.charts[0].json, '{"mark":"bar"}\n');
  assert.equal(doc.charts[1].kind, "echarts");
  assert.match(doc.bodyHtml, /<div class="chart" data-chart-index="0"><\/div>/);
  assert.match(doc.bodyHtml, /<div class="chart" data-chart-index="1"><\/div>/);
});

test("raw html in prose is escaped, never passed through", () => {
  const doc = parseDocument('hello <script>alert("x")</script> world\n');
  assert.ok(!doc.bodyHtml.includes('<script>alert'));
  assert.match(doc.bodyHtml, /&lt;script&gt;/);
});

test("unknown fence renders as an escaped code block", () => {
  const doc = parseDocument("```python\nprint('<b>hi</b>')\n```\n");
  assert.match(doc.bodyHtml, /<pre><code class="language-python">/);
  assert.match(doc.bodyHtml, /&lt;b&gt;/);
  assert.equal(doc.charts.length, 0);
});
