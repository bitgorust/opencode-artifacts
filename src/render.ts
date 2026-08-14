import { compile as compileVegaLite } from "vega-lite";
import { parseDocument, type ChartSpec, type Frontmatter } from "./markdown.ts";
import { runtimeBundle, type RuntimeName } from "./runtime.ts";

export const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
export const FOOTER_PLACEHOLDER = "<!--artifact:footer-->";

export class ArtifactTooLargeError extends Error {
  readonly bytes: number;
  readonly maxBytes: number;
  constructor(bytes: number, maxBytes: number) {
    super(`artifact is ${bytes} bytes, exceeding the ${maxBytes}-byte cap`);
    this.name = "ArtifactTooLargeError";
    this.bytes = bytes;
    this.maxBytes = maxBytes;
  }
}

export interface RenderOptions {
  maxBytes?: number;
}

export interface RenderedArtifact {
  html: string;
  meta: Frontmatter;
  chartCount: number;
}

type ResolvedKind = "vega" | "echarts";

interface ResolvedChart {
  kind: ResolvedKind;
  spec?: unknown;
  error?: string;
}

export const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "connect-src 'none'",
].join("; ");

export const ARTIFACT_CSS = `:root{color-scheme:light dark}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6}
.artifact-header{display:flex;align-items:center;gap:.6rem;padding:.9rem 1.5rem;border-bottom:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.artifact-header h1{font-size:1.15rem;margin:0}
.artifact-icon{font-size:1.3rem}
.artifact-body{max-width:960px;margin:0 auto;padding:1.25rem 1.5rem 3rem}
.artifact-footer{max-width:960px;margin:0 auto;padding:1rem 1.5rem 2rem;font-size:.85rem;opacity:.65;border-top:1px solid color-mix(in srgb,currentColor 15%,transparent)}
.artifact-footer a{color:inherit}
pre{background:color-mix(in srgb,currentColor 7%,transparent);padding:.75rem 1rem;overflow:auto;border-radius:8px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
.chart{margin:1.25rem 0;min-height:320px}
.chart-error{padding:.75rem 1rem;border:1px solid #d6336c;border-radius:8px;color:#d6336c}
table{border-collapse:collapse}
td,th{border:1px solid color-mix(in srgb,currentColor 20%,transparent);padding:.3rem .65rem}
img{max-width:100%}
a{color:#4c6ef5}
.gallery{max-width:960px;margin:0 auto;padding:1.5rem;display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.card{display:block;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:10px;padding:1rem 1.25rem;text-decoration:none;color:inherit}
.card:hover{border-color:#4c6ef5}
.card h2{margin:.2rem 0 .4rem;font-size:1.05rem}
.card .meta{font-size:.8rem;opacity:.65}
.card .icon{font-size:1.6rem}
.gallery-empty{opacity:.6;text-align:center;padding:3rem 0}
@media print{.artifact-body{max-width:none}.chart{break-inside:avoid}}`;

const BOOT = `(function () {
  var charts = window.__ARTIFACT_CHARTS__ || [];
  charts.forEach(function (entry, i) {
    var el = document.querySelector('[data-chart-index="' + i + '"]');
    if (!el) return;
    function fail(message) {
      el.textContent = "";
      var box = document.createElement("div");
      box.className = "chart-error";
      box.textContent = "Chart failed to render: " + message;
      el.appendChild(box);
    }
    if (entry.error) { fail(entry.error); return; }
    try {
      if (entry.kind === "vega") {
        window.vegaEmbed(el, entry.spec, { actions: false, ast: true });
      } else if (entry.kind === "echarts") {
        var chart = window.echarts.init(el);
        chart.setOption(entry.spec);
        window.addEventListener("resize", function () { chart.resize(); });
      }
    } catch (err) {
      fail(err && err.message ? err.message : String(err));
    }
  });
})();`;

export function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function emojiFaviconDataUri(icon: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">${escapeHtmlText(icon)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function resolveCharts(charts: ChartSpec[]): ResolvedChart[] {
  return charts.map((chart) => {
    const kind: ResolvedKind = chart.kind === "echarts" ? "echarts" : "vega";
    try {
      const parsed: unknown = JSON.parse(chart.json);
      if (kind === "echarts") return { kind, spec: parsed };
      if (chart.kind === "vega-lite") {
        const compiled = compileVegaLite(parsed as Parameters<typeof compileVegaLite>[0]);
        return { kind, spec: compiled.spec };
      }
      return { kind, spec: parsed };
    } catch (err) {
      return { kind, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

interface AssembleInput {
  title: string;
  icon: string;
  bodyHtml: string;
  resolved: ResolvedChart[];
  maxBytes: number;
}

function assemblePage(input: AssembleInput): string {
  const runtimes = new Set<RuntimeName>();
  if (input.resolved.some((c) => c.kind === "vega")) {
    runtimes.add("vega");
    runtimes.add("vega-embed");
  }
  if (input.resolved.some((c) => c.kind === "echarts")) {
    runtimes.add("echarts");
  }

  const parts: string[] = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<link rel="icon" href="${emojiFaviconDataUri(input.icon)}">`,
    `<title>${escapeHtmlText(input.title)}</title>`,
    `<style>${ARTIFACT_CSS}</style>`,
    "</head>",
    "<body>",
    `<header class="artifact-header"><span class="artifact-icon">${escapeHtmlText(input.icon)}</span><h1>${escapeHtmlText(input.title)}</h1></header>`,
    `<main class="artifact-body">${input.bodyHtml}</main>`,
    FOOTER_PLACEHOLDER,
  ];

  if (input.resolved.length > 0) {
    const payload = JSON.stringify(input.resolved).replace(/</g, "\\u003c");
    parts.push(`<script>window.__ARTIFACT_CHARTS__=${payload};</script>`);
    for (const name of ["vega", "vega-embed", "echarts"] as const) {
      if (runtimes.has(name)) parts.push(`<script>${runtimeBundle(name)}</script>`);
    }
    parts.push(`<script>${BOOT}</script>`);
  }

  parts.push("</body>", "</html>");
  const html = parts.join("\n");

  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > input.maxBytes) throw new ArtifactTooLargeError(bytes, input.maxBytes);

  return html;
}

export function renderArtifact(markdown: string, options: RenderOptions = {}): RenderedArtifact {
  const doc = parseDocument(markdown);
  const html = assemblePage({
    title: doc.meta.title ?? "Artifact",
    icon: doc.meta.icon ?? "📄",
    bodyHtml: doc.bodyHtml,
    resolved: resolveCharts(doc.charts),
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
  });
  return { html, meta: doc.meta, chartCount: doc.charts.length };
}

export function renderRawHtml(
  bodyHtml: string,
  meta: Frontmatter = {},
  options: RenderOptions = {},
): RenderedArtifact {
  const html = assemblePage({
    title: meta.title ?? "Artifact",
    icon: meta.icon ?? "📄",
    bodyHtml,
    resolved: [],
    maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
  });
  return { html, meta, chartCount: 0 };
}
