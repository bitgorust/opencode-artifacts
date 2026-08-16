export type Check =
  | { id: string; kind: "file-exists"; path: string }
  | { id: string; kind: "grep-forbidden"; pattern: string; glob: string }
  | { id: string; kind: "grep-required"; pattern: string; path: string }
  | { id: string; kind: "readme-section"; section: string }
  | { id: string; kind: "readme-one-liner" }
  | { id: string; kind: "readme-links" }
  | { id: string; kind: "requirements-traceability"; spec: string; traceability: string }
  | { id: string; kind: "docs-links" }
  | { id: string; kind: "spec-workflow" }
  | { id: string; kind: "package-field"; field: "version-semver" | "metadata" | "files-skills" };

export const CHECKS: Check[] = [
  { id: "pkg-version-semver", kind: "package-field", field: "version-semver" },
  { id: "pkg-metadata", kind: "package-field", field: "metadata" },
  { id: "pkg-files-skills", kind: "package-field", field: "files-skills" },
  { id: "readme-one-liner", kind: "readme-one-liner" },
  { id: "readme-section-install", kind: "readme-section", section: "## Install" },
  { id: "readme-section-usage", kind: "readme-section", section: "## Usage" },
  { id: "readme-section-limitations", kind: "readme-section", section: "## Limitations" },
  { id: "readme-section-contributing", kind: "readme-section", section: "## Contributing" },
  { id: "readme-section-license", kind: "readme-section", section: "## License" },
  { id: "readme-links", kind: "readme-links" },
  { id: "docs-link-integrity", kind: "docs-links" },
  { id: "no-as-any", kind: "grep-forbidden", pattern: "as any", glob: "src/**/*.ts" },
  { id: "no-ts-ignore", kind: "grep-forbidden", pattern: "@ts-ignore", glob: "src/**/*.ts" },
  { id: "no-ts-expect-error", kind: "grep-forbidden", pattern: "@ts-expect-error", glob: "src/**/*.ts" },
  { id: "csp-no-unsafe-eval", kind: "grep-forbidden", pattern: "unsafe-eval", glob: "src/**/*.ts" },
  { id: "vega-interpreter", kind: "grep-required", pattern: "ast: true", path: "src/render.ts" },
  { id: "file-skill", kind: "file-exists", path: "skills/artifact-pages/SKILL.md" },
  { id: "file-skill-components", kind: "file-exists", path: "skills/artifact-pages/reference/components.md" },
  { id: "file-skill-visuals", kind: "file-exists", path: "skills/artifact-pages/reference/visuals.md" },
  { id: "file-skill-gotchas", kind: "grep-required", pattern: "## Gotchas", path: "skills/artifact-pages/SKILL.md" },
  { id: "file-agent-analyst", kind: "file-exists", path: "agents/artifact-comment-analyst.md" },
  { id: "file-principles", kind: "file-exists", path: "docs/engineering-principles.md" },
  { id: "file-product-spec", kind: "file-exists", path: "docs/product-spec.md" },
  { id: "file-roadmap", kind: "file-exists", path: "docs/roadmap.md" },
  { id: "file-page-quality", kind: "file-exists", path: "docs/page-quality-benchmark.md" },
  {
    id: "file-release-evidence-template",
    kind: "file-exists",
    path: "docs/release-evidence-template.md",
  },
  {
    id: "file-traceability",
    kind: "requirements-traceability",
    spec: "docs/product-spec.md",
    traceability: "docs/requirements-traceability.md",
  },
  { id: "spec-workflow", kind: "spec-workflow" },
  { id: "file-component-spec", kind: "file-exists", path: "docs/component-spec.md" },
  { id: "file-comparison", kind: "file-exists", path: "docs/claude-code-comparison.md" },
  { id: "file-license", kind: "file-exists", path: "LICENSE" },
  { id: "file-agents", kind: "file-exists", path: "AGENTS.md" },
  { id: "file-ci", kind: "file-exists", path: ".github/workflows/ci.yml" },
  { id: "docs-no-version-pins", kind: "grep-forbidden", pattern: "(added v0.", glob: "docs/**/*.md" },
];
