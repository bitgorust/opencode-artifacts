import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRequirementsTraceability } from "../scripts/requirements-traceability.ts";

const spec = `
| Family | Owns | Does not own |
|---|---|---|
| \`OUT\` | outcomes | implementation |
| \`UX\` | journeys | internals |

- **OUT-01:** First outcome.
- **OUT-02:** Second outcome.
- **UX-01:** First journey.
`;

function trace(rows: string): string {
  return `
## Coverage map

| Requirements | Owning perspective | Roadmap / release gate | Accountable role | Evidence contract | Current status |
|---|---|---|---|---|---|
${rows}

## Release applicability
`;
}

test("traceability accepts inclusive ranges and individual IDs", () => {
  const result = validateRequirementsTraceability(
    spec,
    trace(
      "| `OUT-01`–`OUT-02` | Outcomes | Phase 0 | Product | Study | Partial |\n" +
        "| `UX-01` | Journey | Phase 1 | UX | E2E | Missing |",
    ),
  );
  assert.deepEqual(result, []);
});

test("traceability reports missing, duplicate, and unknown IDs", () => {
  const result = validateRequirementsTraceability(
    spec,
    trace(
      "| `OUT-01`, `OUT-01` | Outcomes | Phase 0 | Product | Study | Shipped |\n" +
        "| `UX-01`, `NEW-01` | Journey | Phase 1 | UX | E2E | Missing |",
    ),
  );
  assert.ok(result.includes("OUT-01 appears 2 times in the coverage map"));
  assert.ok(result.includes("OUT-02 is missing from the coverage map"));
  assert.ok(result.includes("NEW-01 is mapped but is not a product requirement"));
});

test("traceability rejects duplicate requirement definitions and malformed rows", () => {
  const result = validateRequirementsTraceability(
    `${spec}- **OUT-01:** Duplicate.\n`,
    trace("| `OUT-01`–`UX-01` | Bad | Phase 0 | Product | | Unknown |"),
  );
  assert.ok(result.includes("OUT-01 appears 2 times in the product spec"));
  assert.ok(result.some((error) => error.includes("invalid requirement range")));
  assert.ok(result.includes("coverage row 1 has no evidence contract"));
  assert.ok(result.includes("coverage row 1 has invalid status"));
});

test("traceability requires one taxonomy entry per requirement family", () => {
  const result = validateRequirementsTraceability(
    spec.replace("| `UX` | journeys | internals |", "| `EMPTY` | nothing | anything |"),
    trace(
      "| `OUT-01`–`OUT-02` | Outcomes | Phase 0 | Product | Study | Partial |\n" +
        "| `UX-01` | Journey | Phase 1 | UX | E2E | Missing |",
    ),
  );
  assert.ok(result.includes("UX is missing from the requirement taxonomy"));
  assert.ok(result.includes("EMPTY is defined in the taxonomy but has no requirements"));
});
