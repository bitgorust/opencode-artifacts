import { test } from "node:test";
import assert from "node:assert/strict";
import { renderArtifact } from "../src/render.ts";
import { preflightDocument } from "../src/preflight.ts";
import { validateComponent } from "../src/components.ts";
import { contrastRatio } from "../src/design-tokens.ts";
import { formatZonedTimestamp, resolveLocaleContext } from "../src/locale.ts";

const ACCESSIBLE_DOCUMENT = [
  "---",
  "title: مراجعة الإشارات",
  "lang: ar",
  "dir: rtl",
  "locale: ar-EG",
  "timezone: Asia/Riyadh",
  "---",
  "# مراجعة الإشارات",
  "",
  "> [!NOTE] ملخص واضح لا يعتمد على اللون.",
  "",
  "- [x] اكتملت المراجعة",
  "",
  "```progress",
  '{"label":"التقدم","done":3,"total":4}',
  "```",
  "",
  "```echarts",
  '{"description":"ترتفع الإشارة من ثلاث نقاط إلى خمس نقاط خلال يومين.","xAxis":{"type":"category","data":["الاثنين","الثلاثاء"]},"yAxis":{"type":"value"},"series":[{"type":"line","data":[3,5]}]}',
  "```",
  "",
  "```table",
  '{"caption":"سجل الإشارات","columns":[{"key":"count","label":"العدد","type":"num"},{"key":"captured","label":"وقت الالتقاط","type":"datetime"}],"rows":[{"count":1234.5,"captured":"2026-08-17T15:00:00Z"}]}',
  "```",
  "",
  "```decisions",
  '{"title":"قرار","questions":[{"id":"next","question":"ما الخطوة التالية؟","options":[{"id":"ship","label":"نشر"},{"id":"hold","label":"انتظار"}]}]}',
  "```",
].join("\n");

test("built-in output exposes landmarks, equivalents, labels, state, and RTL metadata", async () => {
  const preflight = await preflightDocument(ACCESSIBLE_DOCUMENT);
  assert.deepEqual(preflight.diagnostics.filter((item) => item.severity === "error"), []);
  const html = renderArtifact(ACCESSIBLE_DOCUMENT).html;
  assert.match(html, /<html lang="ar" dir="rtl" data-locale="ar-EG" data-timezone="Asia\/Riyadh">/);
  assert.match(html, /href="#artifact-main">Skip to main content/);
  assert.match(html, /<main id="artifact-main" class="artifact-body" tabindex="-1">/);
  assert.match(html, /<h1 id="مراجعة-الإشارات">/);
  assert.match(html, /<figure class="chart-frame"><div class="chart"[^>]+role="img"[^>]+aria-labelledby="chart-0-summary"/);
  assert.match(html, /<figcaption id="chart-0-summary" class="chart-summary">ترتفع الإشارة/);
  assert.match(html, /<table class="data-table"[^>]*><caption>سجل الإشارات<\/caption>/);
  assert.match(html, /<label class="sr-only" for="component-1-filter">Filter سجل الإشارات rows<\/label>/);
  assert.match(html, /aria-sort="none"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /role="progressbar"[^>]+aria-valuenow="3"/);
  assert.match(html, /role="radiogroup"/);
  assert.match(html, /role="radio" aria-checked="false" tabindex="0"/);
  assert.match(html, /<aside class="alert alert-info" role="note" aria-label="Note">/);
  assert.match(html, /aria-label="Completed task: اكتملت المراجعة"/);
  assert.match(html, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(html, /@media \(max-width:600px\)/);
  assert.match(html, /@media \(max-width:700px\).*comments-dock\{position:static/);
  assert.match(html, /@media print/);
  assert.match(html, /border-inline-start/);
  assert.match(html, /inset-inline-end/);
});

test("locale and time-zone formatting is explicit and deterministic", () => {
  const context = resolveLocaleContext({ lang: "ar", locale: "ar-EG", timezone: "Asia/Riyadh" });
  assert.equal(context.dir, "rtl");
  const expected = formatZonedTimestamp("2026-08-17T15:00:00Z", context, true);
  assert.ok(expected);
  const first = renderArtifact(ACCESSIBLE_DOCUMENT).html;
  const second = renderArtifact(ACCESSIBLE_DOCUMENT).html;
  assert.equal(first, second);
  assert.ok(first.includes(`<time datetime="2026-08-17T15:00:00Z">${expected}</time>`));
  assert.ok(!first.includes(">1,234.5<"), "ar-EG formatting must not silently use en-US");
});

test("accessibility preflight refuses missing equivalents and invalid internationalization", async () => {
  const chart = await preflightDocument('```echarts\n{"series":[]}\n```');
  assert.equal(chart.diagnostics[0]?.code, "chart-summary-missing");
  const metadata = await preflightDocument("---\nlang: not_a_tag\ndir: sideways\nlocale: bad_locale\ntimezone: Mars/Olympus\n---\n# x");
  assert.deepEqual(metadata.diagnostics.map((item) => item.code), [
    "language-invalid",
    "direction-invalid",
    "locale-invalid",
    "timezone-invalid",
  ]);
  assert.equal(validateComponent("mermaid", "graph TD\nA-->B")[0]?.code, "mermaid-summary");
  assert.equal(validateComponent("table", '{"columns":[],"rows":[]}')[0]?.code, "table-caption");
  assert.equal(validateComponent("table", '{"caption":"Dates","columns":[{"key":"at","label":"At","type":"datetime"}],"rows":[{"at":"2026-08-17 15:00"}]}')[0]?.code, "table-date");
});

test("built-in semantic colors meet WCAG AA text contrast floors", () => {
  const pairs: Array<[string, string]> = [
    ["#111827", "#ffffff"],
    ["#4b5563", "#ffffff"],
    ["#5f5dbf", "#ffffff"],
    ["#237a52", "#e4f4ec"],
    ["#b42335", "#fdeeee"],
    ["#92400e", "#fdf0dc"],
    ["#33526e", "#dce6f2"],
    ["#e5e7eb", "#1f2630"],
    ["#9ca3af", "#1f2630"],
    ["#a8a6ff", "#1f2630"],
  ];
  for (const [foreground, background] of pairs) {
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${foreground} on ${background}`);
  }
});
