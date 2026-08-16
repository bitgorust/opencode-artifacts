import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CHECKS, type Check } from "./checks.ts";
import { validateRequirementsTraceability } from "./requirements-traceability.ts";
import { validateLocalDocumentationLinks } from "./documentation-links.ts";
import { validateSpecRepository } from "./spec-workflow-lib.ts";

const root = join(import.meta.dirname, "..");
let failures = 0;

function report(ok: boolean, name: string, detail?: string): void {
  if (ok) {
    console.log(`ok - ${name}`);
  } else {
    failures++;
    console.error(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

async function read(path: string): Promise<string> {
  return readFile(join(root, path), "utf8");
}

async function evaluate(check: Check): Promise<void> {
  switch (check.kind) {
    case "file-exists":
      report(existsSync(join(root, check.path)), `${check.id}: ${check.path}`);
      return;
    case "grep-forbidden": {
      const [dir, , ext] = check.glob.split("/");
      const suffix = ext.replace("*", "");
      const files = (await readdir(join(root, dir), { recursive: true }))
        .filter((n) => n.endsWith(suffix))
        .map((n) => join(dir, n));
      let hit: string | undefined;
      for (const file of files) {
        const content = await read(file);
        const scanned = check.pattern === "unsafe-eval" ? content : content.split("const BOOT =")[0];
        if (scanned.includes(check.pattern)) hit = file;
      }
      report(hit === undefined, check.id, hit);
      return;
    }
    case "grep-required":
      report((await read(check.path)).includes(check.pattern), check.id);
      return;
    case "readme-section":
      report((await read("README.md")).includes(check.section), check.id);
      return;
    case "readme-one-liner": {
      const pkg = JSON.parse(await read("package.json")) as { description: string };
      const line = (await read("README.md")).split("\n")[2]?.trim() ?? "";
      report(
        line === pkg.description && line.length <= 120,
        check.id,
        line === pkg.description ? `${line.length} chars` : "mismatch with package.json description",
      );
      return;
    }
    case "readme-links": {
      const readme = await read("README.md");
      const linkRe = /\[[^\]]+\]\(((?:docs|examples|skills|specs)\/[^)]+)\)/g;
      for (const match of readme.matchAll(linkRe)) {
        const target = match[1].split("#")[0];
        report(existsSync(join(root, target)), `readme-link: ${target}`);
      }
      return;
    }
    case "requirements-traceability": {
      const errors = validateRequirementsTraceability(
        await read(check.spec),
        await read(check.traceability),
      );
      report(errors.length === 0, check.id, errors.join("; "));
      return;
    }
    case "docs-links": {
      const errors = await validateLocalDocumentationLinks(root);
      report(
        errors.length === 0,
        check.id,
        errors
          .map((error) => `${error.sourcePath}:${error.line} ${error.target} [${error.reason}]`)
          .join("; "),
      );
      return;
    }
    case "spec-workflow": {
      const errors = await validateSpecRepository(root);
      report(errors.length === 0, check.id, errors.join("; "));
      return;
    }
    case "package-field": {
      const pkg = JSON.parse(await read("package.json")) as Record<string, unknown> & {
        files: string[];
        keywords?: string[];
      };
      if (check.field === "version-semver") {
        report(/^\d+\.\d+\.\d+$/.test(String(pkg["version"])), check.id);
      } else if (check.field === "metadata") {
        report(
          Boolean(pkg["main"] && pkg["types"] && pkg["repository"] && pkg.keywords?.length),
          check.id,
        );
      } else {
        report(pkg.files.includes("dist") && pkg.files.includes("skills"), check.id);
      }
      return;
    }
  }
}

for (const check of CHECKS) {
  await evaluate(check);
}

const principles = await read("docs/engineering-principles.md");
const tagged = new Set([...principles.matchAll(/\[check:([a-z0-9-]+)\]/g)].map((m) => m[1]));
const registered = new Set(CHECKS.map((c) => c.id));
for (const id of tagged) {
  report(registered.has(id), `principle tag has a check: ${id}`);
}
for (const id of registered) {
  report(tagged.has(id), `check is tagged in principles: ${id}`);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log(`\nall checks passed (${CHECKS.length} registered, ${tagged.size} tagged principles)`);
