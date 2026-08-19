import assert from "node:assert/strict";
import test from "node:test";

import { createCfgDisplayModel } from "./cfg-display.ts";

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
