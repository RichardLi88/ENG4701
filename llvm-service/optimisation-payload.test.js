const assert = require("node:assert/strict");
const test = require("node:test");

const { createOptimisationPayload } = require("./optimisation-payload");

const inputIr = `; ModuleID = '/tmp/input.ll'
define i32 @main() {
  ret i32 0
}`;

test("creates a versioned payload from paired LLVM dump blocks", () => {
  const payload = createOptimisationPayload({
    sourceFile: "example.c",
    unoptimisedIr: inputIr,
    beforeAfterLog: `*** IR Dump Before SimplifyCFGPass on main ***
define i32 @main() {
  br label %1
1:
  ret i32 0
}
*** IR Dump After SimplifyCFGPass on main ***
define i32 @main() {
  ret i32 0
}`,
  });

  assert.equal(payload.schemaVersion, "1.0.0");
  assert.deepEqual(payload.functions, [{ id: "fn:main", name: "main" }]);
  assert.equal(payload.meta.totalPasses, 1);
  assert.equal(payload.passes[0].name, "simplify-cfg");
  assert.equal(payload.passes[0].changed, true);
  assert.deepEqual(payload.passes[0].scope, {
    level: "function",
    functionId: "fn:main",
  });
});

test("marks unchanged verifier output as analysis and removes temp paths", () => {
  const dump = `; ModuleID = '/tmp/12345678-1234-1234-1234-123456789abc_in.ll'
source_filename = "/tmp/12345678-1234-1234-1234-123456789abc.c"
define i32 @main() { ret i32 0 }`;
  const payload = createOptimisationPayload({
    sourceFile: "safe.c",
    unoptimisedIr: inputIr,
    beforeAfterLog: `*** IR Dump Before VerifierPass on [module] ***
${dump}
*** IR Dump After VerifierPass on [module] ***
${dump}`,
  });

  assert.equal(payload.passes[0].type, "analysis");
  assert.equal(payload.passes[0].changed, false);
  assert.equal(payload.passes[0].ir.before.includes("/tmp/"), false);
  assert.equal(payload.passes[0].ir.before.includes("safe.c"), true);
});

test("rejects logs without a complete before/after pair", () => {
  assert.throws(
    () =>
      createOptimisationPayload({
        sourceFile: "example.c",
        unoptimisedIr: inputIr,
        beforeAfterLog: "not an LLVM dump",
      }),
    /paired IR dumps/,
  );
});
