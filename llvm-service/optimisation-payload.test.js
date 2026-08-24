const assert = require("node:assert/strict");
const test = require("node:test");

const { createOptimisationPayload } = require("./optimisation-payload");

const inputIr = `; ModuleID = '/tmp/input.ll'
define i32 @main() {
  ret i32 0
}`;

const measuredCfgByDump = [
  new Map([
    [
      "main",
      {
        nodes: [
          { id: "bb:main:entry", label: "entry\nbr label %1" },
          { id: "bb:main:1", label: "1\nret i32 0" },
        ],
        edges: [{ source: "bb:main:entry", target: "bb:main:1" }],
      },
    ],
  ]),
  new Map([
    [
      "main",
      {
        nodes: [{ id: "bb:main:entry", label: "entry\nret i32 0" }],
        edges: [],
      },
    ],
  ]),
];

test("creates a versioned payload from paired LLVM dump blocks", () => {
  const payload = createOptimisationPayload({
    sourceFile: "example.c",
    unoptimisedIr: inputIr,
    measuredCfgByDump,
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

  assert.equal(payload.schemaVersion, "1.1.0");
  assert.deepEqual(payload.functions, [
    { id: "fn:main", name: "main", signature: "i32 ()" },
  ]);
  assert.equal(payload.meta.totalPasses, 1);
  assert.equal(payload.passes[0].name, "simplify-cfg");
  assert.equal(payload.passes[0].changed, true);
  assert.deepEqual(payload.passes[0].scope, {
    level: "function",
    functionId: "fn:main",
  });
  assert.deepEqual(payload.passes[0].ir.diff, [
    {
      kind: "unchanged",
      content: "define i32 @main() {",
      beforeLineNumber: 1,
      afterLineNumber: 1,
      endsWithNewline: true,
    },
    {
      kind: "removed",
      content: "  br label %1",
      beforeLineNumber: 2,
      afterLineNumber: null,
      endsWithNewline: true,
    },
    {
      kind: "removed",
      content: "1:",
      beforeLineNumber: 3,
      afterLineNumber: null,
      endsWithNewline: true,
    },
    {
      kind: "unchanged",
      content: "  ret i32 0",
      beforeLineNumber: 4,
      afterLineNumber: 2,
      endsWithNewline: true,
    },
    {
      kind: "unchanged",
      content: "}",
      beforeLineNumber: 5,
      afterLineNumber: 3,
      endsWithNewline: false,
    },
  ]);
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
    summary: "Simplified the control-flow structure.",
  });
});

const levelDumpLog = `*** IR Dump Before SimplifyCFGPass on main ***
define i32 @main() {
  br label %1
1:
  ret i32 0
}
*** IR Dump After SimplifyCFGPass on main ***
define i32 @main() {
  ret i32 0
}`;

test("defaults meta.optimisationLevel to O1 when none is provided", () => {
  const payload = createOptimisationPayload({
    sourceFile: "example.c",
    unoptimisedIr: inputIr,
    beforeAfterLog: levelDumpLog,
  });

  assert.equal(payload.meta.optimisationLevel, "O1");
});

test("reflects the supplied optimisationLevel in meta", () => {
  for (const level of ["O0", "O2", "O3", "Os", "Oz"]) {
    const payload = createOptimisationPayload({
      sourceFile: "example.c",
      unoptimisedIr: inputIr,
      beforeAfterLog: levelDumpLog,
      optimisationLevel: level,
    });

    assert.equal(payload.meta.optimisationLevel, level);
  }
});

test("extracts function signatures from unoptimised LLVM IR", () => {
  const manualTestIr = `define internal i32 @square(i32 noundef %value) {
  ret i32 %value
}
define internal i32 @sum_of_squares(i32 noundef %limit) {
  ret i32 %limit
}
define dso_local i32 @main() {
  ret i32 0
}`;
  const payload = createOptimisationPayload({
    sourceFile: "manual-test.c",
    unoptimisedIr: manualTestIr,
    beforeAfterLog: `*** IR Dump Before SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }
*** IR Dump After SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }`,
  });

  assert.deepEqual(payload.functions, [
    { id: "fn:square", name: "square", signature: "i32 (i32)" },
    {
      id: "fn:sum_of_squares",
      name: "sum_of_squares",
      signature: "i32 (i32)",
    },
    { id: "fn:main", name: "main", signature: "i32 ()" },
  ]);
});

test("uses measured LLVM metrics when they are provided", () => {
  const measuredMetricsByDump = [
    {
      instructions: 2,
      memoryOperations: 1,
      basicBlocks: 2,
      branches: 1,
      cyclomaticComplexity: 1,
    },
    {
      instructions: 1,
      memoryOperations: 0,
      basicBlocks: 1,
      branches: 0,
      cyclomaticComplexity: 1,
    },
  ];
  const payload = createOptimisationPayload({
    sourceFile: "example.c",
    unoptimisedIr: inputIr,
    measuredMetricsByDump,
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

  assert.deepEqual(payload.passes[0].metrics.instructions, {
    before: 2,
    after: 1,
    delta: -1,
    estimated: false,
  });
  assert.deepEqual(payload.passes[0].metrics.memoryOperations, {
    before: 1,
    after: 0,
    delta: -1,
    estimated: false,
  });
  assert.equal(
    payload.passes[0].transformation.summary,
    "Simplified the control-flow structure.",
  );
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
  assert.equal(payload.passes[0].ir.diff, undefined);
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

test("does not infer a function CFG from textual IR", () => {
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
    summary: "Applied an LLVM IR transformation.",
  });
});

test("includes runtime analysis activity when LLVM reports it", () => {
  const payload = createOptimisationPayload({
    sourceFile: "example.c",
    unoptimisedIr: inputIr,
    analysesByDump: [
      {
        computed: ["DominatorTreeAnalysis", "LoopAnalysis"],
        preservation: "not-all",
      },
    ],
    beforeAfterLog: `*** IR Dump Before SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }
*** IR Dump After SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }`,
  });

  assert.deepEqual(payload.passes[0].analysisActivity, {
    computed: ["DominatorTreeAnalysis", "LoopAnalysis"],
    preservation: "not-all",
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
  assert.equal(payload.functions[0].signature, "i32 ({ i32, i32 })");
  assert.equal(payload.passes[0].cfg, undefined);
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
