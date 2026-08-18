import assert from "node:assert/strict";
import { test } from "node:test";
import {
  artifactPermissionKey,
  publishPermissionRequests,
} from "../src/opencode-permissions.ts";

test("publish authorities are ordered, exact, bounded, and non-secret", () => {
  const requests = publishPermissionRequests({
    slug: "incident-report",
    format: "markdown",
    trustedHtml: false,
    dataSources: [
      { name: "latency", command: "/usr/local/bin/collect-latency", args: ["secret-argument"] },
    ],
    deploy: { target: "github", coordinate: "team/artifacts@main" },
  });
  assert.deepEqual(requests.map((request) => request.permission), [
    "artifact_publish",
    "artifact_datasource",
    "artifact_deploy",
    "artifact_audience",
  ]);
  assert.deepEqual(requests.map((request) => request.always), [[artifactPermissionKey("incident-report")], [], [], []]);
  const serialized = JSON.stringify(requests);
  assert.doesNotMatch(serialized, /secret-argument|\/usr\/local\/bin/);
  assert.match(serialized, /collect-latency/);
  assert.ok(requests.every((request) => request.patterns.every((pattern) => pattern.length <= 128)));
  assert.ok(requests.every((request) => Buffer.byteLength(JSON.stringify(request.metadata), "utf8") <= 1024));
});

test("malformed or unbounded datasource and deploy scopes fail before asking", () => {
  assert.throws(
    () => publishPermissionRequests({
      slug: "page",
      format: "markdown",
      trustedHtml: false,
      dataSources: [{ name: "../escape", command: "collect" }],
    }),
    /datasource names/,
  );
  assert.throws(
    () => publishPermissionRequests({
      slug: "page",
      format: "markdown",
      trustedHtml: false,
      deploy: { target: "github", coordinate: "team/artifacts with spaces@main" },
    }),
    /unsupported characters/,
  );
});
