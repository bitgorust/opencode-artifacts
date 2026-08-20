import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWebDriverCapabilities,
  redactedTarget,
  supportBrowserFailures,
} from "../scripts/support-browser-smoke.ts";

test("support browser capabilities stay standard and browser-specific", () => {
  assert.deepEqual(buildWebDriverCapabilities({ browserName: "safari", headless: false }), {
    capabilities: { alwaysMatch: { browserName: "safari", acceptInsecureCerts: false } },
  });
  assert.deepEqual(buildWebDriverCapabilities({
    browserName: "firefox",
    browserVersion: "current-1",
    platformName: "Windows 11",
    headless: true,
  }), {
    capabilities: { alwaysMatch: {
      browserName: "firefox",
      acceptInsecureCerts: false,
      browserVersion: "current-1",
      platformName: "Windows 11",
      "moz:firefoxOptions": { args: ["-headless"] },
    } },
  });
  assert.throws(() => buildWebDriverCapabilities({ browserName: "safari", headless: true }), /does not expose/);
  assert.deepEqual(buildWebDriverCapabilities(
    { browserName: "safari", browserVersion: "current", platformName: "iOS", headless: false },
    { "vendor:options": { deviceName: "phone", osVersion: "current" } },
  ), { capabilities: { alwaysMatch: {
    "vendor:options": { deviceName: "phone", osVersion: "current" },
    browserName: "safari",
    acceptInsecureCerts: false,
    browserVersion: "current",
    platformName: "iOS",
  } } });
  assert.throws(() => buildWebDriverCapabilities(
    { browserName: "chrome", headless: false },
    { "vendor:options": { accessKey: "do-not-store" } },
  ), /credential-bearing/);
  assert.throws(() => buildWebDriverCapabilities(
    { browserName: "chrome", headless: false },
    { browserName: "firefox" },
  ), /cannot override/);
});

test("support browser reports fail closed and redact target credentials", () => {
  assert.equal(redactedTarget("https://user:secret@example.test/page?token=secret#fragment"), "https://example.test/page?redacted");
  assert.equal(redactedTarget("data:text/plain,private"), "data:<redacted>");
  const report = {
    schemaVersion: 1,
    ready: true,
    keyboard: { firstTab: { tag: "A", text: "Skip to content" } },
    observations: {
      documentHorizontalOverflow: false,
      mainHorizontalOverflow: false,
      clippedText: [],
      renderErrors: [],
    },
    externalHttpRequests: [],
    screenshot: { sha256: "a".repeat(64) },
  };
  assert.deepEqual(supportBrowserFailures(report), []);
  report.observations.clippedText.push("clipped");
  assert.match(supportBrowserFailures(report).join("\n"), /clippedText/);
});
