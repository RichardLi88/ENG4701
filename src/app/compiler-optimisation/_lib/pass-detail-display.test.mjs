import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseOptimisationResult } from "./optimisation-adapter.ts";
import {
  describePassScope,
  formatMetricDelta,
  getPassMetric,
  PASS_METRIC_DEFINITIONS,
} from "./pass-detail-display.ts";

const fixtureDirectory = new URL(
  "../../../test-data/compiler-optimisation/",
  import.meta.url,
);

function readFixture(name) {
  return JSON.parse(readFileSync(new URL(name, fixtureDirectory), "utf8"));
}

function readModel(name) {
  const result = parseOptimisationResult(readFixture(name));
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  return result.data;
}

test("defines all five Day 4 core metrics in display order", () => {
  assert.deepEqual(
    PASS_METRIC_DEFINITIONS.map((metric) => metric.key),
    [
      "instructions",
      "memoryOperations",
      "basicBlocks",
      "branches",
      "cyclomaticComplexity",
    ],
  );
});

test("preserves before, after, delta and the estimated marker", () => {
  const pass = readModel("multi-function.json").passesById[
    "pass:000001:aW5zdGNvbWJpbmU"
  ];
  const instructions = getPassMetric(pass, "instructions");
  const complexity = getPassMetric(pass, "cyclomaticComplexity");

  assert.deepEqual(instructions, {
    status: "available",
    data: { before: 2, after: 1, delta: -1, estimated: false },
  });
  assert.equal(complexity.status, "available");
  assert.equal(complexity.data.estimated, true);
  assert.equal(formatMetricDelta(-1), "-1");
  assert.equal(formatMetricDelta(2), "+2");
  assert.equal(formatMetricDelta(0), "0");
});

test("returns explicit unavailable values without inventing metrics", () => {
  const pass = readModel("partial-data.json").passes[0];

  for (const { key } of PASS_METRIC_DEFINITIONS) {
    assert.deepEqual(getPassMetric(pass, key), {
      status: "unavailable",
      reason: "not-provided",
    });
  }
});

test("describes function, loop and unknown scope details safely", () => {
  const model = readModel("multi-function.json");

  assert.equal(
    describePassScope(model.passesById["pass:000001:aW5zdGNvbWJpbmU"]),
    "Function · main",
  );
  assert.equal(
    describePassScope(model.passesById["pass:000003:bG9vcC1kZWxldGU"]),
    "Loop · loop:fn:bWFpbg:0 · main",
  );
  assert.equal(
    describePassScope(model.passesById["pass:000004:ZnV0dXJlLXBhc3M"]),
    "Unknown · helper",
  );
});
