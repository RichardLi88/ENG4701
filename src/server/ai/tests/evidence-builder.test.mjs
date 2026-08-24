import assert from "node:assert/strict";
import test from "node:test";

import { buildEvidencePack } from "../evidence-builder.ts";
import { EVIDENCE_MAX_CHARS } from "../schema/evidence.ts";

const optimisationInput = {
  domain: "compiler-optimisation",
  pass: {
    id: "pass-7",
    name: "InstCombinePass",
    scope: "function main",
    changed: true,
    transformation: {
      category: "peephole",
      summary: "Folded redundant add into a constant",
    },
    ir: { before: "%1 = add i32 2, 3", after: "%1 = i32 5" },
    metrics: [
      {
        key: "instructions",
        before: 12,
        after: 9,
        delta: -3,
        estimated: false,
      },
    ],
  },
};

test("builds a pack from an optimisation pass", () => {
  const result = buildEvidencePack(optimisationInput);

  assert.equal(result.ok, true);
  assert.equal(result.data.domain, "compiler-optimisation");
  assert.deepEqual(result.data.subject, {
    id: "pass-7",
    label: "InstCombinePass",
    scope: "function main",
  });
  assert.deepEqual(result.data.code, {
    before: "%1 = add i32 2, 3",
    after: "%1 = i32 5",
    patch: null,
  });
  assert.deepEqual(result.data.metrics, [
    { key: "instructions", before: 12, after: 9, delta: -3, estimated: false },
  ]);
});

const reductionInput = {
  domain: "program-reduction",
  candidate: {
    candidateId: "candidate:12",
    status: "INTERESTING",
    transformationKind: "DELETE",
    description: "Removed unused function body",
    reducer: "PersesNodeReducer",
    tokensBefore: 400,
    tokensAfter: 361,
    before: "int unused() { return 1; }",
    after: "",
    patch: null,
  },
};

test("builds a pack from a reduction candidate using tokens as the metric", () => {
  const result = buildEvidencePack(reductionInput);

  assert.equal(result.ok, true);
  assert.equal(result.data.domain, "program-reduction");
  assert.deepEqual(result.data.subject, {
    id: "candidate:12",
    label: "DELETE",
    scope: "PersesNodeReducer",
  });
  assert.deepEqual(result.data.metrics, [
    { key: "tokens", before: 400, after: 361, delta: -39, estimated: false },
  ]);
});

test("rejects an oversized pack instead of truncating it", () => {
  const oversized = {
    ...optimisationInput,
    pass: {
      ...optimisationInput.pass,
      ir: {
        before: "x".repeat(EVIDENCE_MAX_CHARS),
        after: "y".repeat(EVIDENCE_MAX_CHARS),
      },
    },
  };

  const result = buildEvidencePack(oversized);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "evidence-too-large");
});

test("keeps code bodies intact when the pack fits the budget", () => {
  const result = buildEvidencePack(optimisationInput);

  assert.equal(result.ok, true);
  assert.equal(result.data.code.before, optimisationInput.pass.ir.before);
});

test("carries the patch when a candidate has no materialised after state", () => {
  const result = buildEvidencePack({
    domain: "program-reduction",
    candidate: {
      ...reductionInput.candidate,
      status: "REJECTED",
      after: null,
      patch: "-int unused() { return 1; }",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.code.after, null);
  assert.match(result.data.code.patch, /int unused/);
});
