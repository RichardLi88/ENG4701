import assert from "node:assert/strict";
import test from "node:test";

import { buildPrompt } from "../prompt.ts";

const packWithMetrics = {
  packVersion: "1",
  domain: "compiler-optimisation",
  subject: { id: "pass-7", label: "InstCombinePass", scope: "function main" },
  transformation: { category: "peephole", summary: "Folded a constant add" },
  code: { before: "%1 = add i32 2, 3", after: "%1 = i32 5", patch: null },
  metrics: [
    { key: "instructions", before: 12, after: 9, delta: -3, estimated: false },
  ],
};

const packWithoutMetrics = { ...packWithMetrics, metrics: [] };

test("renders measured deltas into the prompt", () => {
  const { user } = buildPrompt(packWithMetrics);

  assert.match(user, /instructions/);
  assert.match(user, /12/);
  assert.match(user, /9/);
  assert.match(user, /-3/);
});

test("omits the metrics section when the trace computed no metrics", () => {
  const { user } = buildPrompt(packWithoutMetrics);

  assert.doesNotMatch(user, /Measured metrics/);
  assert.doesNotMatch(user, /instructions/);
});

test("never invents a zero for a metric the trace did not compute", () => {
  const { user } = buildPrompt(packWithoutMetrics);

  assert.doesNotMatch(user, /\b0\b/);
});

test("is deterministic for a given pack", () => {
  assert.deepEqual(buildPrompt(packWithMetrics), buildPrompt(packWithMetrics));
});

test("carries a version so a prompt change is attributable", () => {
  assert.equal(typeof buildPrompt(packWithMetrics).version, "string");
});

test("renders the patch when there is no materialised after state", () => {
  const { user } = buildPrompt({
    ...packWithMetrics,
    code: {
      before: "int unused() { return 1; }",
      after: null,
      patch: "-int unused() { return 1; }",
    },
  });

  assert.doesNotMatch(user, /Program after/);
  assert.match(user, /Proposed patch/);
  assert.match(user, /-int unused/);
});
