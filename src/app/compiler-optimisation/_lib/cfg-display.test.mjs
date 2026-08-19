import assert from "node:assert/strict";
import test from "node:test";

import {
  createCfgComparisonDisplayModels,
  createCfgDisplayModel,
} from "./cfg-display.ts";

const unavailableLabel = { status: "unavailable", reason: "not-provided" };

function snapshot(nodes, edges) {
  return { nodes, edges };
}

test("marks added, removed, and changed CFG nodes across snapshots", () => {
  const before = snapshot(
    [
      { id: "entry", label: "entry" },
      { id: "work", label: "old work" },
      { id: "removed", label: "removed" },
    ],
    [
      { source: "entry", target: "work", label: unavailableLabel },
      { source: "work", target: "removed", label: unavailableLabel },
    ],
  );
  const after = snapshot(
    [
      { id: "entry", label: "entry" },
      { id: "work", label: "new work" },
      { id: "added", label: "added" },
    ],
    [
      { source: "entry", target: "work", label: unavailableLabel },
      { source: "work", target: "added", label: unavailableLabel },
    ],
  );

  const beforeModel = createCfgDisplayModel(before, after, "before");
  const afterModel = createCfgDisplayModel(after, before, "after");

  assert.equal(beforeModel.status, "diagram");
  assert.equal(afterModel.status, "diagram");
  assert.deepEqual(
    beforeModel.nodes.map((node) => [node.id, node.change]),
    [
      ["entry", "unchanged"],
      ["work", "changed"],
      ["removed", "removed"],
    ],
  );
  assert.deepEqual(
    afterModel.nodes.map((node) => [node.id, node.change]),
    [
      ["entry", "unchanged"],
      ["work", "changed"],
      ["added", "added"],
    ],
  );
  assert.deepEqual(
    beforeModel.edges.map((edge) => edge.change),
    ["unchanged", "removed"],
  );
  assert.deepEqual(
    afterModel.edges.map((edge) => edge.change),
    ["unchanged", "added"],
  );
});

test("identifies entry and exit nodes and produces stable coordinates", () => {
  const graph = snapshot(
    [
      { id: "entry", label: "entry" },
      { id: "exit", label: "exit" },
    ],
    [{ source: "entry", target: "exit", label: unavailableLabel }],
  );

  const first = createCfgDisplayModel(graph, graph, "after");
  const second = createCfgDisplayModel(graph, graph, "after");

  assert.equal(first.status, "diagram");
  assert.equal(first.nodes[0].role, "entry");
  assert.equal(first.nodes[1].role, "exit");
  assert.deepEqual(first, second);
});

test("falls back safely for duplicate nodes and dangling edges", () => {
  const duplicate = snapshot(
    [
      { id: "same", label: "first" },
      { id: "same", label: "second" },
    ],
    [],
  );
  const dangling = snapshot(
    [{ id: "entry", label: "entry" }],
    [{ source: "entry", target: "missing", label: unavailableLabel }],
  );

  assert.equal(
    createCfgDisplayModel(duplicate, duplicate, "before").reason,
    "duplicate-node-id",
  );
  assert.equal(
    createCfgDisplayModel(dangling, dangling, "after").reason,
    "dangling-edge",
  );
});

test("does not mutate CFG snapshots", () => {
  const graph = snapshot([{ id: "only", label: "only" }], []);
  const before = structuredClone(graph);

  createCfgDisplayModel(graph, graph, "before");

  assert.deepEqual(graph, before);
});

test("keeps shared nodes at identical coordinates across snapshots", () => {
  const before = snapshot(
    [
      { id: "entry", label: "entry" },
      { id: "work", label: "old work" },
      { id: "removed", label: "removed" },
      { id: "exit", label: "exit" },
    ],
    [
      { source: "entry", target: "work", label: unavailableLabel },
      { source: "work", target: "removed", label: unavailableLabel },
      { source: "removed", target: "exit", label: unavailableLabel },
    ],
  );
  const after = snapshot(
    [
      { id: "entry", label: "entry" },
      { id: "work", label: "new work" },
      { id: "exit", label: "exit" },
    ],
    [
      { source: "entry", target: "work", label: unavailableLabel },
      { source: "work", target: "exit", label: unavailableLabel },
    ],
  );

  const models = createCfgComparisonDisplayModels(before, after);
  assert.equal(models.before.status, "diagram");
  assert.equal(models.after.status, "diagram");
  for (const nodeId of ["entry", "work", "exit"]) {
    const beforeNode = models.before.nodes.find((node) => node.id === nodeId);
    const afterNode = models.after.nodes.find((node) => node.id === nodeId);
    assert.deepEqual(
      { x: beforeNode?.x, y: beforeNode?.y, rank: beforeNode?.rank },
      { x: afterNode?.x, y: afterNode?.y, rank: afterNode?.rank },
    );
  }
  assert.ok(models.before.nodes[0].rank < models.before.nodes[1].rank);
});

test("routes loop-back edges through a side lane", () => {
  const graph = snapshot(
    [
      { id: "entry", label: "entry" },
      { id: "header", label: "header" },
      { id: "body", label: "body" },
      { id: "exit", label: "exit" },
    ],
    [
      { source: "entry", target: "header", label: unavailableLabel },
      { source: "header", target: "body", label: unavailableLabel },
      { source: "body", target: "header", label: unavailableLabel },
      { source: "header", target: "exit", label: unavailableLabel },
    ],
  );

  const model = createCfgDisplayModel(graph, graph, "after");
  assert.equal(model.status, "diagram");
  const backEdge = model.edges.find(
    (edge) => edge.source === "body" && edge.target === "header",
  );
  assert.equal(backEdge?.route, "back");
  assert.match(backEdge?.path ?? "", /^M .* C /);
});
