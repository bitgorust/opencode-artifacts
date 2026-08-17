import { test } from "node:test";
import assert from "node:assert/strict";
import { renderComponent } from "../src/components.ts";
import { renderArtifact } from "../src/render.ts";

test("stats renders value, label, and toned delta pill; text is escaped", () => {
  const html = renderComponent(
    "stats",
    JSON.stringify([
      { label: "FAILURES", value: "61", delta: "18.0%", direction: "up", tone: "bad", emphasis: true },
      { label: "X <b>", value: "1" },
    ]),
  );
  assert.match(html, /stat-grid/);
  assert.match(html, /stat-value">61<\/div>/);
  assert.match(html, /▲ 18\.0%/);
  assert.match(html, /delta-bad/);
  assert.match(html, /stat-emphasis/);
  assert.ok(html.includes("X &lt;b&gt;"));
});

test("timeline renders dots, times, and details in order", () => {
  const html = renderComponent(
    "timeline",
    JSON.stringify([
      { time: "13:54", title: "Alert fires", tone: "bad" },
      { time: "14:32", title: "Mitigated", detail: "p99 < 400ms", tone: "good" },
    ]),
  );
  assert.match(html, /tl-dot dot-bad/);
  assert.match(html, /tl-dot dot-good/);
  assert.ok(html.indexOf("Alert fires") < html.indexOf("Mitigated"));
  assert.match(html, /p99 &lt; 400ms/);
});

test("findings renders severity pills and mono locations", () => {
  const html = renderComponent(
    "findings",
    JSON.stringify([
      { severity: "high", title: "TTL dropped", location: "config/cache.ts:14", detail: "60x" },
    ]),
  );
  assert.match(html, /sev sev-high">HIGH</);
  assert.match(html, /finding-loc">config\/cache\.ts:14</);
});

test("compare renders variant cards with pill, numbered annotations, and tradeoff", () => {
  const html = renderComponent(
    "compare",
    JSON.stringify([
      { title: "B — Tabs", pill: "info", annotations: ["one", "two"], tradeoff: "hides settings" },
    ]),
  );
  assert.match(html, /compare-grid/);
  assert.match(html, /pill pill-info">B — Tabs</);
  assert.match(html, /class="annotations"/);
  assert.match(html, /tradeoff">hides settings/);
});

test("callout renders toned insight card", () => {
  const html = renderComponent("callout", JSON.stringify({ tone: "warn", title: "T", body: "B" }));
  assert.match(html, /callout callout-warn/);
  assert.match(html, /callout-title">T</);
});

test("progress renders a fill proportional to done/total", () => {
  const html = renderComponent("progress", JSON.stringify({ label: "Ready", done: 3, total: 4 }));
  assert.match(html, /Ready — 3\/4/);
  assert.match(html, /width:75%/);
});

test("diff renders add/del/note lines with escaping", () => {
  const html = renderComponent("diff", "+added\n-removed\n## note: watch <this>\n context");
  assert.match(html, /dl-add">\+added/);
  assert.match(html, /dl-del">-removed/);
  assert.match(html, /dl-note">watch &lt;this&gt;/);
  assert.match(html, /dl-ctx"> context/);
});

test("malformed component JSON becomes an inline error box", () => {
  const html = renderComponent("stats", "{nope");
  assert.match(html, /chart-error/);
  assert.match(html, /stats/);
});

test("renderArtifact substitutes component placeholders and keeps charts intact", () => {
  const md = [
    "## Section",
    "```stats",
    '[{"label":"A","value":"1"}]',
    "```",
    "```echarts",
    '{"description":"The only category has a value of one.","xAxis":{"type":"category","data":["a"]},"yAxis":{"type":"value"},"series":[{"type":"bar","data":[1]}]}',
    "```",
  ].join("\n");
  const { html } = renderArtifact(md);
  assert.ok(!html.includes("data-component-index"));
  assert.match(html, /stat-grid/);
  assert.match(html, /data-chart-index="0"/);
});

test("h2 sections become cards only when an h2 exists, headings get anchors", () => {
  const withSections = renderArtifact("intro\n\n## One\n\nbody\n\n## Two\n\nmore\n").html;
  assert.match(withSections, /<section class="section-card"><h2 id="one">One<\/h2>/);
  assert.equal(withSections.match(/<section class="section-card">/g)?.length, 2);

  const noSections = renderArtifact("just a paragraph\n").html;
  assert.ok(!noSections.includes('<section class="section-card">'));
});

test("github alerts become toned callouts and task lists become checkboxes", () => {
  const md = "> [!WARNING]\n> Careful here\n\n- [x] done\n- [ ] todo\n";
  const { html } = renderArtifact(md);
  assert.match(html, /alert alert-warn/);
  assert.match(html, /alert-title">Warning</);
  assert.ok(!html.includes("[!WARNING]"));
  assert.match(html, /<input type="checkbox" checked disabled aria-label="Completed task: done">/);
  assert.match(html, /<input type="checkbox" disabled aria-label="Open task: todo">/);
});

test("copy renders a button plus a template carrying the escaped text", () => {
  const html = renderComponent(
    "copy",
    JSON.stringify({ label: "Copy as prompt", text: "line one\nline <two>" }),
    "component-3",
  );
  assert.match(html, /copy-btn" data-copy-target="component-3"/);
  assert.match(html, /<template id="component-3">line one\nline &lt;two&gt;<\/template>/);
  assert.match(html, /Copy as prompt/);
});

test("copy requires a text field", () => {
  assert.match(renderComponent("copy", "{}"), /chart-error/);
});

test("a copy-only page still ships the boot script but no chart runtimes", () => {
  const { html } = renderArtifact("```copy\n" + JSON.stringify({ text: "x" }) + "\n```\n");
  assert.ok(html.includes("navigator.clipboard"));
  assert.ok(html.includes("copy-btn"));
  assert.ok(!html.includes("runtime:vega"));
  assert.ok(!html.includes("window.__ARTIFACT_CHARTS__=["));
});

test("mermaid fence becomes an escaped pre and inlines the mermaid runtime", () => {
  const { html } = renderArtifact("```mermaid\n%% summary: A leads to B.\ngraph TD\n  A-->B\n```\n");
  assert.match(html, /<pre class="mermaid" role="img" aria-label="A leads to B\.">graph TD\n  A--&gt;B<\/pre>/);
  assert.ok(html.includes("runtime:mermaid"));
  assert.ok(html.includes("mermaid.initialize"));
  assert.ok(!html.includes("runtime:vega"));

  const plain = renderArtifact("no diagrams here\n").html;
  assert.ok(!plain.includes("runtime:mermaid"));
});

test("mermaid fence rejects empty source", () => {
  assert.match(renderComponent("mermaid", "  \n"), /chart-error/);
});

test("table renders sortable headers, numeric sort values, and a row count", () => {
  const html = renderComponent(
    "table",
    JSON.stringify({
      columns: [
        { key: "name", label: "Package" },
        { key: "deps", label: "Deps", type: "num" },
      ],
      rows: [
        { name: "vega", deps: 45 },
        { name: "markdown-it", deps: 6 },
      ],
      caption: "npm ls --prod",
    }),
  );
  assert.match(html, /data-type="num"/);
  assert.match(html, /data-v="45">45</);
  assert.match(html, /2 rows/);
  assert.match(html, /table-filter/);
  assert.match(html, /npm ls --prod/);
});

test("table rejects malformed specs with an error box", () => {
  assert.match(renderComponent("table", '{"columns":[]}'), /chart-error/);
  assert.match(renderComponent("table", "{bad"), /chart-error/);
});

test("theme frontmatter applies a curated override, unknown themes fall back", () => {  const themed = renderArtifact("---\ntitle: T\ntheme: report\n---\nx\n").html;
  assert.ok(themed.includes("--page-bg:#f6f0e4"));
  assert.ok(themed.includes("Georgia"));
  assert.ok(themed.includes('<html lang="en" dir="ltr" data-locale="en-US" data-timezone="UTC" data-page-theme="report">'));

  const unknown = renderArtifact("---\ntitle: T\ntheme: neon-arcade\n---\nx\n").html;
  assert.ok(!unknown.includes("--page-bg:#f6f0e4"));
  assert.ok(!unknown.includes('data-page-theme='));

  const plain = renderArtifact("---\ntitle: T\n---\nx\n").html;
  assert.ok(!plain.includes("Georgia"));
});

test("pages follow the three-state theme pattern with a toggle", () => {
  const { html } = renderArtifact("plain\n");
  assert.ok(html.includes('@media (prefers-color-scheme: dark){:root:not([data-theme="light"])'));
  assert.ok(html.includes(':root[data-theme="dark"]'));
  assert.ok(html.includes("theme-toggle"));
  assert.ok(html.includes("artifact-theme"));

  const themed = renderArtifact("---\ntitle: T\ntheme: ops\n---\nx\n").html;
  assert.ok(themed.includes('hasAttribute("data-page-theme")'));
});

test("decisions renders option rows with question/option data attributes", () => {  const html = renderComponent(
    "decisions",
    JSON.stringify({
      title: "Open decisions",
      questions: [
        {
          id: "layout",
          question: "Which layout?",
          options: [
            { id: "tabs", label: "Two-column tabs", note: "deep-linkable" },
            { id: "dense", label: "Dense table" },
          ],
        },
      ],
    }),
  );
  assert.match(html, /decisions-title">Open decisions</);
  assert.match(html, /class="decision-opt" role="radio" aria-checked="false" tabindex="0" data-question="layout" data-option="tabs"/);
  assert.match(html, /decision-note">deep-linkable</);
  assert.match(html, /decision-opt" role="radio" aria-checked="false" tabindex="-1" data-question="layout" data-option="dense"/);
});

test("interactive state failures render actionable live notices", () => {
  const { html } = renderArtifact([
    "```decisions",
    JSON.stringify({ title: "Choose", questions: [{ id: "layout", question: "Layout?", options: [{ id: "tabs", label: "Tabs" }] }] }),
    "```",
  ].join("\n"));
  assert.match(html, /className = "artifact-state-notice"/);
  assert.match(html, /setAttribute\("role", "alert"\)/);
  assert.match(html, /Decisions changed in another session\. Reload to review the latest choices before retrying\./);
  assert.match(html, /Comments changed in another session\. Reload to review the latest thread before retrying\./);
  assert.match(html, /were not saved because the local service is unavailable/);
});
