const REQUIREMENT_LINE = /^- \*\*([A-Z]+-\d+):\*\*/gm;
const RANGE = /`([A-Z]+)-(\d+)`(?:\s*–\s*`([A-Z]+)-(\d+)`)?/g;
const FAMILY_ROW = /^\| `([A-Z]+)` \|/gm;

function requirementIds(spec: string): string[] {
  return [...spec.matchAll(REQUIREMENT_LINE)].map((match) => match[1]);
}

function coverageRows(traceability: string): string[][] {
  const start = traceability.indexOf("## Coverage map");
  const end = traceability.indexOf("## Release applicability", start);
  if (start < 0 || end < 0) return [];

  return traceability
    .slice(start, end)
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.includes("|---"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells[0] !== "Requirements");
}

function expandRequirementCell(cell: string): { ids: string[]; errors: string[] } {
  const ids: string[] = [];
  const errors: string[] = [];

  for (const match of cell.matchAll(RANGE)) {
    const startFamily = match[1];
    const startNumber = Number(match[2]);
    const endFamily = match[3];
    const endNumber = match[4] === undefined ? undefined : Number(match[4]);
    if (endNumber === undefined) {
      ids.push(`${startFamily}-${String(startNumber).padStart(2, "0")}`);
      continue;
    }
    if (endFamily !== startFamily || endNumber < startNumber) {
      errors.push(`invalid requirement range ${match[0]}`);
      continue;
    }
    for (let current = startNumber; current <= endNumber; current++) {
      ids.push(`${startFamily}-${String(current).padStart(2, "0")}`);
    }
  }
  return { ids, errors };
}

export function validateRequirementsTraceability(spec: string, traceability: string): string[] {
  const errors: string[] = [];
  const ids = requirementIds(spec);
  const specCounts = new Map<string, number>();
  for (const id of ids) specCounts.set(id, (specCounts.get(id) ?? 0) + 1);
  for (const [id, count] of specCounts) {
    if (count !== 1) errors.push(`${id} appears ${count} times in the product spec`);
  }
  const requiredFamilies = new Set(ids.map((id) => id.split("-")[0]));
  const taxonomyFamilies = [...spec.matchAll(FAMILY_ROW)].map((match) => match[1]);
  const taxonomyCounts = new Map<string, number>();
  for (const family of taxonomyFamilies) {
    taxonomyCounts.set(family, (taxonomyCounts.get(family) ?? 0) + 1);
  }
  for (const family of requiredFamilies) {
    const count = taxonomyCounts.get(family) ?? 0;
    if (count === 0) errors.push(`${family} is missing from the requirement taxonomy`);
    if (count > 1) errors.push(`${family} appears ${count} times in the requirement taxonomy`);
  }
  for (const family of taxonomyCounts.keys()) {
    if (!requiredFamilies.has(family)) {
      errors.push(`${family} is defined in the taxonomy but has no requirements`);
    }
  }

  const rows = coverageRows(traceability);
  if (rows.length === 0) return [...errors, "coverage map is missing or empty"];

  const mappedCounts = new Map<string, number>();
  const allowedStatuses = /^(Shipped|Partial|Missing|Blocked)(?:\b|:)/;
  rows.forEach((cells, index) => {
    const row = index + 1;
    if (cells.length !== 6) {
      errors.push(`coverage row ${row} has ${cells.length} cells, expected 6`);
      return;
    }
    const [requirements, perspective, roadmap, owner, evidence, status] = cells;
    const expanded = expandRequirementCell(requirements);
    errors.push(...expanded.errors.map((error) => `coverage row ${row}: ${error}`));
    if (expanded.ids.length === 0) errors.push(`coverage row ${row} has no requirement IDs`);
    if (!perspective) errors.push(`coverage row ${row} has no owning perspective`);
    if (!/(?:phase|release gate)/i.test(roadmap)) {
      errors.push(`coverage row ${row} has no roadmap phase or release gate`);
    }
    if (!owner) errors.push(`coverage row ${row} has no accountable role`);
    if (!evidence) errors.push(`coverage row ${row} has no evidence contract`);
    if (!allowedStatuses.test(status)) errors.push(`coverage row ${row} has invalid status`);
    for (const id of expanded.ids) {
      mappedCounts.set(id, (mappedCounts.get(id) ?? 0) + 1);
    }
  });

  for (const id of specCounts.keys()) {
    const count = mappedCounts.get(id) ?? 0;
    if (count === 0) errors.push(`${id} is missing from the coverage map`);
    if (count > 1) errors.push(`${id} appears ${count} times in the coverage map`);
  }
  for (const id of mappedCounts.keys()) {
    if (!specCounts.has(id)) errors.push(`${id} is mapped but is not a product requirement`);
  }
  return errors;
}
