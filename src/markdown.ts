import MarkdownIt from "markdown-it";
import { COMPONENT_KINDS, type ComponentKind } from "./components.ts";
import type { PortableAsset } from "./assets.ts";

export interface Frontmatter {
  title?: string;
  icon?: string;
  description?: string;
  theme?: string;
  source?: string;
  font?: string;
}

export type ChartKind = "vega-lite" | "vega" | "echarts";
const CHART_KINDS: ReadonlySet<string> = new Set(["vega-lite", "vega", "echarts"]);

export interface ChartSpec {
  kind: ChartKind;
  json: string;
}

export interface ComponentBlock {
  kind: ComponentKind;
  json: string;
}

export interface DesignTokenBlock {
  json: string;
  line: number;
}

export interface ParsedDocument {
  meta: Frontmatter;
  bodyHtml: string;
  charts: ChartSpec[];
  components: ComponentBlock[];
  designTokens: DesignTokenBlock[];
  warnings: string[];
}

export interface ParseDocumentOptions {
  assets?: ReadonlyMap<string, PortableAsset>;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const KEY_VALUE_RE = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/;

function parseFrontmatter(source: string, warnings: string[]): { meta: Frontmatter; body: string; lineOffset: number } {
  const match = source.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: source, lineOffset: 0 };
  const meta: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = line.match(KEY_VALUE_RE);
    if (!kv) {
      warnings.push(`frontmatter line ignored: ${JSON.stringify(line)}`);
      continue;
    }
    const key = kv[1];
    const value = kv[2].trim();
    if (key === "title") meta.title = value;
    else if (key === "icon") meta.icon = value;
    else if (key === "description") meta.description = value;
    else if (key === "theme") meta.theme = value;
    else if (key === "source") meta.source = value;
    else if (key === "font") meta.font = value;
    else warnings.push(`frontmatter key ignored: ${key}`);
  }
  return { meta, body: source.slice(match[0].length), lineOffset: (match[0].match(/\n/g) ?? []).length };
}

export function parseDocument(source: string, options: ParseDocumentOptions = {}): ParsedDocument {
  const warnings: string[] = [];
  const { meta, body, lineOffset } = parseFrontmatter(source, warnings);
  const charts: ChartSpec[] = [];
  const components: ComponentBlock[] = [];
  const designTokens: DesignTokenBlock[] = [];

  const md = new MarkdownIt({ html: false, linkify: true });
  const escapeHtml = md.utils.escapeHtml;

  md.renderer.rules.image = (tokens, idx, renderOptions, env, renderer) => {
    const token = tokens[idx];
    const assetSource = token.attrGet("src") ?? "";
    const asset = options.assets?.get(assetSource);
    if (asset === undefined) {
      return `<span class="asset-error" role="alert">Asset preflight required: ${escapeHtml(assetSource)}</span>`;
    }
    const alt = renderer.renderInlineAsText(token.children ?? [], renderOptions, env);
    const decorative = token.attrGet("title")?.trim().toLowerCase() === "decorative";
    const title = token.attrGet("title");
    const titleAttribute = title !== null && !decorative ? ` title="${escapeHtml(title)}"` : "";
    const decorativeAttributes = decorative ? ' role="presentation"' : "";
    return `<img src="${asset.dataUri}" alt="${decorative ? "" : escapeHtml(alt)}"${titleAttribute}${decorativeAttributes} data-asset-sha256="${asset.sha256}" data-asset-source="${escapeHtml(asset.relativePath)}">`;
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = token.info.trim().split(/\s+/)[0] ?? "";
    if (CHART_KINDS.has(info)) {
      const index = charts.length;
      charts.push({ kind: info as ChartKind, json: token.content });
      return `<div class="chart" data-chart-index="${index}"></div>\n`;
    }
    if (COMPONENT_KINDS.has(info)) {
      const index = components.length;
      components.push({ kind: info as ComponentKind, json: token.content });
      return `<div class="component" data-component-index="${index}"></div>\n`;
    }
    if (info === "design-tokens") {
      designTokens.push({ json: token.content, line: (token.map?.[0] ?? 0) + lineOffset + 1 });
      return "";
    }
    return `<pre><code class="language-${escapeHtml(info)}">${escapeHtml(token.content)}</code></pre>\n`;
  };

  const bodyHtml = md.render(body);
  return { meta, bodyHtml, charts, components, designTokens, warnings };
}
