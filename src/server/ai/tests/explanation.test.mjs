import assert from "node:assert/strict";
import test from "node:test";

import { verifyMetricClaims } from "../schema/explanation.ts";

const pack = {
  packVersion: "1",
  domain: "compiler-optimisation",
  subject: { id: "pass-7", label: "InstCombinePass", scope: "function main" },
  transformation: null,
  code: { before: "a", after: "b" },
  metrics: [
    { key: "instructions", before: 12, after: 9, delta: -3, estimated: false },
  ],
};

test("marks a claim matching the trace as a match", () => {
  const checks = verifyMetricClaims(pack, {
    metricClaims: [{ metric: "instructions", claimedDelta: -3 }],
  });

  assert.deepEqual(checks, [
    {
      metric: "instructions",
      claimedDelta: -3,
      actualDelta: -3,
      status: "match",
    },
  ]);
});

test("marks a claim contradicting the trace as a mismatch", () => {
  const checks = verifyMetricClaims(pack, {
    metricClaims: [{ metric: "instructions", claimedDelta: -8 }],
  });

  assert.equal(checks[0].status, "mismatch");
  assert.equal(checks[0].actualDelta, -3);
});

test("marks a claim about a metric absent from the pack as unsupported", () => {
  const checks = verifyMetricClaims(pack, {
    metricClaims: [{ metric: "basicBlocks", claimedDelta: -1 }],
  });

  assert.equal(checks[0].status, "unsupported");
  assert.equal(checks[0].actualDelta, null);
});
