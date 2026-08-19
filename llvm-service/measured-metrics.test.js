const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseMeasuredMetrics,
  parseMeasuredPassData,
} = require("./measured-metrics");

const hex = (value) => Buffer.from(value, "utf8").toString("hex");

test("parses exact LLVM metrics by dump index", () => {
  const log = `*** IR Dump Before SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }
*** IR Dump After SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }`;
  assert.deepEqual(
    parseMeasuredMetrics(
      "B\tSimplifyCFGPass\t35\t15\t8\t7\t3\nA\tSimplifyCFGPass\t34\t15\t7\t6\t3\n",
      log,
    ),
    [
      {
        instructions: 35,
        memoryOperations: 15,
        basicBlocks: 8,
        branches: 7,
        cyclomaticComplexity: 3,
      },
      {
        instructions: 34,
        memoryOperations: 15,
        basicBlocks: 7,
        branches: 6,
        cyclomaticComplexity: 3,
      },
    ],
  );
});

test("preserves unavailable LLVM snapshots for estimated fallback", () => {
  const log = `*** IR Dump Before MissingPass on main ***
define i32 @main() { ret i32 0 }
*** IR Dump After PresentPass on main ***
define i32 @main() { ret i32 0 }`;
  const parsed = parseMeasuredMetrics("A\tPresentPass\t1\t0\t1\t0\t1\n", log);

  assert.equal(parsed[0], undefined);
  assert.deepEqual(parsed[1], {
    instructions: 1,
    memoryOperations: 0,
    basicBlocks: 1,
    branches: 0,
    cyclomaticComplexity: 1,
  });
});

test("associates runtime analyses and preservation with the active Pass", () => {
  const log = `*** IR Dump Before SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }
*** IR Dump After SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }`;
  const parsed = parseMeasuredPassData(
    "B\tSimplifyCFGPass\t1\t0\t1\t0\t1\n" +
      "D\tDominatorTreeAnalysis\n" +
      "D\tDominatorTreeAnalysis\n" +
      "D\tLoopAnalysis\n" +
      "P\tnot-all\n" +
      "A\tSimplifyCFGPass\t1\t0\t1\t0\t1\n",
    log,
  );

  assert.deepEqual(parsed.analysesByDump[0], {
    computed: ["DominatorTreeAnalysis", "LoopAnalysis"],
    preservation: "not-all",
  });
});

test("associates LLVM API CFG snapshots with matching dump phases", () => {
  const log = `*** IR Dump Before SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }
*** IR Dump After SimplifyCFGPass on main ***
define i32 @main() { ret i32 0 }`;
  const parsed = parseMeasuredPassData(
    `B\tSimplifyCFGPass\t2\t0\t2\t1\t1
C\tB\t${hex("SimplifyCFGPass")}\t${hex("main")}
N\t${hex("entry")}\t${hex("entry\nbr label %exit")}
N\t${hex("exit")}\t${hex("exit\nret i32 0")}
E\t${hex("entry")}\t${hex("exit")}
Z
P\tnot-all
C\tA\t${hex("SimplifyCFGPass")}\t${hex("main")}
N\t${hex("entry")}\t${hex("entry\nret i32 0")}
Z
A\tSimplifyCFGPass\t1\t0\t1\t0\t1
`,
    log,
  );

  assert.deepEqual(parsed.cfgByDump[0].get("main"), {
    nodes: [
      { id: "bb:main:entry", label: "entry\nbr label %exit" },
      { id: "bb:main:exit", label: "exit\nret i32 0" },
    ],
    edges: [{ source: "bb:main:entry", target: "bb:main:exit" }],
  });
  assert.deepEqual(parsed.cfgByDump[1].get("main"), {
    nodes: [{ id: "bb:main:entry", label: "entry\nret i32 0" }],
    edges: [],
  });
});

test("rejects malformed native metrics output", () => {
  assert.throws(
    () => parseMeasuredMetrics("B\tPass\t1\t2\n", ""),
    /invalid field count/,
  );
  assert.throws(
    () => parseMeasuredMetrics("B\tPass\tbad\t2\t3\t4\t5\n", ""),
    /invalid metric value/,
  );
  assert.throws(
    () =>
      parseMeasuredPassData(
        `B\tPass\t1\t0\t1\t0\t1\nC\tB\t${hex("Pass")}\t${hex("main")}\nN\tinvalid\t00\n`,
        "",
      ),
    /invalid hexadecimal data/,
  );
});
