import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseOptimisationResult } from "./optimisation-adapter.ts";
import { optimisationResultSchema } from "./optimisation-schema.ts";

const fixtureUrl = new URL(
  "../../../test-data/compiler-optimisation/real-backend.json",
  import.meta.url,
);
const day2FixtureUrl = new URL(
  "../../../test-data/compiler-optimisation/day2-real-backend.json",
  import.meta.url,
);
const day3FixtureUrl = new URL(
  "../../../test-data/compiler-optimisation/day3-special-name-backend.json",
  import.meta.url,
);

function readFixtureText() {
  return readFileSync(fixtureUrl, "utf8");
}

function readFixture() {
  return JSON.parse(readFixtureText());
}

test("sanitised LLVM 14 payload passes the complete schema", () => {
  const payload = optimisationResultSchema.parse(readFixture());

  assert.equal(payload.meta.totalPasses, payload.passes.length);
  assert.equal(payload.meta.totalPasses, 4);
  assert.deepEqual(
    payload.passes.map((pass) => pass.order),
    [0, 1, 2, 3],
  );
  assert.equal(new Set(payload.passes.map((pass) => pass.id)).size, 4);
});

test("saved payload contains no temporary path or backend UUID", () => {
  const fixtureText = readFixtureText();

  assert.equal(fixtureText.includes("/tmp/"), false);
  assert.doesNotMatch(
    fixtureText,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  assert.match(fixtureText, /<redacted>\/day4-real\.c/);
});

test("analysis Pass is unchanged and missing metrics remain unavailable", () => {
  const result = parseOptimisationResult(readFixture());
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);

  const analysisPass =
    result.data.passesById["llvm14:raw-0026:invalidate-aa:sum_to_n"];
  assert.ok(analysisPass);
  assert.equal(analysisPass.type, "analysis");
  assert.equal(analysisPass.changed, false);
  assert.equal(analysisPass.ir.before, analysisPass.ir.after);
  assert.deepEqual(analysisPass.metrics, {
    status: "unavailable",
    reason: "not-provided",
  });
});

test("adapter preserves complete real IR and raw order identity", () => {
  const fixture = readFixture();
  const result = parseOptimisationResult(fixture);
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);

  assert.deepEqual(
    result.data.passes.map((pass) => pass.id),
    [
      "llvm14:raw-0005:simplifycfg:sum_to_n",
      "llvm14:raw-0006:sroa:sum_to_n",
      "llvm14:raw-0011:sroa:main",
      "llvm14:raw-0026:invalidate-aa:sum_to_n",
    ],
  );
  assert.equal(result.data.passes[0].ir.before, fixture.passes[0].ir.before);
  assert.equal(result.data.passes[1].ir.after, fixture.passes[1].ir.after);
});

test("legacy raw service response is classified as a backend contract gap", () => {
  const result = optimisationResultSchema.safeParse({
    optimisedIr: "define i32 @main() { ret i32 0 }",
    beforeAfterLog: "*** IR Dump Before VerifierPass on [module] ***",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    new Set(result.error.issues.map((issue) => issue.path[0])),
    new Set(["schemaVersion", "meta", "functions", "passes"]),
  );
});

test("special function and Pass names remain literal UI data", () => {
  const fixture = readFixture();
  fixture.functions[0].name = 'operator<< <T> & "quoted"';
  const result = parseOptimisationResult(fixture);

  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  assert.equal(
    result.data.functionsById["fn:sum_to_n"].name,
    'operator<< <T> & "quoted"',
  );
  assert.equal(
    result.data.passesById["llvm14:raw-0005:simplifycfg:sum_to_n"].scope
      .functionName,
    'operator<< <T> & "quoted"',
  );
});

test("Day 2 end-to-end payload is complete, sanitised, and adaptable", () => {
  const fixtureText = readFileSync(day2FixtureUrl, "utf8");
  const payload = optimisationResultSchema.parse(JSON.parse(fixtureText));
  const result = parseOptimisationResult(payload);

  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  assert.equal(payload.meta.sourceFile, "e2e-multi-function.c");
  assert.equal(payload.functions.length, 2);
  assert.equal(payload.passes.length, 153);
  assert.equal(fixtureText.includes("/tmp/"), false);
  assert.ok(result.data.summary.changedPassCount > 0);
});

test("Day 3 boundary payload preserves a quoted special function name and long IR", () => {
  const fixtureText = readFileSync(day3FixtureUrl, "utf8");
  const payload = optimisationResultSchema.parse(JSON.parse(fixtureText));
  const result = parseOptimisationResult(payload);

  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  assert.equal(payload.meta.sourceFile, "day3-special-function.c");
  assert.equal(payload.functions.length, 3);
  assert.equal(payload.passes.length, 205);
  assert.ok(fixtureText.length > 400_000);
  assert.equal(fixtureText.includes("/tmp/"), false);
  assert.doesNotMatch(
    fixtureText,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  assert.equal(
    result.data.functionsById["fn:special.function-%24case"].name,
    "special.function-$case",
  );
  assert.ok(result.data.summary.changedPassCount > 0);
  assert.ok(result.data.summary.unchangedPassCount > 0);
});
