import assert from "node:assert/strict";
import test from "node:test";

import { toExplainInput } from "./ai-explain-input.ts";

const available = (data) => ({ status: "available", data });
const unavailable = { status: "unavailable", reason: "not-provided" };

const pass = {
  id: "pass-7",
  name: "InstCombinePass",
  fullName: unavailable,
  type: "transform",
  scope: {
    level: "function",
    functionId: "fn-1",
    functionName: "main",
  },
  position: { global: 7, withinFunction: available(2) },
  changed: true,
  ir: { before: "%1 = add i32 2, 3", after: "%1 = i32 5", diff: unavailable },
  metrics: available({
    values: {
      instructions: available({
        before: 12,
        after: 9,
        delta: -3,
        estimated: false,
      }),
      memoryOperations: unavailable,
      basicBlocks: unavailable,
      branches: unavailable,
      cyclomaticComplexity: unavailable,
    },
  }),
  cfg: unavailable,
  transformation: available({
    category: "peephole",
    summary: "Folded a constant add",
  }),
  analysisActivity: unavailable,
  dependencies: unavailable,
};

test("carries only the metrics the trace actually computed", () => {
  const input = toExplainInput(pass);

  assert.deepEqual(input.pass.metrics, [
    { key: "instructions", before: 12, after: 9, delta: -3, estimated: false },
  ]);
});

test("omits an unavailable metric rather than defaulting it to zero", () => {
  const withNoMetrics = { ...pass, metrics: unavailable };

  assert.deepEqual(toExplainInput(withNoMetrics).pass.metrics, []);
});

test("renders a function-scoped pass with a readable scope", () => {
  assert.equal(toExplainInput(pass).pass.scope, "function main");
});

test("renders a module-scoped pass with a readable scope", () => {
  const modulePass = { ...pass, scope: { level: "module" } };

  assert.equal(toExplainInput(modulePass).pass.scope, "module");
});

test("passes an unavailable transformation through as null", () => {
  const untransformed = { ...pass, transformation: unavailable };

  assert.equal(toExplainInput(untransformed).pass.transformation, null);
});
