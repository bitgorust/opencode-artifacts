import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join } from "node:path";

export const DESIGN_TOKEN_FILE = join(".opencode", "artifact-tokens.json");
export const MAX_DESIGN_TOKEN_BYTES = 8 * 1024;

const TOKEN_NAMES = [
  "pageBackground",
  "surface",
  "text",
  "mutedText",
  "border",
  "accent",
  "font",
  "spacing",
  "radius",
  "density",
] as const;
const COLOR_NAMES = ["pageBackground", "surface", "text", "mutedText", "border", "accent"] as const;

export type DesignTokenName = typeof TOKEN_NAMES[number];
export type DesignTokenSource = "default" | "theme" | "project" | "prompt";
export type DesignTokenValues = Record<DesignTokenName, string>;

export interface DesignTokenIssue {
  code: string;
  reason: string;
  nextAction: string;
  source: "project" | "prompt";
  promptIndex?: number;
}

export interface ResolvedDesignTokens {
  css: string;
  values: DesignTokenValues;
  provenance: Record<DesignTokenName, DesignTokenSource>;
  active: boolean;
  fixesColorMode: boolean;
}

export interface DesignTokenResolution {
  designTokens: ResolvedDesignTokens;
  issues: DesignTokenIssue[];
}

export interface ProjectDesignTokenSource {
  value?: unknown;
  issue?: DesignTokenIssue;
}

const BASE: DesignTokenValues = {
  pageBackground: "#e9edf2",
  surface: "#ffffff",
  text: "#111827",
  mutedText: "#4b5563",
  border: "#e5e7eb",
  accent: "#6d6bd6",
  font: "system",
  spacing: "comfortable",
  radius: "round",
  density: "comfortable",
};

const THEME_VALUES: Record<string, Partial<DesignTokenValues>> = {
  report: {
    pageBackground: "#f6f0e4",
    surface: "#fffdf7",
    text: "#2b251a",
    mutedText: "#6b5f49",
    border: "#e3d9c4",
    accent: "#b4541e",
  },
  ops: {
    pageBackground: "#0f140f",
    surface: "#171f17",
    text: "#d5e5cf",
    mutedText: "#8fa389",
    border: "#263026",
    accent: "#4ade80",
  },
  editorial: {
    pageBackground: "#fafafa",
    surface: "#ffffff",
    text: "#141414",
    mutedText: "#525252",
    border: "#e5e5e5",
    accent: "#141414",
    radius: "sharp",
  },
};

const FONT_STACKS: Record<string, string> = {
  system: `system-ui,-apple-system,"Segoe UI",sans-serif`,
  serif: `Georgia,Charter,"Times New Roman",serif`,
  mono: `ui-monospace,SFMono-Regular,Menlo,monospace`,
};
const SPACING: Record<string, [string, string, string]> = {
  compact: ["1rem", "2rem", ".9rem"],
  comfortable: ["1.5rem", "3rem", "1.25rem"],
  spacious: ["2rem", "4rem", "1.75rem"],
};
const RADII: Record<string, string> = { square: "0", sharp: "4px", soft: "8px", round: "16px" };
const DENSITY: Record<string, [string, string, string]> = {
  compact: ["1rem", "1.15rem", ".82rem"],
  comfortable: ["1.5rem", "1.75rem", ".86rem"],
  airy: ["2rem", "2.25rem", ".92rem"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(source: "project" | "prompt", code: string, reason: string, nextAction: string, promptIndex?: number): DesignTokenIssue {
  return { code, reason, nextAction, source, ...(promptIndex === undefined ? {} : { promptIndex }) };
}

function parsePacket(value: unknown, source: "project" | "prompt", promptIndex?: number): { tokens?: Partial<DesignTokenValues>; issues: DesignTokenIssue[] } {
  if (!isRecord(value)) return { issues: [issue(source, "design-shape", "design token source must be an object", "use the documented schemaVersion and tokens object", promptIndex)] };
  const issues: DesignTokenIssue[] = [];
  for (const key of Object.keys(value)) {
    if (key !== "schemaVersion" && key !== "tokens") issues.push(issue(source, "design-root-key", `unknown design root key '${key}'`, "keep only schemaVersion and tokens", promptIndex));
  }
  if (value["schemaVersion"] !== 1 || !isRecord(value["tokens"])) {
    issues.push(issue(source, "design-schema", "design token schema is not version 1", "use {\"schemaVersion\":1,\"tokens\":{...}}", promptIndex));
    return { issues };
  }
  const tokenObject = value["tokens"];
  for (const key of Object.keys(tokenObject)) {
    if (!(TOKEN_NAMES as readonly string[]).includes(key)) issues.push(issue(source, "design-token-unknown", `unknown design token '${key}'`, "remove it or use a documented token name", promptIndex));
  }
  const tokens: Partial<DesignTokenValues> = {};
  for (const name of TOKEN_NAMES) {
    const tokenValue = tokenObject[name];
    if (tokenValue === undefined) continue;
    if (typeof tokenValue !== "string") {
      issues.push(issue(source, "design-token-type", `design token '${name}' must be a string`, "use a documented string value", promptIndex));
      continue;
    }
    if ((COLOR_NAMES as readonly string[]).includes(name)) {
      if (!/^#[0-9a-fA-F]{6}$/.test(tokenValue)) {
        issues.push(issue(source, "design-color", `design token '${name}' is not a six-digit hex color`, "use a value such as #1f2937", promptIndex));
        continue;
      }
      tokens[name] = tokenValue.toLowerCase();
    } else if (name === "font") {
      if (!(tokenValue in FONT_STACKS)) {
        issues.push(issue(source, "design-font", "font is not allowlisted", "use system, serif, or mono", promptIndex));
        continue;
      }
      tokens[name] = tokenValue;
    } else if (name === "spacing") {
      if (!(tokenValue in SPACING)) {
        issues.push(issue(source, "design-spacing", "spacing is not allowlisted", "use compact, comfortable, or spacious", promptIndex));
        continue;
      }
      tokens[name] = tokenValue;
    } else if (name === "radius") {
      if (!(tokenValue in RADII)) {
        issues.push(issue(source, "design-radius", "radius is not allowlisted", "use square, sharp, soft, or round", promptIndex));
        continue;
      }
      tokens[name] = tokenValue;
    } else {
      if (!(tokenValue in DENSITY)) {
        issues.push(issue(source, "design-density", "density is not allowlisted", "use compact, comfortable, or airy", promptIndex));
        continue;
      }
      tokens[name] = tokenValue;
    }
  }
  return { tokens, issues };
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  return 0.2126 * channel(Number.parseInt(color.slice(1, 3), 16))
    + 0.7152 * channel(Number.parseInt(color.slice(3, 5), 16))
    + 0.0722 * channel(Number.parseInt(color.slice(5, 7), 16));
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastIssue(values: DesignTokenValues, source: "project" | "prompt", promptIndex?: number): DesignTokenIssue | undefined {
  const pairs: Array<[string, string, number, string]> = [
    [values.text, values.pageBackground, 4.5, "text/pageBackground"],
    [values.text, values.surface, 4.5, "text/surface"],
    [values.mutedText, values.pageBackground, 4.5, "mutedText/pageBackground"],
    [values.mutedText, values.surface, 4.5, "mutedText/surface"],
    [values.accent, values.pageBackground, 3, "accent/pageBackground"],
    [values.accent, values.surface, 3, "accent/surface"],
  ];
  const failed = pairs.find(([foreground, background, minimum]) => contrastRatio(foreground, background) < minimum);
  return failed === undefined
    ? undefined
    : issue(source, "design-contrast", `design color pair ${failed[3]} does not meet its contrast floor`, "choose colors meeting WCAG 2.2 AA contrast", promptIndex);
}

function cssFor(values: DesignTokenValues, provenance: Record<DesignTokenName, DesignTokenSource>, fixesColorMode: boolean): string {
  const [bodyPad, bodyPadBottom, sectionGap] = SPACING[values.spacing];
  const [sectionPadY, sectionPadX, tableSize] = DENSITY[values.density];
  const font = FONT_STACKS[values.font];
  const customized = (name: DesignTokenName): boolean => provenance[name] === "project" || provenance[name] === "prompt";
  const declarations: string[] = [];
  if (fixesColorMode) {
    declarations.push(`--page-bg:${values.pageBackground}`, `--card-bg:${values.surface}`, `--ink:${values.text}`, `--ink-2:${values.mutedText}`, `--line:${values.border}`, `--accent:${values.accent}`);
  }
  if (customized("font")) declarations.push(`--artifact-font:${font}`, `--artifact-heading-font:${font}`);
  if (customized("spacing")) declarations.push(`--body-pad:${bodyPad}`, `--body-pad-bottom:${bodyPadBottom}`, `--section-gap:${sectionGap}`);
  if (customized("density")) declarations.push(`--section-pad-y:${sectionPadY}`, `--section-pad-x:${sectionPadX}`, `--table-font-size:${tableSize}`);
  if (customized("radius")) declarations.push(`--radius:${RADII[values.radius]}`);
  return `:root[data-design-tokens]{${declarations.join(";")}}`;
}

function parsedJson(source: string, index: number): { value?: unknown; issue?: DesignTokenIssue } {
  if (Buffer.byteLength(source, "utf8") > MAX_DESIGN_TOKEN_BYTES) {
    return { issue: issue("prompt", "design-prompt-too-large", "prompt design tokens exceed the 8192-byte limit", "reduce the design token declaration", index) };
  }
  try {
    return { value: JSON.parse(source) as unknown };
  } catch {
    return { issue: issue("prompt", "design-json", "prompt design tokens are not valid JSON", "provide the version 1 JSON object", index) };
  }
}

export function resolveDesignTokens(theme: string | undefined, project: ProjectDesignTokenSource | undefined, promptSources: readonly string[]): DesignTokenResolution {
  const namedTheme = theme !== undefined && THEME_VALUES[theme] !== undefined;
  let values: DesignTokenValues = { ...BASE, ...(namedTheme ? THEME_VALUES[theme] : {}) };
  const baseline: DesignTokenSource = namedTheme ? "theme" : "default";
  const provenance = Object.fromEntries(TOKEN_NAMES.map((name) => [name, baseline])) as Record<DesignTokenName, DesignTokenSource>;
  const issues: DesignTokenIssue[] = [];
  let active = false;
  let fixesColorMode = false;

  const apply = (tokens: Partial<DesignTokenValues>, source: "project" | "prompt", promptIndex?: number): void => {
    const candidate = { ...values, ...tokens };
    const invalidContrast = contrastIssue(candidate, source, promptIndex);
    if (invalidContrast) {
      issues.push(invalidContrast);
      return;
    }
    values = candidate;
    for (const name of TOKEN_NAMES) {
      if (tokens[name] !== undefined) provenance[name] = source;
    }
    active ||= Object.keys(tokens).length > 0;
    fixesColorMode ||= COLOR_NAMES.some((name) => tokens[name] !== undefined);
  };

  if (project?.issue) issues.push(project.issue);
  else if (project?.value !== undefined) {
    const parsed = parsePacket(project.value, "project");
    if (parsed.issues.length > 0) issues.push(...parsed.issues);
    else apply(parsed.tokens ?? {}, "project");
  }

  if (promptSources.length > 1) {
    issues.push(issue("prompt", "design-prompt-duplicate", "only one design-tokens fence is allowed", "merge prompt overrides into one version 1 declaration", 1));
    for (const [index, source] of promptSources.entries()) {
      const decoded = parsedJson(source, index);
      if (decoded.issue) {
        issues.push(decoded.issue);
        continue;
      }
      const parsed = parsePacket(decoded.value, "prompt", index);
      if (parsed.issues.length > 0) {
        issues.push(...parsed.issues);
        continue;
      }
      const invalidContrast = contrastIssue({ ...values, ...(parsed.tokens ?? {}) }, "prompt", index);
      if (invalidContrast) issues.push(invalidContrast);
    }
  } else if (promptSources.length === 1) {
    const decoded = parsedJson(promptSources[0], 0);
    if (decoded.issue) issues.push(decoded.issue);
    else {
      const parsed = parsePacket(decoded.value, "prompt", 0);
      if (parsed.issues.length > 0) issues.push(...parsed.issues);
      else apply(parsed.tokens ?? {}, "prompt", 0);
    }
  }

  return {
    designTokens: { css: active ? cssFor(values, provenance, fixesColorMode) : "", values, provenance, active, fixesColorMode },
    issues,
  };
}

function projectIssue(code: string, reason: string, nextAction: string): ProjectDesignTokenSource {
  return { issue: issue("project", code, reason, nextAction) };
}

export async function loadProjectDesignTokens(worktreeRoot: string): Promise<ProjectDesignTokenSource | undefined> {
  let rootInfo;
  try {
    rootInfo = await lstat(worktreeRoot);
  } catch {
    return projectIssue("design-project-root", "design token worktree root is unavailable", "select an existing worktree directory");
  }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) return projectIssue("design-project-root", "design token worktree root is unsafe", "select a real worktree directory");
  const directory = join(worktreeRoot, ".opencode");
  try {
    const directoryInfo = await lstat(directory);
    if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) return projectIssue("design-project-path", "the .opencode design token directory is unsafe", "use a real project directory without symlinks");
  } catch (error) {
    if (isRecord(error) && error["code"] === "ENOENT") return undefined;
    return projectIssue("design-project-path", "the .opencode design token directory cannot be inspected", "repair the project directory");
  }
  const path = join(worktreeRoot, DESIGN_TOKEN_FILE);
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile()) return projectIssue("design-project-file", "project design tokens are not a regular file", `replace ${DESIGN_TOKEN_FILE} with a regular file`);
  } catch (error) {
    if (isRecord(error) && error["code"] === "ENOENT") return undefined;
    return projectIssue("design-project-file", "project design tokens cannot be inspected", `repair ${DESIGN_TOKEN_FILE}`);
  }
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat();
    if (!before.isFile()) return projectIssue("design-project-file", "project design tokens are not a regular file", `replace ${DESIGN_TOKEN_FILE} with a regular file`);
    if (before.size > MAX_DESIGN_TOKEN_BYTES) return projectIssue("design-project-too-large", "project design tokens exceed the 8192-byte limit", "reduce the file to the documented schema");
    const buffer = Buffer.alloc(MAX_DESIGN_TOKEN_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const read = await handle.read(buffer, offset, buffer.length - offset, offset);
      if (read.bytesRead === 0) break;
      offset += read.bytesRead;
    }
    const after = await handle.stat();
    if (offset > MAX_DESIGN_TOKEN_BYTES) return projectIssue("design-project-too-large", "project design tokens exceed the 8192-byte limit", "reduce the file to the documented schema");
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      return projectIssue("design-project-changed", "project design tokens changed while being read", "retry after project writers finish");
    }
    try {
      return { value: JSON.parse(buffer.subarray(0, offset).toString("utf8")) as unknown };
    } catch {
      return projectIssue("design-json", "project design tokens are not valid JSON", "provide the version 1 JSON object");
    }
  } catch {
    return projectIssue("design-project-file", "project design tokens cannot be opened safely", `repair ${DESIGN_TOKEN_FILE}`);
  } finally {
    await handle?.close();
  }
}
