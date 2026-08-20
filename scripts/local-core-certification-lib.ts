export const LOCAL_CORE_REQUIREMENTS = [
  "code-tests",
  "package-host",
  "browser-accessibility",
  "migrations",
  "security-privacy",
  "performance",
  "support-matrix",
  "page-quality",
  "first-use",
  "comprehension",
  "audit-license-sbom",
  "integrity-provenance",
  "claims-rollback",
] as const;

export const LOCAL_CORE_SIGNOFFS = ["release", "security", "support"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string, errors: string[]): void {
  for (const key of keys) if (!(key in value)) errors.push(`${path} is missing ${key}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${path} has unexpected field ${key}`);
}

function text(value: unknown, path: string, errors: string[], max = 500): value is string {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    errors.push(`${path} must be non-empty text of at most ${max} characters`);
    return false;
  }
  return true;
}

function sha256(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    errors.push(`${path} must be 64 lowercase hexadecimal characters`);
    return false;
  }
  return true;
}

function timestamp(value: unknown, path: string, errors: string[]): value is string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be an ISO timestamp`);
    return false;
  }
  return true;
}

const RECORD_KEYS = ["schemaVersion", "recordId", "level", "decision", "candidate", "requirements", "signoffs", "blockers", "claims", "providerMutationCount"];

export function validateCertificationRecord(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["record must be an object"];
  exactKeys(value, RECORD_KEYS, "record", errors);
  if (value["schemaVersion"] !== 1) errors.push("record.schemaVersion must be 1");
  text(value["recordId"], "record.recordId", errors, 120);
  if (value["level"] !== "local-artifact-core") errors.push("record.level must be local-artifact-core");
  if (!['pending', 'refused', 'certified'].includes(String(value["decision"]))) errors.push("record.decision is invalid");
  if (value["providerMutationCount"] !== 0) errors.push("record.providerMutationCount must remain zero");

  const candidate = value["candidate"];
  if (!isRecord(candidate)) errors.push("record.candidate must be an object");
  else {
    const fields = ["status", "commit", "version", "tarball", "sha256", "sri", "corpusVersions"];
    exactKeys(candidate, fields, "record.candidate", errors);
    if (candidate["status"] !== "unfrozen" && candidate["status"] !== "frozen") errors.push("record.candidate.status is invalid");
    if (candidate["status"] === "unfrozen") {
      for (const field of fields.slice(1)) if (candidate[field] !== null) errors.push(`record.candidate.${field} must be null while unfrozen`);
    } else {
      if (typeof candidate["commit"] !== "string" || !/^[a-f0-9]{40}$/.test(candidate["commit"])) errors.push("record.candidate.commit must be a full Git SHA");
      text(candidate["version"], "record.candidate.version", errors, 80);
      text(candidate["tarball"], "record.candidate.tarball", errors, 200);
      sha256(candidate["sha256"], "record.candidate.sha256", errors);
      if (typeof candidate["sri"] !== "string" || !/^sha512-[A-Za-z0-9+/]+=*$/.test(candidate["sri"])) errors.push("record.candidate.sri must be SHA-512 SRI");
      const corpusVersions = candidate["corpusVersions"];
      if (!isRecord(corpusVersions)) errors.push("record.candidate.corpusVersions must be an object");
      else {
        exactKeys(corpusVersions, ["pageQuality", "journey"], "record.candidate.corpusVersions", errors);
        if (corpusVersions["pageQuality"] !== "page-quality-v1") errors.push("record.candidate.corpusVersions.pageQuality must be page-quality-v1");
        if (corpusVersions["journey"] !== 1) errors.push("record.candidate.corpusVersions.journey must be 1");
      }
    }
  }

  const requirementIds = new Set<string>();
  if (!Array.isArray(value["requirements"]) || value["requirements"].length !== LOCAL_CORE_REQUIREMENTS.length) errors.push("record.requirements must contain every canonical row exactly once");
  else for (let index = 0; index < value["requirements"].length; index++) {
    const row = value["requirements"][index];
    const path = `record.requirements[${index}]`;
    if (!isRecord(row)) { errors.push(`${path} must be an object`); continue; }
    exactKeys(row, ["id", "status", "applicabilityReason", "evidence"], path, errors);
    if (typeof row["id"] !== "string" || !LOCAL_CORE_REQUIREMENTS.includes(row["id"] as typeof LOCAL_CORE_REQUIREMENTS[number])) errors.push(`${path}.id is not canonical`);
    else if (requirementIds.has(row["id"])) errors.push(`${path}.id is duplicated`);
    else requirementIds.add(row["id"]);
    if (!['pending', 'pass', 'fail', 'not-applicable'].includes(String(row["status"]))) errors.push(`${path}.status is invalid`);
    if (row["status"] === "not-applicable") errors.push(`${path}.status cannot be not-applicable for Local artifact core`);
    if (row["applicabilityReason"] !== null) text(row["applicabilityReason"], `${path}.applicabilityReason`, errors);
    if (!Array.isArray(row["evidence"]) || row["evidence"].length > 30) errors.push(`${path}.evidence must be an array of at most 30 records`);
    else {
      if (row["status"] === "pass" && row["evidence"].length === 0) errors.push(`${path}.evidence is required for pass`);
      for (let evidenceIndex = 0; evidenceIndex < row["evidence"].length; evidenceIndex++) {
        const evidence = row["evidence"][evidenceIndex];
        const evidencePath = `${path}.evidence[${evidenceIndex}]`;
        if (!isRecord(evidence)) { errors.push(`${evidencePath} must be an object`); continue; }
        exactKeys(evidence, ["path", "date", "owner", "result", "candidateSha256", "scope", "environment"], evidencePath, errors);
        for (const field of ["path", "owner", "scope", "environment"]) text(evidence[field], `${evidencePath}.${field}`, errors);
        if (typeof evidence["date"] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(evidence["date"])) errors.push(`${evidencePath}.date must be an ISO date`);
        if (evidence["result"] !== "pass" && evidence["result"] !== "fail") errors.push(`${evidencePath}.result must be pass or fail`);
        if (evidence["candidateSha256"] !== "non-byte-bound") sha256(evidence["candidateSha256"], `${evidencePath}.candidateSha256`, errors);
      }
    }
  }
  for (const id of LOCAL_CORE_REQUIREMENTS) if (!requirementIds.has(id)) errors.push(`record.requirements is missing ${id}`);

  const signoffRoles = new Set<string>();
  if (!Array.isArray(value["signoffs"]) || value["signoffs"].length !== LOCAL_CORE_SIGNOFFS.length) errors.push("record.signoffs must contain release, security, and support");
  else for (let index = 0; index < value["signoffs"].length; index++) {
    const signoff = value["signoffs"][index];
    const path = `record.signoffs[${index}]`;
    if (!isRecord(signoff)) { errors.push(`${path} must be an object`); continue; }
    exactKeys(signoff, ["role", "status", "by", "at"], path, errors);
    if (typeof signoff["role"] !== "string" || !LOCAL_CORE_SIGNOFFS.includes(signoff["role"] as typeof LOCAL_CORE_SIGNOFFS[number])) errors.push(`${path}.role is invalid`);
    else if (signoffRoles.has(signoff["role"])) errors.push(`${path}.role is duplicated`);
    else signoffRoles.add(signoff["role"]);
    if (signoff["status"] !== "pending" && signoff["status"] !== "approved") errors.push(`${path}.status is invalid`);
    if (signoff["status"] === "approved") { text(signoff["by"], `${path}.by`, errors, 120); timestamp(signoff["at"], `${path}.at`, errors); }
    else if (signoff["by"] !== null || signoff["at"] !== null) errors.push(`${path} pending signoff must not name an approver or time`);
  }

  if (!Array.isArray(value["blockers"]) || !value["blockers"].every((item) => typeof item === "string" && item.trim() !== "") || value["blockers"].length > 50) errors.push("record.blockers must be at most 50 non-empty strings");
  const claims = value["claims"];
  if (!isRecord(claims)) errors.push("record.claims must be an object");
  else {
    exactKeys(claims, ["certification", "equalOrBetter", "supportedPlatformIds"], "record.claims", errors);
    for (const field of ["certification", "equalOrBetter"]) if (typeof claims[field] !== "boolean") errors.push(`record.claims.${field} must be boolean`);
    if (!Array.isArray(claims["supportedPlatformIds"]) || !claims["supportedPlatformIds"].every((id) => typeof id === "string" && id.trim() !== "") || new Set(claims["supportedPlatformIds"]).size !== claims["supportedPlatformIds"].length) errors.push("record.claims.supportedPlatformIds must be unique non-empty strings");
  }
  return errors;
}

export function certificationFailures(value: unknown): string[] {
  const validation = validateCertificationRecord(value);
  if (validation.length > 0) return validation.map((error) => `invalid record: ${error}`);
  if (!isRecord(value)) return ["invalid record"];
  const failures: string[] = [];
  const candidate = value["candidate"];
  if (!isRecord(candidate) || candidate["status"] !== "frozen") failures.push("candidate is not frozen");
  const candidateSha = isRecord(candidate) && typeof candidate["sha256"] === "string" ? candidate["sha256"] : null;
  for (const row of Array.isArray(value["requirements"]) ? value["requirements"].filter(isRecord) : []) {
    if (row["status"] !== "pass") failures.push(`requirement is not pass: ${row["id"]}`);
    for (const evidence of Array.isArray(row["evidence"]) ? row["evidence"].filter(isRecord) : []) {
      if (evidence["result"] !== "pass") failures.push(`evidence is not pass: ${row["id"]}`);
      if (evidence["candidateSha256"] !== "non-byte-bound" && evidence["candidateSha256"] !== candidateSha) failures.push(`evidence candidate mismatch: ${row["id"]}`);
    }
  }
  for (const signoff of Array.isArray(value["signoffs"]) ? value["signoffs"].filter(isRecord) : []) if (signoff["status"] !== "approved") failures.push(`signoff is not approved: ${signoff["role"]}`);
  if (Array.isArray(value["blockers"]) && value["blockers"].length > 0) failures.push("unresolved blockers remain");
  const claims = value["claims"];
  if (!isRecord(claims) || claims["certification"] !== true) failures.push("certification claim is not enabled");
  if (!isRecord(claims) || claims["equalOrBetter"] !== true) failures.push("equal-or-better claim is not backed by the required page-quality row");
  if (!isRecord(claims) || !Array.isArray(claims["supportedPlatformIds"]) || claims["supportedPlatformIds"].length === 0) failures.push("no supported platform is named");
  if (value["providerMutationCount"] !== 0) failures.push("provider mutation is forbidden");
  return failures;
}

export function transitionCertification(value: unknown, target: "refused" | "certified"): { decision: "refused" | "certified"; failures: string[]; providerMutations: 0 } {
  const failures = certificationFailures(value);
  if (target === "certified" && failures.length > 0) return { decision: "refused", failures, providerMutations: 0 };
  return { decision: target, failures: target === "refused" ? failures : [], providerMutations: 0 };
}
