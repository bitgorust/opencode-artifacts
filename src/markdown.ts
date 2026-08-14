import MarkdownIt from "markdown-it";
import { COMPONENT_KINDS, type ComponentKind } from "./components.ts";

export interface Frontmatter {
  title?: string;
  icon?: string;
  description?: string;
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

export interface ParsedDocument {
  meta: Frontmatter;
  bodyHtml: string;
  charts: ChartSpec[];
  components: ComponentBlock[];
  warnings: string[];
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const KEY_VALUE_RE = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/;

function parseFrontmatter(source: string, warnings: string[]): { meta: Frontmatter; body: string } {
  const match = source.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: source };
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
    else warnings.push(`frontmatter key ignored: ${key}`);
  }
  return { meta, body: source.slice(match[0].length) };
}

export function parseDocument(source: string): ParsedDocument {
  const warnings: string[] = [];
  const { meta, body } = parseFrontmatter(source, warnings);
  const charts: ChartSpec[] = [];
  const components: ComponentBlock[] = [];

  const md = new MarkdownIt({ html: false, linkify: true });
  const escapeHtml = md.utils.escapeHtml;

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
    return `<pre><code class="language-${escapeHtml(info)}">${escapeHtml(token.content)}</code></pre>\n`;
  };

  const bodyHtml = md.render(body);
  return { meta, bodyHtml, charts, components, warnings };
}
