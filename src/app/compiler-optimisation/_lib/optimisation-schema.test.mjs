import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import optimisationPayloadModule from "../../../../llvm-service/optimisation-payload.js";

import { parseOptimisationResult } from "./optimisation-adapter.ts";
import { createIrDiff } from "../../_helpers/text-diff.ts";
import { optimisationResultSchema } from "./optimisation-schema.ts";

const { createOptimisationPayload } = optimisationPayloadModule;

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
  "day3-special-name-backend.json",
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

test("schema 1.1 requires a structured Diff for every changed Pass", () => {
  const input = readFixture("minimal.json");
  input.schemaVersion = "1.1.0";

  const paths = issuePaths(optimisationResultSchema.safeParse(input));

  assert.ok(paths.includes("passes.0.ir.diff"));
});

test("schema 1.1 accepts a sequential structured Diff", () => {
  const input = readFixture("minimal.json");
  input.schemaVersion = "1.1.0";
  input.passes[0].ir = {
    before: "old",
    after: "new",
    diff: [
      {
        kind: "removed",
        content: "old",
        beforeLineNumber: 1,
        afterLineNumber: null,
        endsWithNewline: false,
      },
      {
        kind: "added",
        content: "new",
        beforeLineNumber: null,
        afterLineNumber: 1,
        endsWithNewline: false,
      },
    ],
  };

  assert.equal(optimisationResultSchema.safeParse(input).success, true);
});

test("rejects invalid structured Diff line-number semantics", () => {
  const input = readFixture("minimal.json");
  input.passes[0].ir.diff = [
    {
      kind: "added",
      content: "new",
      beforeLineNumber: 1,
      afterLineNumber: 2,
      endsWithNewline: false,
    },
  ];

  const paths = issuePaths(optimisationResultSchema.safeParse(input));

  assert.ok(paths.includes("passes.0.ir.diff.0.beforeLineNumber"));
  assert.ok(paths.includes("passes.0.ir.diff.0.afterLineNumber"));
});

test("rejects a structured Diff that cannot reconstruct both IR snapshots", () => {
  const input = readFixture("minimal.json");
  input.passes[0].ir = {
    before: "old",
    after: "new",
    diff: [
      {
        kind: "removed",
        content: "wrong-old",
        beforeLineNumber: 1,
        afterLineNumber: null,
        endsWithNewline: false,
      },
      {
        kind: "added",
        content: "wrong-new",
        beforeLineNumber: null,
        afterLineNumber: 1,
        endsWithNewline: false,
      },
    ],
  };

  const paths = issuePaths(optimisationResultSchema.safeParse(input));

  assert.ok(paths.includes("passes.0.ir.diff"));
});

test("LLVM structured Diff crosses the protocol and View Model boundaries", () => {
  const payload = createOptimisationPayload({
    sourceFile: "contract.c",
    unoptimisedIr: "define i32 @main() {\n  ret i32 0\n}",
    beforeAfterLog: `*** IR Dump Before InstCombinePass on main ***
define i32 @main() {
  %sum = add i32 1, 1
  ret i32 %sum
}
*** IR Dump After InstCombinePass on main ***
define i32 @main() {
  ret i32 2
}`,
  });

  const validated = optimisationResultSchema.parse(payload);
  const model = parseOptimisationResult(validated);
  assert.equal(model.ok, true);

  const pass = model.data.passes[0];
  assert.equal(pass.ir.diff.status, "available");
  assert.equal(
    createIrDiff({
      before: pass.ir.before,
      after: pass.ir.after,
      structuredDiff: pass.ir.diff.data,
    }).source,
    "structured",
  );
});
