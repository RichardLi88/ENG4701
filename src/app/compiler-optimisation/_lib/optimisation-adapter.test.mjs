import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseOptimisationResult } from "./optimisation-adapter.ts";

const fixtureDirectory = new URL(
  "../../../test-data/compiler-optimisation/",
  import.meta.url,
);

const validFixtureNames = [
  "minimal.json",
  "multi-function.json",
  "unchanged-pass.json",
  "partial-data.json",
  "empty-passes.json",
  "empty-functions.json",
  "long-content.json",
  "real-backend.json",
  "day2-real-backend.json",
];

function readFixture(name) {
  return JSON.parse(readFileSync(new URL(name, fixtureDirectory), "utf8"));
}

function expectSuccess(result) {
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  return result.data;
}

for (const fixtureName of validFixtureNames) {
  test(`${fixtureName} produces a complete View Model`, () => {
    const model = expectSuccess(
      parseOptimisationResult(readFixture(fixtureName)),
    );

    assert.equal(model.summary.functionCount, model.functions.length);
    assert.equal(model.summary.totalPassCount, model.passes.length);
  });
}

test("invalid.json returns an error without a partial View Model", () => {
  const result = parseOptimisationResult(readFixture("invalid.json"));

  assert.equal(result.ok, false);
  assert.equal("data" in result, false);
  assert.equal(result.error.category, "protocol");
  assert.ok(
    result.error.issues.some(
      (issue) => issue.path.join(".") === "schemaVersion",
    ),
  );
});

test("Passes are stably sorted globally and within each function", () => {
  const input = readFixture("multi-function.json");
  input.passes.reverse();

  const model = expectSuccess(parseOptimisationResult(input));
  assert.deepEqual(
    model.passes.map((pass) => pass.position.global),
    [0, 1, 2, 3, 4],
  );

  const main = model.functionsById["fn:bWFpbg"];
  assert.ok(main);
  assert.deepEqual(
    main.passes.map((pass) => pass.id),
    ["pass:000001:aW5zdGNvbWJpbmU", "pass:000003:bG9vcC1kZWxldGU"],
  );
  assert.deepEqual(
    main.passes.map((pass) => pass.position.withinFunction),
    [
      { status: "available", data: 0 },
      { status: "available", data: 1 },
    ],
  );
});

test("Adapter does not mutate input and is deterministic", () => {
  const input = readFixture("multi-function.json");
  const before = structuredClone(input);

  const first = parseOptimisationResult(input);
  const second = parseOptimisationResult(input);

  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
});

test("function Pass lists do not mix functions or include module Passes", () => {
  const model = expectSuccess(
    parseOptimisationResult(readFixture("multi-function.json")),
  );
  const helper = model.functionsById["fn:aGVscGVy"];
  assert.ok(helper);

  assert.deepEqual(
    helper.passes.map((pass) => pass.position.global),
    [2, 4],
  );
  assert.equal(
    model.passes[0].position.withinFunction.reason,
    "not-applicable",
  );
  assert.deepEqual(
    model.globalPasses.map((pass) => pass.id),
    ["pass:000000:dmVyaWZ5"],
  );
});

test("global Passes include module and unknown scopes without a function", () => {
  const input = readFixture("multi-function.json");
  const unassignedPass = structuredClone(input.passes[4]);
  unassignedPass.id = "pass:000005:dW5hc3NpZ25lZA";
  unassignedPass.order = 5;
  unassignedPass.name = "unassigned";
  unassignedPass.scope = { level: "unknown" };
  input.passes.push(unassignedPass);
  input.meta.totalPasses = input.passes.length;

  const model = expectSuccess(parseOptimisationResult(input));

  assert.deepEqual(
    model.globalPasses.map((pass) => pass.id),
    ["pass:000000:dmVyaWZ5", "pass:000005:dW5hc3NpZ25lZA"],
  );
  assert.equal(
    model.functions.some((fn) =>
      fn.passes.some((pass) => pass.id === unassignedPass.id),
    ),
    false,
  );
});

test("missing optional data remains explicitly unavailable", () => {
  const model = expectSuccess(
    parseOptimisationResult(readFixture("partial-data.json")),
  );
  const pass = model.passes[0];

  assert.deepEqual(pass.metrics, {
    status: "unavailable",
    reason: "not-provided",
  });
  assert.deepEqual(pass.cfg, {
    status: "unavailable",
    reason: "not-provided",
  });
  assert.deepEqual(pass.transformation, {
    status: "unavailable",
    reason: "not-provided",
  });
  assert.equal("data" in pass.metrics, false);
  assert.equal("data" in pass.cfg, false);
});

test("partial metric blocks preserve unavailable individual metrics", () => {
  const model = expectSuccess(
    parseOptimisationResult(readFixture("multi-function.json")),
  );
  const metrics = model.passesById["pass:000001:aW5zdGNvbWJpbmU"].metrics;
  assert.equal(metrics.status, "available");
  assert.deepEqual(metrics.data.values.instructions, {
    status: "available",
    data: { before: 2, after: 1, delta: -1, estimated: false },
  });
  assert.deepEqual(metrics.data.values.branches, {
    status: "unavailable",
    reason: "not-provided",
  });
});

test("duplicate function and Pass IDs return protocol errors", () => {
  const duplicateFunction = readFixture("minimal.json");
  duplicateFunction.functions.push({ ...duplicateFunction.functions[0] });
  const functionResult = parseOptimisationResult(duplicateFunction);
  assert.equal(functionResult.ok, false);
  assert.ok(
    functionResult.error.issues.some((issue) =>
      issue.message.includes("Duplicate function ID"),
    ),
  );

  const duplicatePass = readFixture("minimal.json");
  duplicatePass.passes.push({ ...duplicatePass.passes[0], order: 1 });
  duplicatePass.meta.totalPasses = 2;
  const passResult = parseOptimisationResult(duplicatePass);
  assert.equal(passResult.ok, false);
  assert.ok(
    passResult.error.issues.some((issue) =>
      issue.message.includes("Duplicate pass ID"),
    ),
  );
});

test("meta.totalPasses mismatches return a protocol error", () => {
  const input = readFixture("minimal.json");
  input.meta.totalPasses = 9;

  const result = parseOptimisationResult(input);
  assert.equal(result.ok, false);
  assert.ok(
    result.error.issues.some(
      (issue) => issue.path.join(".") === "meta.totalPasses",
    ),
  );
});

test("empty functions and Passes produce an indexed zero-count model", () => {
  const model = expectSuccess(
    parseOptimisationResult({
      schemaVersion: "1.0.0",
      meta: {
        sourceFile: "empty.c",
        optimisationLevel: "O0",
        totalPasses: 0,
      },
      functions: [],
      passes: [],
    }),
  );

  assert.deepEqual(model.summary, {
    functionCount: 0,
    totalPassCount: 0,
    changedPassCount: 0,
    unchangedPassCount: 0,
    transformPassCount: 0,
    analysisPassCount: 0,
    unknownPassCount: 0,
  });
  assert.equal(Object.getPrototypeOf(model.functionsById), null);
  assert.equal(Object.getPrototypeOf(model.passesById), null);
});

test("summary counts and ID indexes match the multi-function fixture", () => {
  const model = expectSuccess(
    parseOptimisationResult(readFixture("multi-function.json")),
  );

  assert.deepEqual(model.summary, {
    functionCount: 2,
    totalPassCount: 5,
    changedPassCount: 2,
    unchangedPassCount: 3,
    transformPassCount: 3,
    analysisPassCount: 1,
    unknownPassCount: 1,
  });
  assert.equal(model.functionsById["fn:bWFpbg"].name, "main");
  assert.equal(
    model.passesById["pass:000004:ZnV0dXJlLXBhc3M"].name,
    "future-pass",
  );
});
