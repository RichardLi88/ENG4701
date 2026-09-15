import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { passDescriptionContent } from "../content.ts";
import { parseOptimisationResult } from "./optimisation-adapter.ts";
import { describePassBehaviour } from "./pass-descriptions.ts";

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

const CURATED_PASS_NAMES = [
  "InstCombinePass",
  "SimplifyCFGPass",
  "SROAPass",
  "PostOrderFunctionAttrsPass",
  "LCSSAPass",
  "GlobalOptPass",
  "ReassociatePass",
  "LoopSimplifyPass",
  "EarlyCSEPass",
  "LoopRotatePass",
  "IndVarSimplifyPass",
  "LoopDeletionPass",
  "GVNPass",
  "LoopUnrollPass",
  "InstSimplifyPass",
  "CorrelatedValuePropagationPass",
  "TailCallElimPass",
  "JumpThreadingPass",
  "LoopVectorizePass",
  "LoopLoadEliminationPass",
];

test("covers every Pass that changes something across the study set", () => {
  assert.deepEqual(
    Object.keys(passDescriptionContent.descriptions).sort(),
    [...CURATED_PASS_NAMES].sort(),
  );
});

test("every curated description is a readable multi-sentence paragraph", () => {
  for (const [name, text] of Object.entries(
    passDescriptionContent.descriptions,
  )) {
    assert.ok(text.length > 120, `${name} description is too short`);
    assert.ok(
      text.trim().endsWith("."),
      `${name} description should end in a full stop`,
    );
    assert.ok(
      (text.match(/\./g) ?? []).length >= 2,
      `${name} should be at least two sentences`,
    );
  }
});

test("prefers the curated description over the generated summary", () => {
  const pass = readModel("multi-function.json").passesById[
    "pass:000001:aW5zdGNvbWJpbmU"
  ];
  const description = describePassBehaviour(pass);

  assert.equal(pass.fullName.data, "InstCombinePass");
  assert.equal(description.status, "available");
  assert.equal(description.data.source, "curated");
  assert.equal(
    description.data.text,
    passDescriptionContent.descriptions.InstCombinePass,
  );
  assert.deepEqual(description.data.category, {
    status: "available",
    data: "instruction-combine",
  });
});

test("falls back to the generated summary for a Pass outside the table", () => {
  const source = JSON.parse(
    readFileSync(new URL("multi-function.json", fixtureDirectory), "utf8"),
  );
  const patched = {
    ...source,
    passes: source.passes.map((pass) =>
      pass.id === "pass:000001:aW5zdGNvbWJpbmU"
        ? { ...pass, fullName: "SomeFuturePass" }
        : pass,
    ),
  };
  const result = parseOptimisationResult(patched);
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);

  const pass = result.data.passesById["pass:000001:aW5zdGNvbWJpbmU"];
  const description = describePassBehaviour(pass);

  assert.equal(description.status, "available");
  assert.equal(description.data.source, "generated");
  assert.equal(description.data.text, "Folded a constant integer addition.");
  assert.deepEqual(description.data.category, {
    status: "available",
    data: "instruction-combine",
  });
});

test("reports unavailable when there is neither a curated entry nor a summary", () => {
  const pass = readModel("multi-function.json").passesById[
    "pass:000002:c2ltcGxpZnljZmc"
  ];

  assert.equal(pass.transformation.status, "unavailable");
  assert.deepEqual(describePassBehaviour(pass), {
    status: "unavailable",
    reason: "not-provided",
  });
});

test("reports unavailable rather than inventing a description", () => {
  const pass = readModel("partial-data.json").passes[0];

  assert.deepEqual(describePassBehaviour(pass), {
    status: "unavailable",
    reason: "not-provided",
  });
});

test("never mentions the specific program being inspected", () => {
  for (const text of Object.values(passDescriptionContent.descriptions)) {
    assert.doesNotMatch(
      text,
      /\b(this program|your program|here it|in this case|on screen)\b/i,
    );
  }
});
