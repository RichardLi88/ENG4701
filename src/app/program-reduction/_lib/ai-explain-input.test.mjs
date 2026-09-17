import assert from "node:assert/strict";
import test from "node:test";
import { parseReductionTrace } from "./reduction-trace-adapter.ts";
import { toExplainInput } from "./ai-explain-input.ts";
import { explainInputSchema } from "../../../server/ai/schema.ts";
import { reductionFixture } from "../../../server/ai/tests/reduction-fixture.mjs";

test("reduction AI projection preserves accepted test provenance and all candidate outcomes", () => {
  const parsed = parseReductionTrace(reductionFixture());
  assert.ok(parsed.ok, parsed.message);
  const model = parsed.data;
  const step = model.steps[0];
  const accepted = toExplainInput(model, step, null);
  assert.ok(explainInputSchema.safeParse(accepted).success);
  assert.equal(accepted.reduction.accepted, true);
  assert.equal(accepted.reduction.status, "INTERESTING");
  assert.equal(accepted.reduction.exitCode, 0);
  assert.match(accepted.reduction.testDescription, /Synthetic engineering/);
  for (const candidate of model.candidatesByState.initial) {
    const input = toExplainInput(model, step, candidate);
    assert.ok(explainInputSchema.safeParse(input).success);
    assert.equal(input.reduction.accepted, false);
    assert.equal(input.reduction.status, candidate.status);
    assert.equal(input.reduction.exitCode, candidate.exitCode);
  }
});
test("accepted step without a candidate outcome does not invent a passed test", () => {
  const trace = reductionFixture();
  trace.candidates = [];
  const result = parseReductionTrace(trace);
  assert.ok(result.ok);
  const input = toExplainInput(result.data, result.data.steps[0], null);
  assert.equal(input.reduction.status, "UNRECORDED");
  assert.equal(input.reduction.exitCode, null);
});
