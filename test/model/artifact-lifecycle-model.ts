import { createHash } from "node:crypto";

export interface ModeledArtifact {
  id: string;
  slug: string;
  active: boolean;
  head: number;
  history: string[];
}

export interface ModeledArchivePreview {
  id: string;
  head: number;
  scope: string;
}

function scope(artifact: ModeledArtifact): string {
  return createHash("sha256").update(JSON.stringify({ id: artifact.id, slug: artifact.slug, head: artifact.head, active: artifact.active })).digest("hex");
}

export function modelPreview(artifact: ModeledArtifact): ModeledArchivePreview {
  return { id: artifact.id, head: artifact.head, scope: scope(artifact) };
}

export function modelRestore(artifact: ModeledArtifact, from: number, expectedHead: number): { artifact: ModeledArtifact; result: "committed" | "stale" | "missing" } {
  if (artifact.head !== expectedHead) return { artifact, result: "stale" };
  const bytes = artifact.history[from - 1];
  if (bytes === undefined) return { artifact, result: "missing" };
  return { artifact: { ...artifact, head: artifact.head + 1, history: [...artifact.history, bytes] }, result: "committed" };
}

export function modelArchive(artifact: ModeledArtifact, preview: ModeledArchivePreview): { artifact: ModeledArtifact; result: "committed" | "stale" } {
  if (!artifact.active || preview.id !== artifact.id || preview.head !== artifact.head || preview.scope !== scope(artifact)) return { artifact, result: "stale" };
  return { artifact: { ...artifact, active: false }, result: "committed" };
}

export function modelUnarchive(artifact: ModeledArtifact, occupiedSlugs: Set<string>, explicitSlug?: string): { artifact: ModeledArtifact; result: "committed" | "conflict" } {
  const slug = explicitSlug ?? artifact.slug;
  if (artifact.active || occupiedSlugs.has(slug)) return { artifact, result: "conflict" };
  return { artifact: { ...artifact, active: true, slug }, result: "committed" };
}
