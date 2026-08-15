import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
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

const pkg = JSON.parse(await read("package.json")) as {
  description: string;
  files: string[];
  main?: string;
  types?: string;
  repository?: unknown;
  keywords?: string[];
  version: string;
};

check("package.json version is semver", /^\d+\.\d+\.\d+$/.test(pkg.version));
check("package.json has main/types/repository/keywords", Boolean(pkg.main && pkg.types && pkg.repository && pkg.keywords?.length));
check("package.json files ships dist+skills", pkg.files.includes("dist") && pkg.files.includes("skills"));

const readme = await read("README.md");
const firstLine = readme.split("\n")[2]?.trim() ?? "";
check("README one-liner matches package.json description", firstLine === pkg.description, firstLine.slice(0, 80));
check("README one-liner under 120 chars", firstLine.length <= 120, `${firstLine.length} chars`);
for (const section of ["## Install", "## Usage", "## Limitations", "## Contributing", "## License"]) {
  check(`README has "${section}"`, readme.includes(section));
}
check("README has a TOC past 100 lines", readme.split("\n").length < 100 || readme.includes("## Contents"));
check("README ends with License section", readme.trimEnd().endsWith("bitgorust") || /## License[\s\S]*$/.test(readme.trimEnd().split("## ").at(-1) ?? ""));

const linkRe = /\[[^\]]+\]\(((?:docs|examples|skills)\/[^)]+)\)/g;
for (const match of readme.matchAll(linkRe)) {
  const target = match[1].split("#")[0];
  check(`README link resolves: ${target}`, existsSync(join(root, target)));
}

for (const required of [
  "skills/artifact-pages/SKILL.md",
  "skills/artifact-pages/reference/components.md",
  "skills/artifact-pages/reference/visuals.md",
  "docs/engineering-principles.md",
  "docs/component-spec.md",
  "docs/claude-code-comparison.md",
  "LICENSE",
  "AGENTS.md",
  ".github/workflows/ci.yml",
]) {
  check(`exists: ${required}`, existsSync(join(root, required)));
}

for (const banned of ["as any", "@ts-ignore", "@ts-expect-error"]) {
  const srcFiles = await read("src/render.ts").then(async () => {
    const { readdir } = await import("node:fs/promises");
    const names = (await readdir(join(root, "src"), { recursive: true })).filter((n) => n.endsWith(".ts"));
    return names;
  });
  let clean = true;
  for (const name of srcFiles) {
    const content = await read(join("src", name));
    const codeOnly = name === "render.ts" ? content.split("const BOOT =")[0] : content;
    if (codeOnly.includes(banned)) {
      clean = false;
      console.error(`  in src/${name}`);
    }
  }
  check(`no "${banned}" in src/`, clean);
}

const render = await read("src/render.ts");
check("CSP forbids unsafe-eval", !render.includes("unsafe-eval"));
check("vega runs in interpreter mode", render.includes("ast: true"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
