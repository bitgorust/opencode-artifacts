import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export interface SensitiveFinding {
  kind: string;
  match: string;
}

const PATTERNS: ReadonlyArray<{ kind: string; re: RegExp }> = [
  { kind: "aws-access-key", re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { kind: "github-token", re: /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { kind: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { kind: "openai-key", re: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { kind: "private-key", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { kind: "bearer-token", re: /[Aa]uthorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]{16,}/ },
  { kind: "password-literal", re: /(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*["'][^"'\s]{8,}["']/i },
];

export function scanSensitive(content: string): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  for (const { kind, re } of PATTERNS) {
    const match = content.match(re);
    if (match) {
      findings.push({ kind, match: match[0].slice(0, 12) + "…" });
    }
  }
  return findings;
}

export function formatFindings(findings: SensitiveFinding[]): string {
  return findings.map((f) => `${f.kind} (${f.match})`).join(", ");
}

export interface SensitiveFileFinding {
  file: string;
  findings: SensitiveFinding[];
}

export async function scanArtifactDirectory(dir: string): Promise<SensitiveFileFinding[]> {
  const results: SensitiveFileFinding[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const findings = scanSensitive(await readFile(join(dir, entry.name), "utf8"));
    if (findings.length > 0) results.push({ file: entry.name, findings });
  }
  return results;
}

export async function assertSafeDeployment(
  dir: string,
  configuration: string,
  allowSensitive = false,
): Promise<void> {
  if (allowSensitive) return;
  const results = await scanArtifactDirectory(dir);
  const configurationFindings = scanSensitive(configuration);
  if (configurationFindings.length > 0) {
    results.push({ file: "<deployment-config>", findings: configurationFindings });
  }
  if (results.length === 0) return;
  const details = results
    .map(({ file, findings }) => `${file}: ${formatFindings(findings)}`)
    .join("; ");
  throw new Error(
    `deploy blocked: credential-looking strings found: ${details}. Re-run with --force to deploy anyway.`,
  );
}
