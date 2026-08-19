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
  assert.deepEqual(payload.passes[0].metrics, {
    instructions: { before: 2, after: 1, delta: -1, estimated: true },
    memoryOperations: { before: 0, after: 0, delta: 0, estimated: true },
    basicBlocks: { before: 2, after: 1, delta: -1, estimated: true },
    branches: { before: 1, after: 0, delta: -1, estimated: true },
    cyclomaticComplexity: {
      before: 1,
      after: 1,
      delta: 0,
      estimated: true,
    },
  });
  assert.deepEqual(payload.passes[0].cfg, {
    before: {
      nodes: [
        { id: "bb:main:entry", label: "entry\nbr label %1" },
        { id: "bb:main:1", label: "1\nret i32 0" },
      ],
      edges: [{ source: "bb:main:entry", target: "bb:main:1" }],
    },
    after: {
      nodes: [{ id: "bb:main:entry", label: "entry\nret i32 0" }],
      edges: [],
    },
  });
  assert.deepEqual(payload.passes[0].transformation, {
    category: "control-flow",
    summary:
      "SimplifyCFGPass changed the LLVM IR snapshot. Estimated snapshot metrics: instructions 2 → 1, basic blocks 2 → 1, branches 1 → 0.",
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
  assert.equal(payload.passes[0].cfg, undefined);
  assert.equal(payload.passes[0].transformation, undefined);
  assert.deepEqual(payload.passes[0].metrics.instructions, {
    before: 1,
    after: 1,
    delta: 0,
    estimated: true,
  });
});

test("omits a function CFG when an edge target cannot be resolved", () => {
  const payload = createOptimisationPayload({
    sourceFile: "example.c",
    unoptimisedIr: inputIr,
    beforeAfterLog: `*** IR Dump Before LoopPass on main ***
define i32 @main() {
  br label %missing
}
*** IR Dump After LoopPass on main ***
define i32 @main() {
  ret i32 0
}`,
  });

  assert.equal(payload.passes[0].cfg, undefined);
  assert.deepEqual(payload.passes[0].metrics.basicBlocks, {
    before: 1,
    after: 1,
    delta: 0,
    estimated: true,
  });
});

test("omits metrics when a dump contains no function definitions", () => {
  const payload = createOptimisationPayload({
    sourceFile: "example.c",
    unoptimisedIr: inputIr,
    beforeAfterLog: `*** IR Dump Before GlobalOptPass on [module] ***
@value = global i32 0
*** IR Dump After GlobalOptPass on [module] ***
@value = global i32 1`,
  });

  assert.equal(payload.passes[0].metrics, undefined);
  assert.deepEqual(payload.passes[0].transformation, {
    category: "llvm-transform",
    summary: "GlobalOptPass changed the LLVM IR snapshot.",
  });
});

test("finds the function body after aggregate parameter types", () => {
  const aggregateIr = `define i32 @aggregate({ i32, i32 } %pair) {
entry:
  %value = extractvalue { i32, i32 } %pair, 0
  ret i32 %value
}`;
  const payload = createOptimisationPayload({
    sourceFile: "example.c",
    unoptimisedIr: aggregateIr,
    beforeAfterLog: `*** IR Dump Before InstCombinePass on aggregate ***
${aggregateIr}
*** IR Dump After InstCombinePass on aggregate ***
${aggregateIr}`,
  });

  assert.deepEqual(payload.passes[0].metrics.instructions, {
    before: 2,
    after: 2,
    delta: 0,
    estimated: true,
  });
  assert.equal(payload.passes[0].cfg.before.nodes[0].id, "bb:aggregate:entry");
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
