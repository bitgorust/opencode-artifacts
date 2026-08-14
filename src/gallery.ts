import { ARTIFACT_CSS, CSP, emojiFaviconDataUri, escapeHtmlText } from "./render.ts";
import type { Manifest } from "./publisher.ts";

export function renderGallery(manifest: Manifest): string {
  const entries = Object.values(manifest.artifacts).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  const cards = entries
    .map(
      (artifact) => `    <a class="card" href="${artifact.slug}.html">
      <div class="icon">${escapeHtmlText(artifact.icon)}</div>
      <h2>${escapeHtmlText(artifact.title)}</h2>
      <div class="meta">v${artifact.current} · ${artifact.versions.length} version(s) · ${artifact.charts} chart(s)<br>updated ${escapeHtmlText(artifact.updatedAt)}</div>
    </a>`,
    )
    .join("\n");

  const body =
    entries.length === 0
      ? `<main class="artifact-body"><p class="gallery-empty">No artifacts yet.</p></main>`
      : `<main class="gallery">\n${cards}\n  </main>`;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<link rel="icon" href="${emojiFaviconDataUri("🗂️")}">`,
    "<title>Artifacts</title>",
    `<style>${ARTIFACT_CSS}</style>`,
    "</head>",
    "<body>",
    '<header class="artifact-header"><span class="artifact-icon">🗂️</span><h1>Artifacts</h1></header>',
    body,
    "</body>",
    "</html>",
  ].join("\n");
}
