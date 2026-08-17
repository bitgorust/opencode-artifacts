import { constants as fsConstants } from "node:fs";
import { open, lstat, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";
import MarkdownIt from "markdown-it";

export const DEFAULT_MAX_ASSET_COUNT = 64;
export const DEFAULT_MAX_ASSET_BYTES = 4 * 1024 * 1024;
export const DEFAULT_MAX_ASSET_TOTAL_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_MARKDOWN_BYTES = 1024 * 1024;

export type AssetKind = "image" | "font";

export interface AssetLimits {
  maxAssetCount?: number;
  maxAssetBytes?: number;
  maxTotalBytes?: number;
  maxMarkdownBytes?: number;
}

export interface AssetResolutionHooks {
  /** Test/fault-injection seam invoked after the descriptor identity is captured. */
  afterOpen?: (resolvedPath: string) => Promise<void>;
}

export interface PortableAsset {
  source: string;
  relativePath: string;
  kind: AssetKind;
  mime: string;
  bytes: number;
  encodedBytes: number;
  sha256: string;
  dataUri: string;
  alt: string | undefined;
  decorative: boolean;
}

export interface PortableAssets {
  bySource: ReadonlyMap<string, PortableAsset>;
  font: PortableAsset | undefined;
  sourceBytes: number;
  assetBytes: number;
  encodedBytes: number;
}

export type AssetErrorCode =
  | "source-too-large"
  | "too-many-assets"
  | "invalid-path"
  | "external-asset"
  | "missing-asset"
  | "unsafe-path"
  | "not-regular"
  | "unsupported-type"
  | "type-mismatch"
  | "active-content"
  | "asset-too-large"
  | "assets-too-large"
  | "changed-during-read"
  | "missing-alt";

function bounded(value: string): string {
  return value.length <= 200 ? value : `${value.slice(0, 197)}...`;
}

export class AssetPreflightError extends Error {
  readonly code: AssetErrorCode;
  readonly assetPath: string | undefined;
  readonly nextAction: string;

  constructor(code: AssetErrorCode, message: string, assetPath: string | undefined, nextAction: string) {
    super(`${message}${assetPath === undefined ? "" : `: ${bounded(assetPath)}`}. ${nextAction}`);
    this.name = "AssetPreflightError";
    this.code = code;
    this.assetPath = assetPath === undefined ? undefined : bounded(assetPath);
    this.nextAction = nextAction;
  }
}

interface AssetDeclaration {
  source: string;
  kind: AssetKind;
  alt?: string;
  decorative?: boolean;
}

function frontmatterFont(source: string): string | undefined {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return undefined;
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^font\s*:\s*(.*?)\s*$/i);
    if (field?.[1]) return field[1];
  }
  return undefined;
}

function imageDeclarations(source: string): AssetDeclaration[] {
  const md = new MarkdownIt({ html: false, linkify: true });
  const declarations: AssetDeclaration[] = [];
  const visit = (tokens: readonly { type: string; children?: unknown; attrGet(name: string): string | null; content: string }[]): void => {
    for (const token of tokens) {
      if (token.type === "image") {
        const assetSource = token.attrGet("src");
        if (assetSource !== null) {
          const title = token.attrGet("title");
          declarations.push({
            source: assetSource,
            kind: "image",
            alt: token.content.trim(),
            decorative: title?.trim().toLowerCase() === "decorative",
          });
        }
      }
      if (Array.isArray(token.children)) {
        visit(token.children as readonly { type: string; children?: unknown; attrGet(name: string): string | null; content: string }[]);
      }
    }
  };
  visit(md.parse(source, {}));
  return declarations;
}

function declarations(source: string): AssetDeclaration[] {
  const result = imageDeclarations(source);
  const font = frontmatterFont(source);
  if (font !== undefined) result.push({ source: font, kind: "font" });
  return result;
}

function safeRelativePath(source: string): string {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(source)) {
    throw new AssetPreflightError("external-asset", "external assets are not imported", source, "use a contained worktree-local file");
  }
  if (source.includes("\0") || source.includes("\\") || /%2f|%5c/i.test(source)) {
    throw new AssetPreflightError("invalid-path", "asset path contains an encoded or platform-dependent separator", source, "use forward-slash relative path segments");
  }
  if (source.includes("?") || source.includes("#")) {
    throw new AssetPreflightError("invalid-path", "asset paths may not contain URL query or fragment syntax", source, "use the plain worktree-relative file path");
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(source);
  } catch {
    throw new AssetPreflightError("invalid-path", "asset path has malformed percent encoding", source, "use a valid relative path");
  }
  if (isAbsolute(decoded) || /^[a-z]:/i.test(decoded)) {
    throw new AssetPreflightError("invalid-path", "absolute asset paths are not allowed", source, "use a path relative to the worktree root");
  }
  const segments = decoded.replace(/^\.\//, "").split("/");
  if (segments.length === 0 || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new AssetPreflightError("invalid-path", "asset path contains an empty or traversal segment", source, "use a direct relative path beneath the worktree root");
  }
  return segments.join(sep);
}

function contained(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return child !== "" && !child.startsWith(`..${sep}`) && child !== ".." && !isAbsolute(child);
}

async function rejectSymlinkSegments(root: string, path: string, source: string): Promise<void> {
  let cursor = root;
  const segments = relative(root, path).split(sep);
  for (const [index, segment] of segments.entries()) {
    cursor = resolve(cursor, segment);
    let info;
    try {
      info = await lstat(cursor);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        throw new AssetPreflightError("missing-asset", "asset does not exist", source, "create the file or correct the declaration");
      }
      throw error;
    }
    if (info.isSymbolicLink()) {
      throw new AssetPreflightError("unsafe-path", "asset paths may not contain symbolic links", source, "use a regular file stored directly beneath the worktree root");
    }
    if (index === segments.length - 1 && !info.isFile()) {
      throw new AssetPreflightError("not-regular", "asset is not a regular file", source, "use a regular file");
    }
  }
}

function declaredMime(path: string, kind: AssetKind): string {
  const lower = path.toLowerCase();
  const entries: ReadonlyArray<readonly [string, string, AssetKind]> = [
    [".png", "image/png", "image"],
    [".jpg", "image/jpeg", "image"],
    [".jpeg", "image/jpeg", "image"],
    [".gif", "image/gif", "image"],
    [".webp", "image/webp", "image"],
    [".svg", "image/svg+xml", "image"],
    [".woff", "font/woff", "font"],
    [".woff2", "font/woff2", "font"],
  ];
  const match = entries.find(([extension]) => lower.endsWith(extension));
  if (!match || match[2] !== kind) {
    throw new AssetPreflightError("unsupported-type", `unsupported ${kind} asset type`, path, kind === "font" ? "use a WOFF or WOFF2 file" : "use PNG, JPEG, GIF, WebP, or a constrained SVG");
  }
  return match[1];
}

function detectedMime(bytes: Buffer): string | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "wOFF") return "font/woff";
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "wOF2") return "font/woff2";
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
    if (text.startsWith("<svg") && text.endsWith("</svg>")) return "image/svg+xml";
  } catch {
    return undefined;
  }
  return undefined;
}

const SVG_ELEMENTS = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "title", "desc", "text", "tspan"]);
const SVG_ATTRIBUTES = new Set(["xmlns", "viewBox", "width", "height", "role", "aria-label", "fill", "stroke", "stroke-width", "opacity", "transform", "d", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "points", "text-anchor", "font-size", "font-family", "font-weight"]);

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeSvgAttribute(name: string, value: string): boolean {
  if (name === "xmlns") return value === "http://www.w3.org/2000/svg";
  if (name === "role") return value === "img" || value === "presentation";
  if (name === "aria-label" || name === "font-family") return /^[\p{L}\p{N} _.,-]{1,120}$/u.test(value);
  if (name === "fill" || name === "stroke") return value === "none" || value === "currentColor" || /^#[0-9a-f]{3,8}$/i.test(value) || /^[a-z]{1,24}$/i.test(value);
  if (name === "d") return /^[MmZzLlHhVvCcSsQqTtAaEe0-9.,+\-\s]+$/.test(value);
  if (name === "transform") return /^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\([0-9.,+\-\s]+\)\s*)+$/.test(value);
  if (name === "viewBox" || name === "points") return /^[0-9.,+\-\s]+$/.test(value);
  if (name === "text-anchor") return value === "start" || value === "middle" || value === "end";
  return /^[0-9.+\-%]{1,32}$/.test(value) || /^[a-z]{1,16}$/i.test(value);
}

export function sanitizeSvg(bytes: Buffer, source: string): Buffer {
  let input: string;
  try {
    input = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
  } catch {
    throw new AssetPreflightError("active-content", "SVG is not valid UTF-8", source, "export a static UTF-8 SVG using the supported subset");
  }
  if (/<!|<\?|&[A-Za-z#]|\b(?:href|style)\s*=|\bon[a-z]+\s*=|url\s*\(|javascript:|data:/i.test(input)) {
    throw new AssetPreflightError("active-content", "SVG contains active, external, styled, or entity content", source, "export a static SVG using only supported geometry and text");
  }
  const tag = /<\/?[A-Za-z][^<>]*>/g;
  const stack: string[] = [];
  const output: string[] = [];
  let cursor = 0;
  for (const match of input.matchAll(tag)) {
    const index = match.index;
    const text = input.slice(cursor, index);
    if (text.includes("<") || text.includes(">")) throw new AssetPreflightError("active-content", "SVG markup is malformed", source, "export a static SVG using the supported subset");
    if (text !== "") output.push(escapeXml(text));
    const raw = match[0];
    const closing = raw.startsWith("</");
    const selfClosing = raw.endsWith("/>");
    const nameMatch = raw.match(/^<\/?([A-Za-z][A-Za-z0-9-]*)/);
    const name = nameMatch?.[1];
    if (name === undefined || !SVG_ELEMENTS.has(name)) throw new AssetPreflightError("active-content", "SVG contains an unsupported element", source, "export a static SVG using supported geometry and text elements");
    if (closing) {
      if (raw !== `</${name}>` || stack.pop() !== name) throw new AssetPreflightError("active-content", "SVG element nesting is invalid", source, "export a well-formed static SVG");
      output.push(raw);
    } else {
      const attributesText = raw.slice(name.length + 1, raw.length - (selfClosing ? 2 : 1));
      const attributes: string[] = [];
      let attrCursor = 0;
      const attr = /\s+([A-Za-z][A-Za-z0-9:-]*)\s*=\s*("([^"]*)"|'([^']*)')/gy;
      while (attrCursor < attributesText.length) {
        attr.lastIndex = attrCursor;
        const attribute = attr.exec(attributesText);
        if (!attribute) {
          if (attributesText.slice(attrCursor).trim() === "") break;
          throw new AssetPreflightError("active-content", "SVG contains malformed attributes", source, "export a static SVG with quoted supported attributes");
        }
        const attributeName = attribute[1];
        const value = attribute[3] ?? attribute[4] ?? "";
        if (!SVG_ATTRIBUTES.has(attributeName) || !safeSvgAttribute(attributeName, value)) throw new AssetPreflightError("active-content", `SVG attribute ${attributeName} is unsupported or unsafe`, source, "remove active styling and external references");
        attributes.push(` ${attributeName}="${escapeXml(value)}"`);
        attrCursor = attr.lastIndex;
      }
      output.push(`<${name}${attributes.join("")}${selfClosing ? "/>" : ">"}`);
      if (!selfClosing) stack.push(name);
    }
    cursor = index + raw.length;
  }
  if (cursor !== input.length) {
    const tail = input.slice(cursor);
    if (tail.includes("<") || tail.includes(">")) throw new AssetPreflightError("active-content", "SVG markup is malformed", source, "export a well-formed static SVG");
    output.push(escapeXml(tail));
  }
  if (stack.length !== 0 || output.length === 0 || !output[0].startsWith("<svg")) throw new AssetPreflightError("active-content", "SVG root or nesting is invalid", source, "export a well-formed SVG root");
  return Buffer.from(output.join(""), "utf8");
}

async function boundedRead(path: string, source: string, maxBytes: number, hooks: AssetResolutionHooks): Promise<{ bytes: Buffer; identity: string }> {
  const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new AssetPreflightError("not-regular", "asset is not a regular file", source, "use a regular file");
    if (before.size > maxBytes) throw new AssetPreflightError("asset-too-large", `asset is ${before.size} bytes; limit is ${maxBytes}`, source, "reduce or optimize the asset");
    await hooks.afterOpen?.(path);
    const buffer = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < buffer.length) {
      const result = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (result.bytesRead === 0) break;
      offset += result.bytesRead;
    }
    const extra = Buffer.alloc(1);
    const extraRead = await handle.read(extra, 0, 1, offset);
    const after = await handle.stat();
    const identity = `${before.dev}:${before.ino}:${before.size}:${before.mtimeMs}`;
    const afterIdentity = `${after.dev}:${after.ino}:${after.size}:${after.mtimeMs}`;
    if (offset !== before.size || extraRead.bytesRead !== 0 || identity !== afterIdentity) throw new AssetPreflightError("changed-during-read", "asset changed while it was being read", source, "retry after writers have finished");
    return { bytes: buffer, identity };
  } finally {
    await handle.close();
  }
}

async function resolveAsset(root: string, declaration: AssetDeclaration, maxBytes: number, hooks: AssetResolutionHooks): Promise<PortableAsset> {
  if (declaration.kind === "image" && declaration.alt?.trim() === "" && declaration.decorative !== true) {
    throw new AssetPreflightError("missing-alt", "image is missing meaningful alt text", declaration.source, "add alt text, or use the exact title \"decorative\" for a decorative image");
  }
  const relativePath = safeRelativePath(declaration.source);
  const candidate = resolve(root, relativePath);
  if (!contained(root, candidate)) throw new AssetPreflightError("unsafe-path", "asset resolves outside the worktree root", declaration.source, "use a contained relative path");
  await rejectSymlinkSegments(root, candidate, declaration.source);
  const resolvedBefore = await realpath(candidate);
  if (!contained(root, resolvedBefore)) throw new AssetPreflightError("unsafe-path", "asset realpath escapes the worktree root", declaration.source, "store the file directly beneath the worktree root");
  const declared = declaredMime(relativePath, declaration.kind);
  const read = await boundedRead(resolvedBefore, declaration.source, maxBytes, hooks);
  const resolvedAfter = await realpath(candidate);
  if (resolvedAfter !== resolvedBefore) throw new AssetPreflightError("changed-during-read", "asset path changed while it was being read", declaration.source, "retry after filesystem changes have finished");
  const detected = detectedMime(read.bytes);
  if (detected !== declared) throw new AssetPreflightError("type-mismatch", `asset bytes do not match declared ${declared} type`, declaration.source, "correct the extension or provide an allowlisted file");
  const safeBytes = declared === "image/svg+xml" ? sanitizeSvg(read.bytes, declaration.source) : read.bytes;
  const encoded = safeBytes.toString("base64");
  const dataUri = `data:${declared};base64,${encoded}`;
  return {
    source: declaration.source,
    relativePath: relativePath.split(sep).join("/"),
    kind: declaration.kind,
    mime: declared,
    bytes: safeBytes.length,
    encodedBytes: Buffer.byteLength(dataUri, "utf8"),
    sha256: createHash("sha256").update(safeBytes).digest("hex"),
    dataUri,
    alt: declaration.alt,
    decorative: declaration.decorative === true,
  };
}

export async function resolvePortableAssets(
  markdown: string,
  worktreeRoot: string,
  limits: AssetLimits = {},
  hooks: AssetResolutionHooks = {},
): Promise<PortableAssets> {
  const sourceBytes = Buffer.byteLength(markdown, "utf8");
  const maxMarkdownBytes = limits.maxMarkdownBytes ?? DEFAULT_MAX_MARKDOWN_BYTES;
  if (sourceBytes > maxMarkdownBytes) throw new AssetPreflightError("source-too-large", `Markdown source is ${sourceBytes} bytes; limit is ${maxMarkdownBytes}`, undefined, "reduce the authoring source");
  const requestedRoot = resolve(worktreeRoot);
  const requestedRootInfo = await lstat(requestedRoot);
  if (!requestedRootInfo.isDirectory() || requestedRootInfo.isSymbolicLink()) throw new AssetPreflightError("unsafe-path", "worktree root is not a real directory", worktreeRoot, "select a real worktree directory");
  const root = await realpath(requestedRoot);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new AssetPreflightError("unsafe-path", "worktree root is not a real directory", worktreeRoot, "select a real worktree directory");
  const parsed = declarations(markdown);
  const maxAssetCount = limits.maxAssetCount ?? DEFAULT_MAX_ASSET_COUNT;
  if (parsed.length > maxAssetCount) throw new AssetPreflightError("too-many-assets", `document declares ${parsed.length} assets; limit is ${maxAssetCount}`, undefined, "reduce the number of declared assets");
  for (const declaration of parsed) {
    if (declaration.kind === "image" && declaration.alt?.trim() === "" && declaration.decorative !== true) {
      throw new AssetPreflightError("missing-alt", "image is missing meaningful alt text", declaration.source, "add alt text, or use the exact title \"decorative\" for a decorative image");
    }
  }
  const unique = new Map<string, AssetDeclaration>();
  for (const declaration of parsed) {
    const existing = unique.get(`${declaration.kind}:${declaration.source}`);
    if (existing?.alt && declaration.alt && existing.alt !== declaration.alt) {
      // The bytes are shared, but each rendered token retains its own Markdown alt text.
      continue;
    }
    unique.set(`${declaration.kind}:${declaration.source}`, declaration);
  }
  const bySource = new Map<string, PortableAsset>();
  let font: PortableAsset | undefined;
  let assetBytes = 0;
  let encodedBytes = 0;
  const maxAssetBytes = limits.maxAssetBytes ?? DEFAULT_MAX_ASSET_BYTES;
  const maxTotalBytes = limits.maxTotalBytes ?? DEFAULT_MAX_ASSET_TOTAL_BYTES;
  for (const declaration of unique.values()) {
    const asset = await resolveAsset(root, declaration, maxAssetBytes, hooks);
    assetBytes += asset.bytes;
    encodedBytes += asset.encodedBytes;
    if (assetBytes > maxTotalBytes) throw new AssetPreflightError("assets-too-large", `asset bytes total ${assetBytes}; limit is ${maxTotalBytes}`, declaration.source, "reduce or remove assets");
    if (declaration.kind === "font") font = asset;
    else bySource.set(declaration.source, asset);
  }
  return { bySource, font, sourceBytes, assetBytes, encodedBytes };
}
