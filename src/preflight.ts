import MarkdownIt from "markdown-it";
import { validateComponent, COMPONENT_KINDS, type ComponentKind } from "./components.ts";
import { resolvePortableAssets, AssetPreflightError, type PortableAssets } from "./assets.ts";
import { validateChartSpec } from "./render.ts";
import { slugify } from "./text.ts";

export type DiagnosticSeverity = "error" | "warning";
export type DiagnosticSource = "frontmatter" | "component" | "chart" | "markdown" | "asset" | "mode";

export interface AuthoringDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  source: DiagnosticSource;
  line: number;
  column: number;
  message: string;
  nextAction: string;
}

export interface PreflightOptions {
  worktreeRoot?: string;
  maxDiagnostics?: number;
  maxDiagnosticBytes?: number;
}

export interface PreflightResult {
  diagnostics: AuthoringDiagnostic[];
  omitted: number;
  assets?: PortableAssets;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const KNOWN_FRONTMATTER = new Set(["title", "icon", "description", "theme", "source", "font"]);
const THEMES = new Set(["default", "report", "ops", "editorial"]);
const CHART_KINDS = new Set(["vega-lite", "vega", "echarts"]);
const ALERT_KINDS = new Set(["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);

function clean(value: string): string {
  const redacted = value
    .replace(/\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{12,}\b/g, "[REDACTED]")
    .replace(/\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]")
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----/g, "[REDACTED]");
  return redacted.length <= 240 ? redacted : `${redacted.slice(0, 237)}...`;
}

function diagnostic(code: string, severity: DiagnosticSeverity, source: DiagnosticSource, line: number, message: string, nextAction: string): AuthoringDiagnostic {
  return { code, severity, source, line, column: 1, message: clean(message), nextAction: clean(nextAction) };
}

function frontmatterDiagnostics(markdown: string): AuthoringDiagnostic[] {
  const match = markdown.match(FRONTMATTER_RE);
  if (!match) return [];
  const seen = new Set<string>();
  const output: AuthoringDiagnostic[] = [];
  for (const [index, line] of match[1].split(/\r?\n/).entries()) {
    if (line.trim() === "") continue;
    const parsed = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!parsed) {
      output.push(diagnostic("frontmatter-syntax", "error", "frontmatter", index + 2, "frontmatter line is not key: value", "use a documented key and scalar value"));
      continue;
    }
    const key = parsed[1];
    if (seen.has(key)) output.push(diagnostic("frontmatter-duplicate", "error", "frontmatter", index + 2, `frontmatter key '${key}' is duplicated`, "keep one value for each key"));
    seen.add(key);
    if (!KNOWN_FRONTMATTER.has(key)) output.push(diagnostic("frontmatter-unknown", "warning", "frontmatter", index + 2, `frontmatter key '${key}' is ignored`, "remove it or use a documented key"));
    if (key === "theme" && parsed[2] !== "" && !THEMES.has(parsed[2].trim())) output.push(diagnostic("theme-unknown", "warning", "frontmatter", index + 2, "unknown theme falls back to default", "use default, report, ops, or editorial"));
  }
  return output;
}

function markdownDiagnostics(markdown: string): AuthoringDiagnostic[] {
  const md = new MarkdownIt({ html: false, linkify: true });
  const tokens = md.parse(markdown, {});
  const output: AuthoringDiagnostic[] = [];
  const anchors = new Map<string, number>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const line = (token.map?.[0] ?? 0) + 1;
    if (token.type === "fence") {
      const kind = token.info.trim().split(/\s+/)[0] ?? "";
      if (COMPONENT_KINDS.has(kind)) {
        for (const componentIssue of validateComponent(kind as ComponentKind, token.content)) {
          output.push(diagnostic(componentIssue.code, "error", "component", line, `component '${kind}' is invalid: ${componentIssue.reason}`, componentIssue.nextAction));
        }
      } else if (CHART_KINDS.has(kind)) {
        const result = validateChartSpec({ kind: kind as "vega-lite" | "vega" | "echarts", json: token.content });
        if (result.error) output.push(diagnostic(result.code ?? `${kind}-invalid`, "error", "chart", line, `chart '${kind}' is invalid`, "provide valid JSON and a valid chart schema"));
      }
    }
    if (token.type === "heading_open") {
      const inline = tokens[index + 1];
      const anchor = slugify(inline?.content ?? "");
      const first = anchors.get(anchor);
      if (anchor !== "" && first !== undefined) output.push(diagnostic("anchor-duplicate", "error", "markdown", line, `heading anchor '${anchor}' duplicates line ${first}`, "rename one heading so every anchor is unique"));
      else if (anchor !== "") anchors.set(anchor, line);
    }
  }
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const alert = line.match(/^\s*>\s*\[!([A-Z]+)\]/);
    if (alert && !ALERT_KINDS.has(alert[1])) output.push(diagnostic("alert-unknown", "warning", "markdown", index + 1, `alert kind '${alert[1]}' is not supported`, "use NOTE, TIP, IMPORTANT, WARNING, or CAUTION"));
    if (/^\s*[-*+]\s+\[[^ xX\]]\]/.test(line)) output.push(diagnostic("task-marker-invalid", "warning", "markdown", index + 1, "task marker is not [ ] or [x]", "use [ ] for open or [x] for complete"));
  }
  return output;
}

interface AssetProbe {
  markdown: string;
  line: number;
}

function assetProbes(markdown: string): AssetProbe[] {
  const md = new MarkdownIt({ html: false, linkify: true });
  const probes: AssetProbe[] = [];
  const visit = (tokens: readonly { type: string; map: [number, number] | null; children?: unknown; content: string; attrGet(name: string): string | null }[], inheritedLine: number): void => {
    for (const token of tokens) {
      const line = (token.map?.[0] ?? inheritedLine - 1) + 1;
      if (token.type === "image") {
        const source = token.attrGet("src") ?? "";
        const decorative = token.attrGet("title")?.trim().toLowerCase() === "decorative";
        probes.push({ markdown: `![${token.content}](<${source}>${decorative ? ' "decorative"' : ""})`, line });
      }
      if (Array.isArray(token.children)) visit(token.children as readonly { type: string; map: [number, number] | null; children?: unknown; content: string; attrGet(name: string): string | null }[], line);
    }
  };
  visit(md.parse(markdown, {}), 1);
  const frontmatter = markdown.match(FRONTMATTER_RE);
  if (frontmatter) {
    for (const [index, line] of frontmatter[1].split(/\r?\n/).entries()) {
      const font = line.match(/^font\s*:\s*(.*?)\s*$/);
      if (font?.[1]) probes.push({ markdown: `---\nfont: ${font[1]}\n---\nx`, line: index + 2 });
    }
  }
  return probes;
}

async function preflightAssets(markdown: string, root: string): Promise<{ diagnostics: AuthoringDiagnostic[]; assets?: PortableAssets }> {
  const diagnostics: AuthoringDiagnostic[] = [];
  for (const probe of assetProbes(markdown)) {
    try {
      await resolvePortableAssets(probe.markdown, root);
    } catch (error) {
      if (!(error instanceof AssetPreflightError)) throw error;
      diagnostics.push(diagnostic(`asset-${error.code}`, "error", "asset", probe.line, error.message, error.nextAction));
    }
  }
  if (diagnostics.length > 0) return { diagnostics };
  try {
    return { diagnostics, assets: await resolvePortableAssets(markdown, root) };
  } catch (error) {
    if (!(error instanceof AssetPreflightError)) throw error;
    return { diagnostics: [diagnostic(`asset-${error.code}`, "error", "asset", 1, error.message, error.nextAction)] };
  }
}

function bounded(diagnostics: AuthoringDiagnostic[], options: PreflightOptions): { diagnostics: AuthoringDiagnostic[]; omitted: number } {
  const maxCount = Math.max(1, options.maxDiagnostics ?? 50);
  const maxBytes = Math.max(512, options.maxDiagnosticBytes ?? 16 * 1024);
  const kept: AuthoringDiagnostic[] = [];
  let bytes = 2;
  for (const item of diagnostics.sort((a, b) => a.line - b.line || a.column - b.column)) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item), "utf8") + (kept.length === 0 ? 0 : 1);
    if (kept.length >= maxCount || bytes + itemBytes > maxBytes) break;
    kept.push(item);
    bytes += itemBytes;
  }
  let omitted = diagnostics.length - kept.length;
  if (omitted > 0) {
    let marker = diagnostic("diagnostics-omitted", "error", "markdown", kept.at(-1)?.line ?? 1, `${omitted} additional diagnostics were omitted by the report limit`, "fix reported errors, then run preflight again");
    while (kept.length >= maxCount || Buffer.byteLength(JSON.stringify([...kept, marker]), "utf8") > maxBytes) {
      if (kept.length === 0) break;
      kept.pop();
      omitted++;
      marker = diagnostic("diagnostics-omitted", "error", "markdown", kept.at(-1)?.line ?? 1, `${omitted} additional diagnostics were omitted by the report limit`, "fix reported errors, then run preflight again");
    }
    kept.push(marker);
  }
  return { diagnostics: kept, omitted };
}

export async function preflightDocument(markdown: string, options: PreflightOptions = {}): Promise<PreflightResult> {
  const all = [...frontmatterDiagnostics(markdown), ...markdownDiagnostics(markdown)];
  let assets: PortableAssets | undefined;
  if (options.worktreeRoot !== undefined) {
    const assetResult = await preflightAssets(markdown, options.worktreeRoot);
    all.push(...assetResult.diagnostics);
    assets = assetResult.assets;
  }
  const result = bounded(all, options);
  return { ...result, ...(assets === undefined ? {} : { assets }) };
}

export function trustedHtmlDiagnostic(): AuthoringDiagnostic {
  return diagnostic("trusted-html-mode", "warning", "mode", 1, "trusted HTML executes page-authored markup outside Markdown guarantees", "review the complete HTML and permission prompt before publishing");
}

export function formatPreflight(result: PreflightResult): string {
  return JSON.stringify({ error: "authoring-preflight", diagnostics: result.diagnostics, omitted: result.omitted }, null, 2);
}
