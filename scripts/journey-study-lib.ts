function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unexpectedKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${path} has unexpected field ${key}`);
  }
}

function nonEmptyString(value: unknown, path: string, errors: string[], max = 500): value is string {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    errors.push(`${path} must be a non-empty string of at most ${max} characters`);
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

function boolean(value: unknown, path: string, errors: string[]): value is boolean {
  if (typeof value !== "boolean") {
    errors.push(`${path} must be boolean`);
    return false;
  }
  return true;
}

function boundedNumber(
  value: unknown,
  path: string,
  errors: string[],
  minimum: number,
  maximum: number,
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    errors.push(`${path} must be between ${minimum} and ${maximum}`);
    return false;
  }
  return true;
}

export function validateJourneyCorpus(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["corpus must be an object"];
  unexpectedKeys(value, ["schemaVersion", "corpusVersion", "journeys", "fixtures"], "corpus", errors);
  if (value["schemaVersion"] !== 1) errors.push("corpus.schemaVersion must be 1");
  if (value["corpusVersion"] !== 1) errors.push("corpus.corpusVersion must be 1");
  if (!Array.isArray(value["journeys"]) || value["journeys"].length < 4) {
    errors.push("corpus.journeys must contain at least four journeys");
  } else {
    const ids = new Set<string>();
    const requiredStages = new Set(["create", "revise", "review", "share"]);
    for (let index = 0; index < value["journeys"].length; index++) {
      const journey = value["journeys"][index];
      const path = `corpus.journeys[${index}]`;
      if (!isRecord(journey)) {
        errors.push(`${path} must be an object`);
        continue;
      }
      unexpectedKeys(
        journey,
        ["id", "stage", "status", "purpose", "preconditions", "success", "failure", "decisionState"],
        path,
        errors,
      );
      if (nonEmptyString(journey["id"], `${path}.id`, errors, 80)) {
        if (ids.has(journey["id"])) errors.push(`${path}.id is duplicated`);
        ids.add(journey["id"]);
      }
      if (nonEmptyString(journey["stage"], `${path}.stage`, errors, 80)) {
        requiredStages.delete(journey["stage"]);
      }
      for (const field of ["status", "purpose", "success", "failure"]) {
        nonEmptyString(journey[field], `${path}.${field}`, errors);
      }
      for (const field of ["preconditions", "decisionState"]) {
        const entries = journey[field];
        if (!Array.isArray(entries) || entries.length === 0) {
          errors.push(`${path}.${field} must be a non-empty string array`);
        } else {
          for (let entry = 0; entry < entries.length; entry++) {
            nonEmptyString(entries[entry], `${path}.${field}[${entry}]`, errors);
          }
        }
      }
    }
    if (requiredStages.size > 0) {
      errors.push(`corpus.journeys is missing required stages: ${[...requiredStages].join(", ")}`);
    }
  }
  if (!Array.isArray(value["fixtures"]) || value["fixtures"].length === 0) {
    errors.push("corpus.fixtures must be a non-empty array");
  } else {
    const ids = new Set<string>();
    for (let index = 0; index < value["fixtures"].length; index++) {
      const fixture = value["fixtures"][index];
      const path = `corpus.fixtures[${index}]`;
      if (!isRecord(fixture)) {
        errors.push(`${path} must be an object`);
        continue;
      }
      unexpectedKeys(fixture, ["id", "source", "rubric"], path, errors);
      if (nonEmptyString(fixture["id"], `${path}.id`, errors, 80)) {
        if (ids.has(fixture["id"])) errors.push(`${path}.id is duplicated`);
        ids.add(fixture["id"]);
      }
      nonEmptyString(fixture["source"], `${path}.source`, errors, 300);
      const rubric = fixture["rubric"];
      if (!isRecord(rubric)) {
        errors.push(`${path}.rubric must be an object`);
      } else {
        unexpectedKeys(rubric, ["purpose", "primaryFinding", "provenance", "nextAction"], `${path}.rubric`, errors);
        for (const field of ["purpose", "primaryFinding", "provenance", "nextAction"]) {
          nonEmptyString(rubric[field], `${path}.rubric.${field}`, errors);
        }
      }
    }
  }
  return errors;
}

function fixtureIds(corpus: unknown): Set<string> {
  if (!isRecord(corpus) || !Array.isArray(corpus["fixtures"])) return new Set();
  return new Set(
    corpus["fixtures"]
      .filter(isRecord)
      .map((fixture) => fixture["id"])
      .filter((id): id is string => typeof id === "string"),
  );
}

function validateConsent(
  value: unknown,
  synthetic: boolean,
  path: string,
  errors: string[],
): void {
  if (synthetic && value === null) return;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object for real records and null only for synthetic records`);
    return;
  }
  unexpectedKeys(value, ["given", "at", "protocolVersion", "withdrawnAt"], path, errors);
  if (value["given"] !== true) errors.push(`${path}.given must be true`);
  timestamp(value["at"], `${path}.at`, errors);
  if (value["protocolVersion"] !== 1) errors.push(`${path}.protocolVersion must be 1`);
  if (value["withdrawnAt"] !== null) timestamp(value["withdrawnAt"], `${path}.withdrawnAt`, errors);
}

function validatePlatform(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const fields = ["id", "os", "osVersion", "nodeVersion", "opencodeVersion", "browser", "browserVersion"];
  unexpectedKeys(value, fields, path, errors);
  for (const field of fields) nonEmptyString(value[field], `${path}.${field}`, errors, 120);
}

function validateFirstUse(value: unknown, path: string, errors: string[]): void {
  if (value === null) return;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object or null`);
    return;
  }
  unexpectedKeys(
    value,
    ["startedAt", "endedAt", "elapsedSeconds", "completed", "readmeOnly", "repositoryCheckout", "hostingAccount", "maintainerAssistance", "failureStep"],
    path,
    errors,
  );
  const startOk = timestamp(value["startedAt"], `${path}.startedAt`, errors);
  const endOk = timestamp(value["endedAt"], `${path}.endedAt`, errors);
  const elapsedOk = boundedNumber(value["elapsedSeconds"], `${path}.elapsedSeconds`, errors, 0, 3600);
  for (const field of ["completed", "readmeOnly", "repositoryCheckout", "hostingAccount", "maintainerAssistance"]) {
    boolean(value[field], `${path}.${field}`, errors);
  }
  if (value["failureStep"] !== null) nonEmptyString(value["failureStep"], `${path}.failureStep`, errors, 300);
  if (startOk && endOk && elapsedOk) {
    const observed = (Date.parse(value["endedAt"]) - Date.parse(value["startedAt"])) / 1000;
    if (observed < 0 || Math.abs(observed - value["elapsedSeconds"]) > 2) {
      errors.push(`${path}.elapsedSeconds must match the bounded timestamps within two seconds`);
    }
  }
}

function validateComprehension(
  value: unknown,
  knownFixtures: Set<string>,
  path: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  unexpectedKeys(
    value,
    ["fixtureId", "artifactSha256", "startedAt", "elapsedSeconds", "maintainerAssistance", "answers", "scores"],
    path,
    errors,
  );
  if (nonEmptyString(value["fixtureId"], `${path}.fixtureId`, errors, 80) && !knownFixtures.has(value["fixtureId"])) {
    errors.push(`${path}.fixtureId is not in the approved corpus`);
  }
  if (typeof value["artifactSha256"] !== "string" || !/^[a-f0-9]{64}$/.test(value["artifactSha256"])) {
    errors.push(`${path}.artifactSha256 must be 64 lowercase hexadecimal characters`);
  }
  timestamp(value["startedAt"], `${path}.startedAt`, errors);
  boundedNumber(value["elapsedSeconds"], `${path}.elapsedSeconds`, errors, 0, 600);
  boolean(value["maintainerAssistance"], `${path}.maintainerAssistance`, errors);
  for (const group of ["answers", "scores"]) {
    const detail = value[group];
    if (!isRecord(detail)) {
      errors.push(`${path}.${group} must be an object`);
      continue;
    }
    const fields = ["purpose", "primaryFinding", "provenance", "nextAction"];
    unexpectedKeys(detail, fields, `${path}.${group}`, errors);
    for (const field of fields) {
      if (group === "answers") nonEmptyString(detail[field], `${path}.${group}.${field}`, errors);
      else boolean(detail[field], `${path}.${group}.${field}`, errors);
    }
  }
}

export function validateJourneyStudy(value: unknown, corpus: unknown): string[] {
  const errors = validateJourneyCorpus(corpus).map((error) => `invalid corpus: ${error}`);
  if (!isRecord(value)) return [...errors, "study must be an object"];
  unexpectedKeys(value, ["schemaVersion", "studyId", "corpusVersion", "release", "claimedPlatformIds", "records"], "study", errors);
  if (value["schemaVersion"] !== 1) errors.push("study.schemaVersion must be 1");
  nonEmptyString(value["studyId"], "study.studyId", errors, 120);
  if (!isRecord(corpus) || value["corpusVersion"] !== corpus["corpusVersion"]) {
    errors.push("study.corpusVersion must equal the approved corpus version");
  }
  const release = value["release"];
  if (!isRecord(release)) {
    errors.push("study.release must be an object");
  } else {
    unexpectedKeys(release, ["package", "version", "integrity"], "study.release", errors);
    if (release["package"] !== "opencode-artifacts") errors.push("study.release.package must be opencode-artifacts");
    nonEmptyString(release["version"], "study.release.version", errors, 80);
    if (typeof release["integrity"] !== "string" || !/^(sha512-|sha256:)[A-Za-z0-9+/=:.-]+$/.test(release["integrity"])) {
      errors.push("study.release.integrity must be a sha512 SRI or sha256 digest");
    }
  }
  const claimed = value["claimedPlatformIds"];
  if (!Array.isArray(claimed) || !claimed.every((id) => typeof id === "string" && id.trim() !== "")) {
    errors.push("study.claimedPlatformIds must be a string array");
  } else if (new Set(claimed).size !== claimed.length) {
    errors.push("study.claimedPlatformIds contains duplicates");
  }
  if (!Array.isArray(value["records"])) {
    errors.push("study.records must be an array");
    return errors;
  }
  if (value["records"].length > 100) errors.push("study.records cannot exceed 100 records");
  const ids = new Set<string>();
  const knownFixtures = fixtureIds(corpus);
  for (let index = 0; index < value["records"].length; index++) {
    const record = value["records"][index];
    const path = `study.records[${index}]`;
    if (!isRecord(record)) {
      errors.push(`${path} must be an object`);
      continue;
    }
    unexpectedKeys(
      record,
      ["participantId", "participantRole", "representative", "firstTimeUser", "conflict", "synthetic", "consent", "platform", "firstUse", "comprehension"],
      path,
      errors,
    );
    const synthetic = record["synthetic"] === true;
    if (!boolean(record["synthetic"], `${path}.synthetic`, errors)) continue;
    if (nonEmptyString(record["participantId"], `${path}.participantId`, errors, 80)) {
      const pattern = synthetic ? /^synthetic-[a-z0-9-]+$/ : /^p-[a-z0-9]{6,}$/;
      if (!pattern.test(record["participantId"])) errors.push(`${path}.participantId is not pseudonymous for its record type`);
      if (ids.has(record["participantId"])) errors.push(`${path}.participantId is duplicated`);
      ids.add(record["participantId"]);
    }
    if (record["participantRole"] !== "primary" && record["participantRole"] !== "secondary") {
      errors.push(`${path}.participantRole must be primary or secondary`);
    }
    boolean(record["representative"], `${path}.representative`, errors);
    boolean(record["firstTimeUser"], `${path}.firstTimeUser`, errors);
    if (!["none", "maintainer", "contributor", "rubric-reviewer", "other"].includes(String(record["conflict"]))) {
      errors.push(`${path}.conflict is invalid`);
    }
    validateConsent(record["consent"], synthetic, `${path}.consent`, errors);
    validatePlatform(record["platform"], `${path}.platform`, errors);
    validateFirstUse(record["firstUse"], `${path}.firstUse`, errors);
    validateComprehension(record["comprehension"], knownFixtures, `${path}.comprehension`, errors);
  }
  return errors;
}

function realEligible(record: Record<string, unknown>): boolean {
  if (record["synthetic"] === true || record["participantRole"] !== "primary") return false;
  if (record["representative"] !== true || record["conflict"] !== "none") return false;
  const consent = record["consent"];
  return isRecord(consent) && consent["given"] === true && consent["withdrawnAt"] === null;
}

function firstUsePass(record: Record<string, unknown>): boolean {
  const result = record["firstUse"];
  return record["firstTimeUser"] === true && isRecord(result) &&
    result["completed"] === true && result["readmeOnly"] === true &&
    result["repositoryCheckout"] === false && result["hostingAccount"] === false &&
    result["maintainerAssistance"] === false && typeof result["elapsedSeconds"] === "number" &&
    result["elapsedSeconds"] <= 600;
}

function comprehensionPass(record: Record<string, unknown>): boolean {
  const result = record["comprehension"];
  if (!isRecord(result) || result["maintainerAssistance"] !== false ||
      typeof result["elapsedSeconds"] !== "number" || result["elapsedSeconds"] > 60) return false;
  const scores = result["scores"];
  return isRecord(scores) && ["purpose", "primaryFinding", "provenance", "nextAction"]
    .every((field) => scores[field] === true);
}

export interface JourneyStudySummary {
  studyId: string;
  corpusVersion: number;
  release: unknown;
  totalRecords: number;
  excluded: { synthetic: number; withdrawn: number; conflict: number; nonRepresentative: number; secondary: number };
  firstUse: {
    status: "pass" | "fail" | "incomplete";
    claimedPlatforms: number;
    coveredPlatforms: number;
    eligibleRuns: number;
    passingRuns: number;
    failingRuns: number;
    missingPlatformIds: string[];
  };
  comprehension: {
    status: "pass" | "fail" | "incomplete";
    eligibleParticipants: number;
    passingParticipants: number;
    failingParticipants: number;
    passRate: number | null;
    threshold: number;
    minimumParticipants: number;
    fixtureDistribution: Record<string, number>;
  };
}

export function summarizeJourneyStudy(value: unknown, corpus: unknown): JourneyStudySummary {
  const errors = validateJourneyStudy(value, corpus);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  if (!isRecord(value) || !Array.isArray(value["records"]) || !Array.isArray(value["claimedPlatformIds"])) {
    throw new Error("validated study shape was lost");
  }
  const records = value["records"].filter(isRecord);
  const eligible = records.filter(realEligible);
  const claimedPlatforms = value["claimedPlatformIds"].filter((id): id is string => typeof id === "string");
  const firstUseRecords = eligible.filter((record) => record["firstTimeUser"] === true && record["firstUse"] !== null);
  const coveredPlatforms = new Set<string>();
  const passedPlatforms = new Set<string>();
  for (const record of firstUseRecords) {
    const platform = record["platform"];
    if (!isRecord(platform) || typeof platform["id"] !== "string") continue;
    coveredPlatforms.add(platform["id"]);
    if (firstUsePass(record)) passedPlatforms.add(platform["id"]);
  }
  const missingPlatformIds = claimedPlatforms.filter((id) => !passedPlatforms.has(id));
  const firstUseStatus = claimedPlatforms.length === 0 || claimedPlatforms.some((id) => !coveredPlatforms.has(id))
    ? "incomplete"
    : missingPlatformIds.length > 0 ? "fail" : "pass";

  const passing = eligible.filter(comprehensionPass);
  const passRate = eligible.length === 0 ? null : passing.length / eligible.length;
  const comprehensionStatus = eligible.length < 10 ? "incomplete" : passRate !== null && passRate >= 0.9 ? "pass" : "fail";
  const fixtureDistribution: Record<string, number> = {};
  for (const record of eligible) {
    const result = record["comprehension"];
    if (isRecord(result) && typeof result["fixtureId"] === "string") {
      fixtureDistribution[result["fixtureId"]] = (fixtureDistribution[result["fixtureId"]] ?? 0) + 1;
    }
  }
  return {
    studyId: String(value["studyId"]),
    corpusVersion: Number(value["corpusVersion"]),
    release: value["release"],
    totalRecords: records.length,
    excluded: {
      synthetic: records.filter((record) => record["synthetic"] === true).length,
      withdrawn: records.filter((record) => isRecord(record["consent"]) && record["consent"]["withdrawnAt"] !== null).length,
      conflict: records.filter((record) => record["conflict"] !== "none").length,
      nonRepresentative: records.filter((record) => record["representative"] !== true).length,
      secondary: records.filter((record) => record["participantRole"] === "secondary").length,
    },
    firstUse: {
      status: firstUseStatus,
      claimedPlatforms: claimedPlatforms.length,
      coveredPlatforms: claimedPlatforms.filter((id) => coveredPlatforms.has(id)).length,
      eligibleRuns: firstUseRecords.length,
      passingRuns: firstUseRecords.filter(firstUsePass).length,
      failingRuns: firstUseRecords.filter((record) => !firstUsePass(record)).length,
      missingPlatformIds,
    },
    comprehension: {
      status: comprehensionStatus,
      eligibleParticipants: eligible.length,
      passingParticipants: passing.length,
      failingParticipants: eligible.length - passing.length,
      passRate,
      threshold: 0.9,
      minimumParticipants: 10,
      fixtureDistribution,
    },
  };
}
