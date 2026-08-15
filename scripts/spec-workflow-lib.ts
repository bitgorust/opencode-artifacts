import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

export const CHANGE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const REQUIREMENT_ID_RE = /^[A-Z][A-Z0-9]*-[0-9]{2,}$/;

export type ChangeLane = "standard" | "high-risk";
export type ChangeStatus = "draft" | "approved" | "implementing" | "verified" | "archived";
export type ValidationPhase = "structure" | "proposal" | "implementation" | "archive";

export interface ChangeMetadata {
  schemaVersion: 1;
  id: string;
  title: string;
  lane: ChangeLane;
  status: ChangeStatus;
  affectedRequirements: string[];
  currentSpecs: string[];
  currentSpecsUpdated: boolean;
  approval: {
    by: string;
    at: string;
  };
  createdAt: string;
  archivedAt: string | null;
}

const BASE_PACKET_FILES = ["change.json", "proposal.md", "delta.md", "tasks.md", "evidence.md"];
const TEMPLATE_FILES = ["proposal.md", "delta.md", "design.md", "tasks.md", "evidence.md"];
const VALID_STATUSES = new Set<ChangeStatus>([
  "draft",
  "approved",
  "implementing",
  "verified",
  "archived",
]);
const VALID_PHASES = new Set<ValidationPhase>([
  "structure",
  "proposal",
  "implementation",
  "archive",
]);

function today(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function packetFiles(lane: ChangeLane): string[] {
  return lane === "high-risk" ? [...BASE_PACKET_FILES, "design.md"] : BASE_PACKET_FILES;
}

function changeDirectory(root: string, id: string): string {
  if (!CHANGE_ID_RE.test(id)) {
    throw new Error(`invalid change ID ${JSON.stringify(id)}; use lowercase kebab-case`);
  }
  return join(root, "specs", "changes", id);
}

function isSafeRepositoryPath(root: string, path: string): boolean {
  if (path.length === 0 || isAbsolute(path)) return false;
  const target = resolve(root, path);
  const fromRoot = relative(resolve(root), target);
  return fromRoot !== "" && fromRoot !== ".." && !fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`);
}

function parseMetadata(content: string, source: string): { metadata?: ChangeMetadata; errors: string[] } {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { errors: [`${source} is not valid JSON: ${detail}`] };
  }

  if (!isRecord(value)) return { errors: [`${source} must contain an object`] };
  const errors: string[] = [];
  if (value["schemaVersion"] !== 1) errors.push(`${source} schemaVersion must be 1`);
  if (typeof value["id"] !== "string" || !CHANGE_ID_RE.test(value["id"])) {
    errors.push(`${source} id must be lowercase kebab-case`);
  }
  if (typeof value["title"] !== "string") errors.push(`${source} title must be a string`);
  if (value["lane"] !== "standard" && value["lane"] !== "high-risk") {
    errors.push(`${source} lane must be standard or high-risk`);
  }
  if (typeof value["status"] !== "string" || !VALID_STATUSES.has(value["status"] as ChangeStatus)) {
    errors.push(`${source} status is invalid`);
  }
  if (!isStringArray(value["affectedRequirements"])) {
    errors.push(`${source} affectedRequirements must be a string array`);
  } else {
    for (const id of value["affectedRequirements"]) {
      if (!REQUIREMENT_ID_RE.test(id)) errors.push(`${source} has invalid requirement ID ${id}`);
    }
    if (new Set(value["affectedRequirements"]).size !== value["affectedRequirements"].length) {
      errors.push(`${source} affectedRequirements contains duplicates`);
    }
  }
  if (!isStringArray(value["currentSpecs"])) {
    errors.push(`${source} currentSpecs must be a string array`);
  }
  if (typeof value["currentSpecsUpdated"] !== "boolean") {
    errors.push(`${source} currentSpecsUpdated must be a boolean`);
  }
  if (!isRecord(value["approval"])) {
    errors.push(`${source} approval must be an object`);
  } else if (typeof value["approval"]["by"] !== "string" || typeof value["approval"]["at"] !== "string") {
    errors.push(`${source} approval.by and approval.at must be strings`);
  }
  if (typeof value["createdAt"] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value["createdAt"])) {
    errors.push(`${source} createdAt must use YYYY-MM-DD`);
  }
  if (value["archivedAt"] !== null && (typeof value["archivedAt"] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value["archivedAt"]))) {
    errors.push(`${source} archivedAt must be null or YYYY-MM-DD`);
  }
  if (errors.length > 0) return { errors };
  return { metadata: value as unknown as ChangeMetadata, errors };
}

async function readPacketFile(directory: string, name: string, errors: string[]): Promise<string> {
  try {
    return await readFile(join(directory, name), "utf8");
  } catch {
    errors.push(`missing packet file ${name}`);
    return "";
  }
}

function extractProductRequirementIds(content: string): Set<string> {
  return new Set([...content.matchAll(/^- \*\*([A-Z][A-Z0-9]*-[0-9]{2,}):\*\*/gm)].map((match) => match[1]));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasClarificationMarker(value: string): boolean {
  return /\[NEEDS CLARIFICATION(?:[^\]]*)\]/.test(value);
}

function requirementBlock(delta: string, id: string): string | undefined {
  const heading = new RegExp(`^### Requirement: ${escapeRegExp(id)}\\s*$`, "m");
  const match = heading.exec(delta);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  const rest = delta.slice(start);
  const next = /^### Requirement: /m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

function evidenceBlock(evidence: string, id: string): string | undefined {
  const heading = new RegExp(`^## Requirement: ${escapeRegExp(id)}\\s*$`, "m");
  const match = heading.exec(evidence);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  const rest = evidence.slice(start);
  const next = /^## Requirement: /m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

async function validatePacket(
  root: string,
  directory: string,
  expectedId: string,
  phase: ValidationPhase,
  archivedPacket = false,
): Promise<string[]> {
  const errors: string[] = [];
  const metadataText = await readPacketFile(directory, "change.json", errors);
  if (!metadataText) return errors;
  const parsed = parseMetadata(metadataText, relative(root, join(directory, "change.json")));
  errors.push(...parsed.errors);
  const metadata = parsed.metadata;
  if (!metadata) return errors;

  if (metadata.id !== expectedId) errors.push(`change.json id ${metadata.id} does not match directory ${expectedId}`);
  if (archivedPacket) {
    if (metadata.status !== "archived") errors.push("archived packet status must be archived");
    if (metadata.archivedAt === null) errors.push("archived packet archivedAt must be set");
  } else if (metadata.status === "archived") {
    errors.push("active packet status cannot be archived");
  }

  for (const name of packetFiles(metadata.lane)) {
    if (!existsSync(join(directory, name))) errors.push(`missing packet file ${name}`);
  }
  for (const path of metadata.currentSpecs) {
    if (!isSafeRepositoryPath(root, path) || !path.startsWith("specs/current/") || !path.endsWith(".spec.md")) {
      errors.push(`current spec path must be a contained specs/current/*.spec.md path: ${path}`);
    }
  }
  if (phase === "structure") return [...new Set(errors)];

  if (metadata.title.trim() === "" || hasClarificationMarker(metadata.title)) {
    errors.push("change title must be resolved before proposal approval");
  }
  if (metadata.affectedRequirements.length === 0) {
    errors.push("affectedRequirements must name at least one product requirement");
  }

  let productSpec = "";
  try {
    productSpec = await readFile(join(root, "docs", "product-spec.md"), "utf8");
  } catch {
    errors.push("missing docs/product-spec.md");
  }
  const knownRequirements = extractProductRequirementIds(productSpec);
  for (const id of metadata.affectedRequirements) {
    if (!knownRequirements.has(id)) errors.push(`unknown product requirement ${id}`);
  }

  const proposal = await readPacketFile(directory, "proposal.md", errors);
  const delta = await readPacketFile(directory, "delta.md", errors);
  const design = metadata.lane === "high-risk" ? await readPacketFile(directory, "design.md", errors) : "";
  for (const [name, content] of [["proposal.md", proposal], ["delta.md", delta], ...(metadata.lane === "high-risk" ? [["design.md", design]] : [])] as Array<[string, string]>) {
    if (hasClarificationMarker(content)) errors.push(`${name} has unresolved clarification markers`);
  }
  if (!/^## (ADDED|MODIFIED|REMOVED|RENAMED)\s*$/m.test(delta)) {
    errors.push("delta.md must contain an ADDED, MODIFIED, REMOVED, or RENAMED section");
  }
  for (const id of metadata.affectedRequirements) {
    const block = requirementBlock(delta, id);
    if (!block) {
      errors.push(`delta.md has no requirement block for ${id}`);
      continue;
    }
    const scenarios = [...block.matchAll(/^#### Scenario:\s*(.+)$/gm)].map((match) => match[1].trim());
    if (scenarios.length < 3) errors.push(`delta.md requirement ${id} needs normal, failure, and boundary scenarios`);
  }
  if (phase === "proposal") return [...new Set(errors)];

  if (!new Set<ChangeStatus>(["approved", "implementing", "verified"]).has(metadata.status)) {
    errors.push("implementation requires approved, implementing, or verified status");
  }
  if (metadata.approval.by.trim() === "" || metadata.approval.at.trim() === "") {
    errors.push("implementation requires recorded human approval");
  } else if (Number.isNaN(Date.parse(metadata.approval.at))) {
    errors.push("approval.at must be a valid date or timestamp");
  }
  if (phase === "implementation") return [...new Set(errors)];

  if (metadata.status !== "verified" && !(archivedPacket && metadata.status === "archived")) {
    errors.push("archive requires verified status");
  }
  if (!metadata.currentSpecsUpdated || metadata.currentSpecs.length === 0) {
    errors.push("archive requires currentSpecsUpdated and at least one current spec path");
  }
  for (const path of metadata.currentSpecs) {
    if (isSafeRepositoryPath(root, path) && !existsSync(resolve(root, path))) {
      errors.push(`current spec does not exist: ${path}`);
    }
  }

  const tasks = await readPacketFile(directory, "tasks.md", errors);
  if (/^- \[ \]/m.test(tasks)) errors.push("tasks.md has unchecked tasks");
  const evidence = await readPacketFile(directory, "evidence.md", errors);
  if (hasClarificationMarker(evidence)) errors.push("evidence.md has unresolved clarification markers");
  for (const id of metadata.affectedRequirements) {
    const block = evidenceBlock(evidence, id);
    if (!block) {
      errors.push(`evidence.md has no requirement block for ${id}`);
      continue;
    }
    if (!/^- Validation:[^\n]*\S/m.test(block)) errors.push(`evidence.md ${id} has no validation result`);
    if (!/^- Verification:[^\n]*\S/m.test(block)) errors.push(`evidence.md ${id} has no verification result`);
    const links = [...block.matchAll(/\[@(?:test|manual|model)\]\(([^)]+)\)/g)].map((match) => match[1].split("#")[0]);
    if (links.length === 0) errors.push(`evidence.md ${id} has no typed evidence link`);
    for (const path of links) {
      if (!isSafeRepositoryPath(root, path)) {
        errors.push(`evidence path escapes the repository: ${path}`);
      } else if (!existsSync(resolve(root, path))) {
        errors.push(`evidence target does not exist: ${path}`);
      }
    }
  }
  return [...new Set(errors)];
}

export async function scaffoldChange(
  root: string,
  id: string,
  lane: ChangeLane,
  title = "[NEEDS CLARIFICATION]",
  templatesRoot = join(root, "specs", "templates"),
  now = new Date(),
): Promise<string> {
  if (lane !== "standard" && lane !== "high-risk") throw new Error(`invalid lane ${lane}`);
  const directory = changeDirectory(root, id);
  if (existsSync(directory)) throw new Error(`change already exists: ${id}`);

  const templates = new Map<string, string>();
  for (const name of TEMPLATE_FILES) {
    if (lane === "standard" && name === "design.md") continue;
    templates.set(name, await readFile(join(templatesRoot, name), "utf8"));
  }

  await mkdir(directory, { recursive: false });
  const metadata: ChangeMetadata = {
    schemaVersion: 1,
    id,
    title,
    lane,
    status: "draft",
    affectedRequirements: [],
    currentSpecs: [],
    currentSpecsUpdated: false,
    approval: { by: "", at: "" },
    createdAt: today(now),
    archivedAt: null,
  };
  await writeFile(join(directory, "change.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  for (const [name, template] of templates) {
    await writeFile(join(directory, name), template.replaceAll("{{title}}", title), "utf8");
  }
  return directory;
}

export async function validateChange(
  root: string,
  id: string,
  phase: ValidationPhase = "structure",
): Promise<string[]> {
  if (!VALID_PHASES.has(phase)) throw new Error(`invalid validation phase ${phase}`);
  return validatePacket(root, changeDirectory(root, id), id, phase);
}

export async function archiveChange(root: string, id: string, now = new Date()): Promise<string> {
  const source = changeDirectory(root, id);
  const errors = await validatePacket(root, source, id, "archive");
  if (errors.length > 0) throw new Error(`change ${id} is not ready to archive:\n- ${errors.join("\n- ")}`);

  const destination = join(root, "specs", "archive", `${today(now)}-${id}`);
  if (existsSync(destination)) throw new Error(`archive destination already exists: ${relative(root, destination)}`);
  await rename(source, destination);
  const metadataPath = join(destination, "change.json");
  const parsed = parseMetadata(await readFile(metadataPath, "utf8"), relative(root, metadataPath));
  if (!parsed.metadata) throw new Error(parsed.errors.join("; "));
  const metadata: ChangeMetadata = { ...parsed.metadata, status: "archived", archivedAt: today(now) };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  return destination;
}

export async function validateSpecRepository(root: string): Promise<string[]> {
  const errors: string[] = [];
  const required = [
    "docs/adr/0001-spec-anchored-development.md",
    "specs/README.md",
    "specs/current/README.md",
    "specs/changes/README.md",
    "specs/archive/README.md",
    ...TEMPLATE_FILES.map((name) => `specs/templates/${name}`),
  ];
  for (const path of required) {
    if (!existsSync(join(root, path))) errors.push(`missing workflow file ${path}`);
  }

  const changesRoot = join(root, "specs", "changes");
  if (existsSync(changesRoot)) {
    for (const entry of await readdir(changesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!CHANGE_ID_RE.test(entry.name)) {
        errors.push(`active change directory must use lowercase kebab-case: ${entry.name}`);
        continue;
      }
      const packetErrors = await validatePacket(root, join(changesRoot, entry.name), entry.name, "structure");
      errors.push(...packetErrors.map((error) => `changes/${entry.name}: ${error}`));
    }
  }

  const archiveRoot = join(root, "specs", "archive");
  if (existsSync(archiveRoot)) {
    for (const entry of await readdir(archiveRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const match = /^\d{4}-\d{2}-\d{2}-(.+)$/.exec(entry.name);
      if (!match || !CHANGE_ID_RE.test(match[1])) {
        errors.push(`archive directory must use YYYY-MM-DD-change-id: ${entry.name}`);
        continue;
      }
      const packetErrors = await validatePacket(root, join(archiveRoot, entry.name), match[1], "structure", true);
      errors.push(...packetErrors.map((error) => `archive/${entry.name}: ${error}`));
    }
  }
  return [...new Set(errors)];
}
