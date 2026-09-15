import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseOptimisationResult } from "./optimisation-adapter.ts";
import { summarisePassChange } from "./pass-change-summary.ts";

const fixtureDirectory = new URL(
  "../../../test-data/compiler-optimisation/",
  import.meta.url,
);

function readFixture(name) {
  return JSON.parse(readFileSync(new URL(name, fixtureDirectory), "utf8"));
}

function parseModel(payload) {
  const result = parseOptimisationResult(payload);
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  return result.data;
}

const MEASURED = (before, after) => ({
  before,
  after,
  delta: after - before,
  estimated: false,
});

/** A single changed, function-scoped Pass with controllable metrics and CFG. */
function buildPass({ metrics, cfg, changed = true }) {
  const payload = {
    schemaVersion: "1.0.0",
    meta: { sourceFile: "x.c", optimisationLevel: "O1", totalPasses: 1 },
    functions: [{ id: "fn:main", name: "main", signature: "i32 ()" }],
    passes: [
      {
        id: "pass:000000:x",
        order: 0,
        name: "instcombine",
        fullName: "InstCombinePass",
        type: "transform",
        scope: { level: "function", functionId: "fn:main" },
        changed,
        ir: {
          before: "define i32 @main() { ret i32 0 }",
          after: changed
            ? "define i32 @main() { ret i32 1 }"
            : "define i32 @main() { ret i32 0 }",
        },
        ...(metrics ? { metrics } : {}),
        ...(cfg ? { cfg } : {}),
      },
    ],
  };

  return parseModel(payload).passes[0];
}

function cfgWith(beforeBlocks, afterBlocks) {
  const nodes = (count, prefix) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${prefix}${index}`,
      label: `${prefix}${index}`,
    }));

  return {
    before: { nodes: nodes(beforeBlocks, "b"), edges: [] },
    after: { nodes: nodes(afterBlocks, "b"), edges: [] },
  };
}

test("reports removals and the control-flow block count together", () => {
  const pass = buildPass({
    metrics: {
      basicBlocks: MEASURED(4, 1),
      instructions: MEASURED(10, 6),
    },
    cfg: cfgWith(4, 1),
  });

  assert.deepEqual(summarisePassChange(pass), {
    status: "available",
    data: "Removed 3 basic blocks and 4 instructions. Control flow simplified from 4 blocks to 1.",
  });
});

test("says control flow is unchanged when the block count holds", () => {
  const pass = buildPass({
    metrics: { instructions: MEASURED(4, 3) },
    cfg: cfgWith(1, 1),
  });

  assert.deepEqual(summarisePassChange(pass), {
    status: "available",
    data: "Removed 1 instruction. Control flow unchanged.",
  });
});

test("mentions only metrics that actually moved", () => {
  const pass = buildPass({
    metrics: {
      basicBlocks: MEASURED(4, 4),
      instructions: MEASURED(9, 7),
      branches: MEASURED(2, 2),
    },
  });

  assert.deepEqual(summarisePassChange(pass), {
    status: "available",
    data: "Removed 2 instructions.",
  });
});

test("describes growth as additions", () => {
  const pass = buildPass({
    metrics: { instructions: MEASURED(3, 8), basicBlocks: MEASURED(1, 3) },
    cfg: cfgWith(1, 3),
  });

  assert.deepEqual(summarisePassChange(pass), {
    status: "available",
    data: "Added 2 basic blocks and 5 instructions. Control flow expanded from 1 block to 3.",
  });
});

test("combines removals and additions in one sentence", () => {
  const pass = buildPass({
    metrics: { basicBlocks: MEASURED(5, 2), instructions: MEASURED(4, 7) },
  });

  assert.deepEqual(summarisePassChange(pass), {
    status: "available",
    data: "Removed 3 basic blocks and added 3 instructions.",
  });
});

test("refuses to describe a change from estimated numbers", () => {
  const pass = buildPass({
    metrics: {
      instructions: { before: 9, after: 7, delta: -2, estimated: true },
    },
  });

  assert.deepEqual(summarisePassChange(pass), {
    status: "unavailable",
    reason: "not-applicable",
  });
});

test("ignores an estimated metric that did not move", () => {
  const pass = buildPass({
    metrics: {
      instructions: MEASURED(9, 7),
      cyclomaticComplexity: { before: 2, after: 2, delta: 0, estimated: true },
    },
  });

  assert.deepEqual(summarisePassChange(pass), {
    status: "available",
    data: "Removed 2 instructions.",
  });
});

test("reports unavailable when no metrics were measured", () => {
  assert.deepEqual(summarisePassChange(buildPass({})), {
    status: "unavailable",
    reason: "not-provided",
  });
});

test("is not applicable to a Pass that changed nothing", () => {
  const pass = buildPass({
    changed: false,
    metrics: { instructions: MEASURED(4, 4) },
  });

  assert.deepEqual(summarisePassChange(pass), {
    status: "unavailable",
    reason: "not-applicable",
  });
});

test("states plainly when the IR changed but no tracked metric moved", () => {
  const pass = buildPass({
    metrics: { instructions: MEASURED(4, 4) },
    cfg: cfgWith(2, 2),
  });

  assert.deepEqual(summarisePassChange(pass), {
    status: "available",
    data: "The IR changed, but none of the tracked metrics moved. Control flow unchanged.",
  });
});

test("works on a real captured payload without inventing numbers", () => {
  const model = parseModel(readFixture("day2-real-backend.json"));

  for (const pass of model.passes) {
    const summary = summarisePassChange(pass);

    if (!pass.changed) {
      assert.equal(summary.status, "unavailable");
      assert.equal(summary.reason, "not-applicable");
      continue;
    }

    if (summary.status === "available") {
      assert.match(summary.data, /\.$/);
      assert.doesNotMatch(summary.data, /NaN|undefined/);
    }
  }
});
