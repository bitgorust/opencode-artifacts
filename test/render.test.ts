import { test } from "node:test";
import assert from "node:assert/strict";
import { ArtifactTooLargeError, renderArtifact, renderRawHtml } from "../src/render.ts";

const VEGA_LITE_CHART = [
  "```vega-lite",
  JSON.stringify({
    data: { values: [{ a: "A", b: 1 }] },
    mark: "bar",
    encoding: {
      x: { field: "a", type: "nominal" },
      y: { field: "b", type: "quantitative" },
    },
  }),
  "```",
].join("\n");

const ECHARTS_CHART = [
  "```echarts",
  JSON.stringify({
    xAxis: { type: "category", data: ["Mon", "Tue"] },
    yAxis: { type: "value" },
    series: [{ type: "line", data: [3, 5] }],
  }),
  "```",
].join("\n");

test("plain markdown artifact carries CSP and escaped title, no chart runtimes", () => {
  const { html, meta, chartCount } = renderArtifact("---\ntitle: My <b>Report</b>\n---\n# Hi\n");
  assert.equal(meta.title, "My <b>Report</b>");
  assert.equal(chartCount, 0);
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'"/);
  assert.match(html, /<title>My &lt;b&gt;Report&lt;\/b&gt;<\/title>/);
  assert.match(html, /<h1 id="hi">Hi<\/h1>/);
  assert.ok(!html.includes("runtime:vega"));
  assert.ok(!html.includes("runtime:echarts"));
});

test("vega-lite chart inlines vega runtimes and compiled spec", () => {
  const { html, chartCount } = renderArtifact(VEGA_LITE_CHART);
  assert.equal(chartCount, 1);
  assert.ok(html.includes("runtime:vega"));
  assert.ok(html.includes("runtime:vega-embed"));
  assert.ok(!html.includes("runtime:echarts"));
  assert.ok(html.includes("vegaEmbed("));
  assert.ok(html.includes("ast: true"), "vega must run in CSP-safe interpreter mode");
  assert.ok(html.includes('\\"a\\":\\"A\\"') || html.includes('"a":"A"'));
});

test("echarts chart inlines echarts runtime and option", () => {
  const { html } = renderArtifact(ECHARTS_CHART);
  assert.ok(html.includes("runtime:echarts"));
  assert.ok(html.includes("echarts.init"));
  assert.ok(!html.includes("runtime:vega"));
});

test("invalid chart spec becomes an inline error entry, page still ships", () => {
  const { html, chartCount } = renderArtifact("```vega-lite\n{not json\n```\n");
  assert.equal(chartCount, 1);
  assert.ok(html.includes('"error":"'));
  assert.ok(html.includes("chart-error"));
});

test("chart spec cannot break out of the script tag", () => {
  const evil = ["```echarts", JSON.stringify({ title: { text: "</script><script>alert(1)</script>" } }), "```"].join("\n");
  const { html } = renderArtifact(evil);
  assert.ok(!html.includes("</script><script>alert(1)</script>"));
  assert.ok(html.includes("\\u003c/script>"));
});

test("size cap throws ArtifactTooLargeError", () => {
  assert.throws(() => renderArtifact("# tiny", { maxBytes: 64 }), ArtifactTooLargeError);
});

test("every page carries an emoji favicon and a footer placeholder", () => {
  const { html } = renderArtifact("---\ntitle: T\nicon: 🚨\n---\nhi\n");
  assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/);
  assert.ok(html.includes("<!--artifact:footer-->"));
});

test("renderRawHtml embeds trusted html and keeps the CSP shell", () => {
  const { html, meta, chartCount } = renderRawHtml("<section><b>raw</b></section>", { title: "Raw" });
  assert.equal(meta.title, "Raw");
  assert.equal(chartCount, 0);
  assert.ok(html.includes("<section><b>raw</b></section>"));
  assert.match(html, /Content-Security-Policy/);
  assert.ok(!html.includes("runtime:vega"));
});
