import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as vega from "vega";
import { expressionInterpreter } from "vega-interpreter";
import { buildTooltipMarkup, TooltipMarkupStyleCreator } from "../node_modules/echarts/lib/component/tooltip/tooltipMarkup.js";
import { renderArtifact } from "../src/render.ts";

const ECHARTS_TOOLTIP_PAYLOAD = '<img src=x onerror="globalThis.__echartsXss=true">';
const VEGA_GLOBAL_GADGET = "({toString:event.view.VEGA_DEBUG.vega.CanvasHandler.prototype.on,eventName:event.view.console.log,_handlers:{undefined:'alert(origin)'},_handlerIndex:event.view.eval})+1";
const VEGA_SETDATA_PAYLOAD = "setdata('table',[['cookies: '+event.dataflow._el.ownerDocument.cookie]])+warn('XSS',modify('table',2,3,null,event.dataflow._el.ownerDocument.defaultView.alert,{'x':'y'}))";

async function installedVersion(name: string): Promise<string> {
  const value = JSON.parse(await readFile(new URL(`../node_modules/${name}/package.json`, import.meta.url), "utf8")) as unknown;
  if (typeof value !== "object" || value === null || !("version" in value) || typeof value.version !== "string") {
    throw new Error(`${name} has no installed version`);
  }
  return value.version;
}

async function markdownFiles(directory: URL): Promise<URL[]> {
  const files: URL[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) files.push(...await markdownFiles(child));
    else if (entry.name.endsWith(".md")) files.push(child);
  }
  return files;
}

test("renderer dependency family is on the approved patched versions", async () => {
  assert.deepEqual(
    await Promise.all(["echarts", "vega", "vega-lite", "vega-embed", "vega-functions", "vega-interpreter"].map(installedVersion)),
    ["6.1.0", "6.4.0", "6.4.3", "7.1.0", "6.2.0", "2.3.2"],
  );
});

test("every canonical example resolves under the upgraded renderer family", async () => {
  const examples = await markdownFiles(new URL("../examples/", import.meta.url));
  assert.ok(examples.length >= 10);
  let vegaExamples = 0;
  let echartsExamples = 0;
  for (const file of examples) {
    const markdown = await readFile(file, "utf8");
    const rendered = renderArtifact(markdown);
    const expectedInlineError = file.pathname.endsWith("/examples/incident-report.md");
    assert.equal(
      rendered.html.includes('"error":"'),
      expectedInlineError,
      `${file.pathname} had an unexpected chart-error disposition`,
    );
    if (markdown.includes("```vega-lite") || markdown.includes("```vega\n")) {
      vegaExamples++;
      assert.ok(rendered.html.includes("runtime:vega"), `${file.pathname} omitted Vega`);
    }
    if (markdown.includes("```echarts")) {
      echartsExamples++;
      assert.ok(rendered.html.includes("runtime:echarts"), `${file.pathname} omitted ECharts`);
    }
  }
  assert.ok(vegaExamples >= 4);
  assert.ok(echartsExamples >= 3);
});

test("ECharts built-in HTML tooltip markup encodes attacker-controlled names and values", () => {
  const markup = buildTooltipMarkup(
    {
      type: "section",
      header: ECHARTS_TOOLTIP_PAYLOAD,
      blocks: [{ type: "nameValue", name: ECHARTS_TOOLTIP_PAYLOAD, value: ECHARTS_TOOLTIP_PAYLOAD, noMarker: true }],
    },
    new TooltipMarkupStyleCreator(),
    "html",
    undefined,
    false,
    {},
  );
  assert.equal(typeof markup, "string");
  assert.ok(!markup.includes("<img"));
  assert.match(markup, /&lt;img/);
  assert.match(markup, /&gt;/);
});

test("Vega uses the AST interpreter without constructing executable source", async () => {
  const runtime = vega.parse(
    {
      signals: [{ name: "answer", value: 1, update: "answer + 1" }],
      marks: [],
    },
    null,
    { ast: true },
  );
  const original = Object.getOwnPropertyDescriptor(globalThis, "Function");
  let constructorCalls = 0;
  Object.defineProperty(globalThis, "Function", {
    configurable: true,
    writable: true,
    value: () => {
      constructorCalls++;
      throw new Error("Function constructor is forbidden");
    },
  });
  try {
    const view = new vega.View(runtime, { expr: expressionInterpreter, renderer: "none" });
    await view.runAsync();
    assert.equal(view.signal("answer"), 2);
    view.finalize();
  } finally {
    if (original) Object.defineProperty(globalThis, "Function", original);
  }
  assert.equal(constructorCalls, 0);
});

test("advisory payloads stay data in the page and the app exposes no Vega View global", () => {
  const markdown = [
    "```vega",
    JSON.stringify({
      description: "The security fixture contains one category with one amount.",
      data: [{ name: "table", values: [{ category: "A", amount: 28 }] }],
      signals: [
        { name: "gadget", value: null, on: [{ events: { type: "mousemove", source: "window" }, update: VEGA_GLOBAL_GADGET }] },
        { name: "setdata", value: null, on: [{ events: { type: "timer", throttle: 2000 }, update: VEGA_SETDATA_PAYLOAD }] },
      ],
    }),
    "```",
    "```echarts",
    JSON.stringify({
      description: "The security fixture retains hostile series labels as inert data.",
      tooltip: {},
      xAxis: {},
      yAxis: {},
      series: [{ type: "lines", data: [{ name: ECHARTS_TOOLTIP_PAYLOAD, coords: [[0, 0], [1, 1]] }] }],
    }),
    "```",
  ].join("\n");
  const { html } = renderArtifact(markdown);
  assert.ok(html.includes("ast: true"));
  assert.ok(html.includes("Promise.resolve(window.vegaEmbed"));
  assert.ok(!html.includes("window.VEGA_DEBUG="));
  assert.ok(!html.includes("__ARTIFACT_VEGA_VIEW__"));
  assert.ok(!html.includes("<img src=x onerror="));
  assert.ok(html.includes("\\u003cimg src=x onerror="));
});
