import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import manyPassesFixture from "../../../test-data/compiler-optimisation/many-passes.ts";
import { parseOptimisationResult } from "./optimisation-adapter.ts";
import {
  calculatePassFilterCounts,
  clearWorkspacePassFilters,
  createInitialWorkspaceState,
  deriveWorkspaceSelection,
  filterPasses,
  resetWorkspaceState,
  selectAdjacentWorkspacePass,
  selectWorkspaceFunction,
  selectWorkspacePass,
  setWorkspacePassChangeFilter,
  setWorkspacePassTypeFilter,
} from "./workspace-state.ts";

const ALL_FILTERS = { type: "all", change: "all" };

const fixtureDirectory = new URL(
  "../../../test-data/compiler-optimisation/",
  import.meta.url,
);

function parseModel(input) {
  const result = parseOptimisationResult(input);
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  return result.data;
}

function readModel(name) {
  const input = JSON.parse(
    readFileSync(new URL(name, fixtureDirectory), "utf8"),
  );
  return parseModel(input);
}

test("initial state selects the first function and its first Pass by ID", () => {
  const model = readModel("multi-function.json");
  const state = createInitialWorkspaceState(model);

  assert.deepEqual(state, {
    selectedFunctionId: "fn:bWFpbg",
    selectedPassId: "pass:000001:aW5zdGNvbWJpbmU",
    passFilters: ALL_FILTERS,
  });
  assert.equal(
    deriveWorkspaceSelection(model, state).selectedFunction?.name,
    "main",
  );
  assert.deepEqual(
    deriveWorkspaceSelection(model, state).visiblePasses.map((pass) => pass.id),
    ["pass:000001:aW5zdGNvbWJpbmU", "pass:000003:bG9vcC1kZWxldGU"],
  );
});

test("a single-function result selects its only function and Pass", () => {
  const model = readModel("minimal.json");
  const state = createInitialWorkspaceState(model);
  const selection = deriveWorkspaceSelection(model, state);

  assert.equal(selection.selectedFunction?.id, "fn:bWFpbg");
  assert.equal(selection.selectedPass?.id, "pass:000000:aW5zdGNvbWJpbmU");
  assert.equal(selection.visiblePasses.length, 1);
});

test("switching functions atomically selects the new function's first Pass", () => {
  const model = readModel("multi-function.json");
  const initial = createInitialWorkspaceState(model);
  const next = selectWorkspaceFunction(model, initial, "fn:aGVscGVy");

  assert.deepEqual(next, {
    selectedFunctionId: "fn:aGVscGVy",
    selectedPassId: "pass:000002:c2ltcGxpZnljZmc",
    passFilters: ALL_FILTERS,
  });
  assert.equal(
    deriveWorkspaceSelection(model, next).selectedPass?.scope.functionId,
    "fn:aGVscGVy",
  );
});

test("a Pass from another function cannot replace the current selection", () => {
  const model = readModel("multi-function.json");
  const helperState = selectWorkspaceFunction(
    model,
    createInitialWorkspaceState(model),
    "fn:aGVscGVy",
  );

  assert.equal(
    selectWorkspacePass(model, helperState, "pass:000001:aW5zdGNvbWJpbmU"),
    helperState,
  );
});

test("an unknown function ID cannot corrupt a valid selection", () => {
  const model = readModel("multi-function.json");
  const state = createInitialWorkspaceState(model);

  assert.equal(selectWorkspaceFunction(model, state, "fn:missing"), state);
});

test("empty functions and functions without Passes create no invalid IDs", () => {
  assert.deepEqual(
    createInitialWorkspaceState(readModel("empty-functions.json")),
    {
      selectedFunctionId: undefined,
      selectedPassId: undefined,
      passFilters: ALL_FILTERS,
    },
  );

  const noPassesState = createInitialWorkspaceState(
    readModel("empty-passes.json"),
  );
  assert.notEqual(noPassesState.selectedFunctionId, undefined);
  assert.equal(noPassesState.selectedPassId, undefined);
  assert.deepEqual(
    deriveWorkspaceSelection(readModel("empty-passes.json"), noPassesState)
      .visiblePasses,
    [],
  );
});

test("loading a second result resets both selections from the new model", () => {
  const firstModel = readModel("multi-function.json");
  const secondModel = readModel("partial-data.json");
  const previous = selectWorkspaceFunction(
    firstModel,
    createInitialWorkspaceState(firstModel),
    "fn:aGVscGVy",
  );
  const reset = resetWorkspaceState(secondModel);

  assert.notDeepEqual(reset, previous);
  assert.equal(
    deriveWorkspaceSelection(secondModel, reset).selectedFunction?.id,
    secondModel.functions[0]?.id,
  );
  assert.equal(
    deriveWorkspaceSelection(secondModel, previous).selectedFunction,
    undefined,
  );
});

test("selection follows stable IDs when function array positions change", () => {
  const model = readModel("multi-function.json");
  const selected = selectWorkspaceFunction(
    model,
    createInitialWorkspaceState(model),
    "fn:aGVscGVy",
  );
  const reorderedModel = {
    ...model,
    functions: [...model.functions].reverse(),
  };

  assert.equal(
    deriveWorkspaceSelection(reorderedModel, selected).selectedFunction?.name,
    "helper",
  );
});

test("type and change filters work alone and in combination", () => {
  const passes = readModel("multi-function.json").passes;

  assert.deepEqual(
    filterPasses(passes, { type: "transform", change: "all" }).map(
      (pass) => pass.name,
    ),
    ["instcombine", "simplifycfg", "loop-delete"],
  );
  assert.deepEqual(
    filterPasses(passes, { type: "analysis", change: "all" }).map(
      (pass) => pass.name,
    ),
    ["verify"],
  );
  assert.deepEqual(
    filterPasses(passes, { type: "all", change: "changed" }).map(
      (pass) => pass.name,
    ),
    ["instcombine", "loop-delete"],
  );
  assert.deepEqual(
    filterPasses(passes, { type: "all", change: "unchanged" }).map(
      (pass) => pass.name,
    ),
    ["verify", "simplifycfg", "future-pass"],
  );
  assert.deepEqual(
    filterPasses(passes, { type: "transform", change: "unchanged" }).map(
      (pass) => pass.name,
    ),
    ["simplifycfg"],
  );
});

test("filtering is pure and does not reorder or mutate source Passes", () => {
  const passes = readModel("multi-function.json").passes;
  const originalIds = passes.map((pass) => pass.id);
  const filtered = filterPasses(passes, {
    type: "transform",
    change: "changed",
  });

  assert.notEqual(filtered, passes);
  assert.deepEqual(
    passes.map((pass) => pass.id),
    originalIds,
  );
  assert.deepEqual(
    filtered.map((pass) => pass.name),
    ["instcombine", "loop-delete"],
  );
});

test("faceted counts respect the other active filter", () => {
  const passes = readModel("multi-function.json").passes;

  assert.deepEqual(calculatePassFilterCounts(passes, ALL_FILTERS), {
    type: { all: 5, transform: 3, analysis: 1 },
    change: { all: 5, changed: 2, unchanged: 3 },
  });
  assert.deepEqual(
    calculatePassFilterCounts(passes, {
      type: "transform",
      change: "unchanged",
    }),
    {
      type: { all: 3, transform: 1, analysis: 1 },
      change: { all: 3, changed: 2, unchanged: 1 },
    },
  );
});

test("a filter keeps the current Pass when it remains visible", () => {
  const model = readModel("multi-function.json");
  const selected = selectWorkspacePass(
    model,
    createInitialWorkspaceState(model),
    "pass:000003:bG9vcC1kZWxldGU",
  );
  const filtered = setWorkspacePassTypeFilter(model, selected, "transform");

  assert.equal(filtered.selectedPassId, "pass:000003:bG9vcC1kZWxldGU");
});

test("a filter selects the first visible Pass when the current one is hidden", () => {
  const model = readModel("multi-function.json");
  const helper = selectWorkspaceFunction(
    model,
    createInitialWorkspaceState(model),
    "fn:aGVscGVy",
  );
  const futurePass = selectWorkspacePass(
    model,
    helper,
    "pass:000004:ZnV0dXJlLXBhc3M",
  );
  const filtered = setWorkspacePassTypeFilter(model, futurePass, "transform");

  assert.equal(filtered.selectedPassId, "pass:000002:c2ltcGxpZnljZmc");
  assert.equal(
    deriveWorkspaceSelection(model, filtered).selectedPass?.name,
    "simplifycfg",
  );
});

test("an empty filter result clears selection and clearing filters recovers", () => {
  const model = readModel("multi-function.json");
  const helper = selectWorkspaceFunction(
    model,
    createInitialWorkspaceState(model),
    "fn:aGVscGVy",
  );
  const empty = setWorkspacePassChangeFilter(
    model,
    setWorkspacePassTypeFilter(model, helper, "transform"),
    "changed",
  );

  assert.equal(empty.selectedPassId, undefined);
  assert.deepEqual(deriveWorkspaceSelection(model, empty).visiblePasses, []);

  const cleared = clearWorkspacePassFilters(model, empty);
  assert.deepEqual(cleared.passFilters, ALL_FILTERS);
  assert.equal(cleared.selectedPassId, "pass:000002:c2ltcGxpZnljZmc");
});

test("switching functions resets filters so state does not leak", () => {
  const model = readModel("multi-function.json");
  const filtered = setWorkspacePassTypeFilter(
    model,
    createInitialWorkspaceState(model),
    "analysis",
  );
  const switched = selectWorkspaceFunction(model, filtered, "fn:aGVscGVy");

  assert.deepEqual(switched.passFilters, ALL_FILTERS);
  assert.deepEqual(
    deriveWorkspaceSelection(model, switched).visiblePasses.map(
      (pass) => pass.name,
    ),
    ["simplifycfg", "future-pass"],
  );
});

test("previous and next navigation stay within visible Pass boundaries", () => {
  const model = readModel("multi-function.json");
  const initial = createInitialWorkspaceState(model);

  assert.equal(
    selectAdjacentWorkspacePass(model, initial, "previous"),
    initial,
  );

  const next = selectAdjacentWorkspacePass(model, initial, "next");
  assert.equal(next.selectedPassId, "pass:000003:bG9vcC1kZWxldGU");
  assert.equal(selectAdjacentWorkspacePass(model, next, "next"), next);
  assert.equal(
    selectAdjacentWorkspacePass(model, next, "previous").selectedPassId,
    initial.selectedPassId,
  );
});

test("navigation follows filtered order rather than hidden Passes", () => {
  const model = parseModel(manyPassesFixture);
  const changed = setWorkspacePassChangeFilter(
    model,
    createInitialWorkspaceState(model),
    "changed",
  );
  const selection = deriveWorkspaceSelection(model, changed);

  assert.equal(selection.visiblePasses.length, 16);
  assert.equal(selection.selectedPass?.position.global, 3);
  assert.equal(
    deriveWorkspaceSelection(
      model,
      selectAdjacentWorkspacePass(model, changed, "next"),
    ).selectedPass?.position.global,
    6,
  );
});

test("large timeline fixture preserves all 60 Passes in global order", () => {
  const model = parseModel(manyPassesFixture);
  const selection = deriveWorkspaceSelection(
    model,
    createInitialWorkspaceState(model),
  );

  assert.equal(selection.visiblePasses.length, 60);
  assert.deepEqual(
    selection.visiblePasses.map((pass) => pass.position.global),
    Array.from({ length: 60 }, (_, index) => index),
  );
});
