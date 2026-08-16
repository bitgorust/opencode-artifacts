import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summarizeJourneyStudy,
  validateJourneyCorpus,
  validateJourneyStudy,
} from "../scripts/journey-study-lib.ts";

const corpus = JSON.parse(await readFile(new URL("../docs/journeys/corpus.json", import.meta.url), "utf8")) as unknown;

function record(index: number, options: {
  pass?: boolean;
  synthetic?: boolean;
  platformId?: string;
  withdrawn?: boolean;
  conflict?: string;
} = {}): Record<string, unknown> {
  const pass = options.pass ?? true;
  const synthetic = options.synthetic ?? false;
  return {
    participantId: synthetic ? `synthetic-${index}` : `p-${String(index).padStart(6, "0")}`,
    participantRole: "primary",
    representative: true,
    firstTimeUser: true,
    conflict: options.conflict ?? "none",
    synthetic,
    consent: synthetic ? null : {
      given: true,
      at: "2026-08-16T08:00:00Z",
      protocolVersion: 1,
      withdrawnAt: options.withdrawn ? "2026-08-16T09:00:00Z" : null,
    },
    platform: {
      id: options.platformId ?? "ubuntu-chromium",
      os: "Ubuntu",
      osVersion: "24.04",
      nodeVersion: "24.6.0",
      opencodeVersion: "1.18.18",
      browser: "Chromium",
      browserVersion: "139",
    },
    firstUse: {
      startedAt: "2026-08-16T08:01:00Z",
      endedAt: pass ? "2026-08-16T08:09:00Z" : "2026-08-16T08:12:00Z",
      elapsedSeconds: pass ? 480 : 660,
      completed: pass,
      readmeOnly: true,
      repositoryCheckout: false,
      hostingAccount: false,
      maintainerAssistance: false,
      failureStep: pass ? null : "render",
    },
    comprehension: {
      fixtureId: ["incident", "release", "review", "migration"][index % 4],
      artifactSha256: "a".repeat(64),
      startedAt: "2026-08-16T08:15:00Z",
      elapsedSeconds: pass ? 45 : 61,
      maintainerAssistance: false,
      answers: {
        purpose: "synthetic fixture purpose",
        primaryFinding: "synthetic fixture finding",
        provenance: "synthetic fixture provenance",
        nextAction: "synthetic fixture next action",
      },
      scores: {
        purpose: pass,
        primaryFinding: pass,
        provenance: pass,
        nextAction: pass,
      },
    },
  };
}

function study(records: Record<string, unknown>[], claimedPlatformIds = ["ubuntu-chromium"]): Record<string, unknown> {
  return {
    schemaVersion: 1,
    studyId: "phase-0-2026-08-16",
    corpusVersion: 1,
    release: {
      package: "opencode-artifacts",
      version: "0.14.3",
      integrity: "sha512-abc123=",
    },
    claimedPlatformIds,
    records,
  };
}

test("checked-in corpus covers create, revise, review, and share with valid rubrics", () => {
  assert.deepEqual(validateJourneyCorpus(corpus), []);
});

test("nine of ten eligible participants and every claimed platform pass exact thresholds", () => {
  const records = Array.from({ length: 10 }, (_, index) => record(index + 1, { pass: index !== 9 }));
  records.push(record(20, { synthetic: true, pass: false }));
  const summary = summarizeJourneyStudy(study(records), corpus);
  assert.equal(summary.firstUse.status, "pass");
  assert.equal(summary.comprehension.status, "pass");
  assert.equal(summary.comprehension.eligibleParticipants, 10);
  assert.equal(summary.comprehension.passingParticipants, 9);
  assert.equal(summary.comprehension.passRate, 0.9);
  assert.equal(summary.excluded.synthetic, 1);
});

test("missing runs and uncovered platforms remain incomplete, while observed misses fail", () => {
  const empty = summarizeJourneyStudy(study([], []), corpus);
  assert.equal(empty.firstUse.status, "incomplete");
  assert.equal(empty.comprehension.status, "incomplete");
  assert.equal(empty.comprehension.passRate, null);

  const uncovered = summarizeJourneyStudy(study([record(1)], ["ubuntu-chromium", "macos-safari"]), corpus);
  assert.equal(uncovered.firstUse.status, "incomplete");
  assert.deepEqual(uncovered.firstUse.missingPlatformIds, ["macos-safari"]);

  const observedFailure = summarizeJourneyStudy(study([record(1, { pass: false })]), corpus);
  assert.equal(observedFailure.firstUse.status, "fail");
});

test("withdrawn, conflicted, secondary, nonrepresentative, and synthetic records are excluded", () => {
  const excluded = [
    record(1, { withdrawn: true }),
    record(2, { conflict: "contributor" }),
    { ...record(3), participantRole: "secondary" },
    { ...record(4), representative: false },
    record(5, { synthetic: true }),
  ];
  const summary = summarizeJourneyStudy(study(excluded), corpus);
  assert.equal(summary.comprehension.eligibleParticipants, 0);
  assert.deepEqual(summary.excluded, {
    synthetic: 1,
    withdrawn: 1,
    conflict: 1,
    nonRepresentative: 1,
    secondary: 1,
  });
});

test("validation rejects identity fields, absent consent, unknown fixtures, bad timing, and duplicates", () => {
  const first = record(1);
  first["email"] = "must-not-be-collected@example.com";
  first["consent"] = null;
  const comprehension = first["comprehension"] as Record<string, unknown>;
  comprehension["fixtureId"] = "unknown";
  comprehension["artifactSha256"] = "bad";
  const firstUse = first["firstUse"] as Record<string, unknown>;
  firstUse["elapsedSeconds"] = 10;
  const errors = validateJourneyStudy(study([first, record(1)]), corpus).join("\n");
  assert.match(errors, /unexpected field email/);
  assert.match(errors, /must be an object for real records/);
  assert.match(errors, /not in the approved corpus/);
  assert.match(errors, /64 lowercase hexadecimal/);
  assert.match(errors, /must match the bounded timestamps/);
  assert.match(errors, /participantId is duplicated/);
});

test("summary output redacts participant IDs and answer text", () => {
  const source = study([record(123456)]);
  const summary = JSON.stringify(summarizeJourneyStudy(source, corpus));
  assert.doesNotMatch(summary, /p-123456/);
  assert.doesNotMatch(summary, /synthetic fixture purpose/);
});
