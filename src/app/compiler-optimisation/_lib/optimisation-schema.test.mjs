import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { optimisationResultSchema } from "./optimisation-schema.ts";

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
];

function readFixture(name) {
  return JSON.parse(readFileSync(new URL(name, fixtureDirectory), "utf8"));
}

function issuePaths(result) {
  assert.equal(result.success, false);
  return result.error.issues.map((issue) => issue.path.join("."));
}

for (const fixtureName of validFixtureNames) {
  test(`${fixtureName} satisfies the schema and fixture invariants`, () => {
    const result = optimisationResultSchema.safeParse(readFixture(fixtureName));
    assert.equal(
      result.success,
      true,
      result.success ? undefined : JSON.stringify(result.error.issues, null, 2),
    );

    const payload = result.data;
    assert.equal(payload.meta.totalPasses, payload.passes.length);
    assert.equal(
      new Set(payload.functions.map((fn) => fn.id)).size,
      payload.functions.length,
    );
    assert.equal(
      new Set(payload.passes.map((pass) => pass.id)).size,
      payload.passes.length,
    );
    assert.deepEqual(
      payload.passes.map((pass) => pass.order),
      payload.passes.map((_, index) => index),
    );
  });
}

test("invalid.json fails with concrete field paths", () => {
  const result = optimisationResultSchema.safeParse(
    readFixture("invalid.json"),
  );
  const paths = issuePaths(result);

  assert.ok(paths.includes("schemaVersion"));
  assert.ok(paths.includes("passes.0.order"));
});

test("partial-data.json omits every optional block", () => {
  const payload = optimisationResultSchema.parse(
    readFixture("partial-data.json"),
  );

  for (const fn of payload.functions) {
    assert.equal("signature" in fn, false);
  }

  for (const pass of payload.passes) {
    for (const optionalField of [
      "fullName",
      "metrics",
      "cfg",
      "transformation",
      "dependencies",
    ]) {
      assert.equal(optionalField in pass, false);
    }
  }
});

test("multi-function.json covers stable scopes, pass kinds and optional data", () => {
  const payload = optimisationResultSchema.parse(
    readFixture("multi-function.json"),
  );

  assert.deepEqual(
    new Set(payload.passes.map((pass) => pass.type)),
    new Set(["transform", "analysis", "unknown"]),
  );
  assert.deepEqual(
    new Set(payload.passes.map((pass) => pass.scope.level)),
    new Set(["module", "function", "loop", "unknown"]),
  );
  assert.ok(payload.passes.some((pass) => pass.metrics !== undefined));
  assert.ok(payload.passes.some((pass) => pass.cfg !== undefined));
});

test("missing schemaVersion fails at schemaVersion", () => {
  const { schemaVersion: _schemaVersion, ...missingVersion } =
    readFixture("minimal.json");
  const paths = issuePaths(optimisationResultSchema.safeParse(missingVersion));

  assert.ok(paths.includes("schemaVersion"));
});

test("unsupported major version fails at schemaVersion", () => {
  const input = { ...readFixture("minimal.json"), schemaVersion: "2.0.0" };
  const paths = issuePaths(optimisationResultSchema.safeParse(input));

  assert.ok(paths.includes("schemaVersion"));
});

test("a string order fails at the precise nested path", () => {
  const input = readFixture("minimal.json");
  input.passes[0].order = "zero";
  const paths = issuePaths(optimisationResultSchema.safeParse(input));

  assert.ok(paths.includes("passes.0.order"));
});
