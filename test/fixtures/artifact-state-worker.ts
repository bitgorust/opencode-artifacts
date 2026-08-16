import { access, writeFile } from "node:fs/promises";
import { ArtifactStateConflictError, replaceArtifactState } from "../../src/artifact-state.ts";

async function waitFor(path: string): Promise<void> {
  for (;;) {
    try {
      await access(path);
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 5));
    }
  }
}

const [root, artifactId, operationId, answer, readyPath, goPath] = process.argv.slice(2);
if (!root || !artifactId || !operationId || !answer || !readyPath || !goPath) {
  throw new Error("missing artifact state worker argument");
}
await writeFile(readyPath, "ready", "utf8");
await waitFor(goPath);
try {
  const result = await replaceArtifactState({
    root,
    artifactId,
    kind: "decisions",
    expectedRevision: 0,
    operationId,
    payload: { answers: { choice: answer } },
    now: "2026-08-16T20:00:00Z",
  });
  process.stdout.write(`${JSON.stringify({ status: result.status, revision: result.revision })}\n`);
} catch (error) {
  if (error instanceof ArtifactStateConflictError) {
    process.stdout.write(`${JSON.stringify({ status: "stale", revision: error.selectedRevision })}\n`);
  } else {
    throw error;
  }
}
