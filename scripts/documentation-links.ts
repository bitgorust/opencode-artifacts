import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";

export type LinkKind = "local" | "official" | "external";

export interface DocumentationLink {
  sourcePath: string;
  line: number;
  target: string;
  kind: LinkKind;
  rootRelative: boolean;
}

export interface LinkIssue {
  sourcePath: string;
  line: number;
  target: string;
  reason: "path-escape" | "missing-path" | "missing-anchor" | "invalid-target";
  detail: string;
}

export interface OfficialLinkResult {
  url: string;
  status: "pass" | "terminal-failure" | "transient-failure" | "timeout";
  httpStatus: number | null;
  finalUrl: string | null;
  detail: string;
}

export type OfficialFetcher = (
  url: string,
  signal: AbortSignal,
) => Promise<{ status: number; url: string }>;

const OFFICIAL_HOSTS = [
  "anthropic.com",
  "claude.com",
  "code.claude.com",
  "platform.claude.com",
  "docs.github.com",
  "docs.npmjs.com",
  "developers.openai.com",
  "learn.chatgpt.com",
  "openai.com",
  "opencode.ai",
];

const SCAN_ROOTS = ["README.md", "docs", "specs"];
const EXCLUDED_PREFIXES = ["specs/templates/"];

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function isOfficialHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return OFFICIAL_HOSTS.some((host) => lower === host || lower.endsWith(`.${host}`));
}

function withoutInlineCode(line: string): string {
  let result = "";
  let index = 0;
  while (index < line.length) {
    const tick = line.indexOf("\`", index);
    if (tick === -1) return result + line.slice(index);
    result += line.slice(index, tick);
    let width = 1;
    while (line[tick + width] === "\`") width++;
    const fence = "\`".repeat(width);
    const end = line.indexOf(fence, tick + width);
    if (end === -1) return result;
    result += " ".repeat(end + width - tick);
    index = end + width;
  }
  return result;
}

function parseDestination(raw: string): string | undefined {
  const value = raw.trim();
  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    return end === -1 ? undefined : value.slice(1, end);
  }
  const title = /\s+(?=["'])/.exec(value);
  return (title ? value.slice(0, title.index) : value).trim() || undefined;
}

export function extractDocumentationLinks(
  markdown: string,
  sourcePath: string,
): DocumentationLink[] {
  const links: DocumentationLink[] = [];
  const lines = markdown.split("\n");
  let fence: string | undefined;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fenceMatch = /^\s*([\`~]{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }
    if (fence) continue;

    const visible = withoutInlineCode(line);
    const linkPattern = /!?\[([^\]]*)\]\(([^)]+)\)/g;
    for (const match of visible.matchAll(linkPattern)) {
      const target = parseDestination(match[2]);
      if (!target) continue;
      const rootRelative = /^@(test|manual|model)$/.test(match[1]);
      if (/^(?:mailto|data|javascript):/i.test(target)) continue;
      if (/^https?:\/\//i.test(target)) {
        try {
          const url = new URL(target);
          links.push({
            sourcePath,
            line: index + 1,
            target,
            kind: isOfficialHost(url.hostname) ? "official" : "external",
            rootRelative,
          });
        } catch {
          links.push({ sourcePath, line: index + 1, target, kind: "external", rootRelative });
        }
      } else {
        links.push({ sourcePath, line: index + 1, target, kind: "local", rootRelative });
      }
    }
  }
  return links;
}

function headingText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/[\`*_~]/g, "")
    .trim();
}

function githubSlug(value: string): string {
  return headingText(value)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

export function markdownAnchors(markdown: string): Set<string> {
  const anchors = new Set<string>();
  const counts = new Map<string, number>();
  let fence: string | undefined;
  for (const line of markdown.split("\n")) {
    const fenceMatch = /^\s*([\`~]{3,})/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = undefined;
      continue;
    }
    if (fence) continue;
    const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    const base = githubSlug(heading[1]);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

async function markdownPaths(root: string): Promise<string[]> {
  const paths: string[] = [];
  for (const scanRoot of SCAN_ROOTS) {
    const absolute = resolve(root, scanRoot);
    if (!existsSync(absolute)) continue;
    if (extname(absolute) === ".md") {
      paths.push(scanRoot);
      continue;
    }
    const entries = await readdir(absolute, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const path = normalizePath(relative(root, resolve(entry.parentPath, entry.name)));
      if (!EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) paths.push(path);
    }
  }
  return paths.sort();
}

function safelyDecode(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function contained(root: string, target: string): boolean {
  const path = relative(resolve(root), resolve(target));
  return path === "" || (!path.startsWith("..") && !path.startsWith(`..${sep}`));
}

export async function collectDocumentationLinks(root: string): Promise<DocumentationLink[]> {
  const links: DocumentationLink[] = [];
  for (const path of await markdownPaths(root)) {
    links.push(...extractDocumentationLinks(await readFile(resolve(root, path), "utf8"), path));
  }
  return links;
}

export async function validateLocalDocumentationLinks(root: string): Promise<LinkIssue[]> {
  const issues: LinkIssue[] = [];
  const anchorCache = new Map<string, Set<string>>();
  for (const link of await collectDocumentationLinks(root)) {
    if (link.kind !== "local") continue;
    const hash = link.target.indexOf("#");
    const query = link.target.indexOf("?");
    const boundary = [hash, query].filter((value) => value >= 0).sort((a, b) => a - b)[0];
    const rawPath = boundary === undefined ? link.target : link.target.slice(0, boundary);
    const fragmentRaw = hash === -1 ? "" : link.target.slice(hash + 1).split("?")[0];
    const decodedPath = safelyDecode(rawPath);
    const fragment = safelyDecode(fragmentRaw);
    if (decodedPath === undefined || fragment === undefined) {
      issues.push({ ...link, reason: "invalid-target", detail: "invalid percent encoding" });
      continue;
    }
    const absolute = decodedPath === ""
      ? resolve(root, link.sourcePath)
      : link.rootRelative
        ? resolve(root, decodedPath)
        : resolve(root, dirname(link.sourcePath), decodedPath);
    if (!contained(root, absolute)) {
      issues.push({ ...link, reason: "path-escape", detail: "target escapes the repository" });
      continue;
    }
    if (!existsSync(absolute)) {
      issues.push({ ...link, reason: "missing-path", detail: normalizePath(relative(root, absolute)) });
      continue;
    }
    if (!fragment) continue;
    if (extname(absolute).toLowerCase() !== ".md") {
      issues.push({ ...link, reason: "missing-anchor", detail: "anchors are validated only for Markdown targets" });
      continue;
    }
    let anchors = anchorCache.get(absolute);
    if (!anchors) {
      anchors = markdownAnchors(await readFile(absolute, "utf8"));
      anchorCache.set(absolute, anchors);
    }
    if (!anchors.has(fragment)) {
      issues.push({ ...link, reason: "missing-anchor", detail: `heading #${fragment} does not exist` });
    }
  }
  return issues;
}

async function defaultOfficialFetcher(
  url: string,
  signal: AbortSignal,
): Promise<{ status: number; url: string }> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { Range: "bytes=0-0", "User-Agent": "opencode-artifacts-link-check/1" },
    signal,
  });
  await response.body?.cancel();
  return { status: response.status, url: response.url };
}

export async function probeOfficialLinks(
  links: DocumentationLink[],
  options: { timeoutMs?: number; fetcher?: OfficialFetcher } = {},
): Promise<OfficialLinkResult[]> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const fetcher = options.fetcher ?? defaultOfficialFetcher;
  const urls = [...new Set(links.filter((link) => link.kind === "official").map((link) => link.target))].sort();
  const results: OfficialLinkResult[] = [];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, controller.signal);
      const pass = response.status >= 200 && response.status < 400;
      const transient = response.status === 408 || response.status === 429 || response.status >= 500;
      results.push({
        url,
        status: pass ? "pass" : transient ? "transient-failure" : "terminal-failure",
        httpStatus: response.status,
        finalUrl: response.url,
        detail: pass ? "reachable" : `HTTP ${response.status}`,
      });
    } catch (error) {
      const timeout = controller.signal.aborted;
      results.push({
        url,
        status: timeout ? "timeout" : "transient-failure",
        httpStatus: null,
        finalUrl: null,
        detail: timeout ? `timed out after ${timeoutMs}ms` : error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }
  return results;
}
