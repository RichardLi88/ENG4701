import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseOptimisationResult } from "./optimisation-adapter.ts";
import { deriveOverallIrComparison } from "./overall-ir.ts";

const fixtureDirectory = new URL(
  "../../../test-data/compiler-optimisation/",
  import.meta.url,
);

function readModel(name) {
  const result = parseOptimisationResult(
    JSON.parse(readFileSync(new URL(name, fixtureDirectory), "utf8")),
  );
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  return result.data;
}

test("brackets the run with the first Pass input and the last Pass output", () => {
  const model = readModel("multi-function.json");
  const comparison = deriveOverallIrComparison(model);

  assert.equal(comparison.status, "available");
  assert.equal(comparison.data.before, model.passes[0].ir.before);
  assert.equal(
    comparison.data.after,
    model.passes[model.passes.length - 1].ir.after,
  );
});

test("summarises Pass counts and line counts without attributing a Pass", () => {
  const model = readModel("multi-function.json");
  const comparison = deriveOverallIrComparison(model);

  assert.equal(comparison.status, "available");
  assert.match(
    comparison.data.summary,
    /^5 passes ran · 2 changed the program · \d+ lines? -> \d+ lines?$/,
  );
  assert.equal(
    comparison.data.summary.includes(model.passes[0].name),
    false,
    "the overall summary must not name an individual Pass",
  );
});

test("counts lines without inventing a trailing empty line", () => {
  const model = readModel("unchanged-pass.json");
  const comparison = deriveOverallIrComparison(model);

  assert.equal(comparison.status, "available");
  assert.equal(
    comparison.data.beforeLineCount,
    model.passes[0].ir.before.replace(/\n$/, "").split("\n").length,
  );
  assert.equal(comparison.data.beforeLineCount, comparison.data.afterLineCount);
});

test("reports unavailable rather than an empty comparison when no Pass ran", () => {
  const comparison = deriveOverallIrComparison(readModel("empty-passes.json"));

  assert.deepEqual(comparison, {
    status: "unavailable",
    reason: "not-provided",
  });
});
