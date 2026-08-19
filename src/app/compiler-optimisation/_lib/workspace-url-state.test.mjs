import assert from "node:assert/strict";
import test from "node:test";

import multiFunctionFixture from "../../../test-data/compiler-optimisation/multi-function.json" with { type: "json" };
import { parseOptimisationResult } from "./optimisation-adapter.ts";
import {
  createWorkspaceUrlSearchParams,
  parseWorkspaceUrlState,
} from "./workspace-url-state.ts";

const result = parseOptimisationResult(multiFunctionFixture);

if (!result.ok) throw new Error(result.error.message);

const model = result.data;

test("restores a function, visible Pass, and filters from the URL", () => {
  const helper = model.functions.find((fn) => fn.name === "helper");
  const simplifyPass = helper?.passes.find(
    (pass) => pass.name === "simplifycfg",
  );
  assert.ok(helper);
  assert.ok(simplifyPass);

  const state = parseWorkspaceUrlState(
    model,
    new URLSearchParams({
      function: helper.id,
      pass: simplifyPass.id,
      passType: "transform",
      change: "unchanged",
      diff: "unified",
    }),
  );

  assert.equal(state.selectedFunctionId, helper.id);
  assert.equal(state.selectedPassId, simplifyPass.id);
  assert.deepEqual(state.passFilters, {
    type: "transform",
    change: "unchanged",
  });
  assert.equal(state.diffMode, "unified");
});

test("restores a global Pass without a function ID", () => {
  const globalPass = model.globalPasses[0];
  assert.ok(globalPass);

  const state = parseWorkspaceUrlState(
    model,
    new URLSearchParams({ scope: "global", pass: globalPass.id }),
  );

  assert.equal(state.selectedFunctionId, undefined);
  assert.equal(state.selectedPassId, globalPass.id);
});

test("infers the owning scope from a valid Pass link", () => {
  const helper = model.functions.find((fn) => fn.name === "helper");
  const helperPass = helper?.passes[0];
  assert.ok(helper);
  assert.ok(helperPass);

  const state = parseWorkspaceUrlState(
    model,
    new URLSearchParams({ pass: helperPass.id }),
  );

  assert.equal(state.selectedFunctionId, helper.id);
  assert.equal(state.selectedPassId, helperPass.id);
});

test("invalid URL values safely fall back to the default workspace state", () => {
  const state = parseWorkspaceUrlState(
    model,
    new URLSearchParams({
      function: "missing-function",
      pass: "missing-pass",
      passType: "future-type",
      change: "sometimes",
    }),
  );

  assert.equal(state.selectedFunctionId, model.functions[0]?.id);
  assert.equal(state.selectedPassId, model.functions[0]?.passes[0]?.id);
  assert.deepEqual(state.passFilters, { type: "all", change: "all" });
});

test("serialises state while preserving unrelated query parameters", () => {
  const helper = model.functions.find((fn) => fn.name === "helper");
  const futurePass = helper?.passes.find((pass) => pass.name === "future-pass");
  assert.ok(helper);
  assert.ok(futurePass);

  const query = createWorkspaceUrlSearchParams(
    model,
    {
      selectedFunctionId: helper.id,
      selectedPassId: futurePass.id,
      passFilters: { type: "transform", change: "unchanged" },
      diffMode: "unified",
    },
    new URLSearchParams({ fixture: "multi", campaign: "demo" }),
  );

  assert.equal(query.get("fixture"), "multi");
  assert.equal(query.get("campaign"), "demo");
  assert.equal(query.get("function"), helper.id);
  assert.equal(query.get("pass"), futurePass.id);
  assert.equal(query.get("passType"), "transform");
  assert.equal(query.get("change"), "unchanged");
  assert.equal(query.get("diff"), "unified");
  assert.equal(query.get("scope"), null);
});

test("serialises the global scope and omits default filters", () => {
  const globalPass = model.globalPasses[0];
  assert.ok(globalPass);

  const query = createWorkspaceUrlSearchParams(
    model,
    {
      selectedFunctionId: undefined,
      selectedPassId: globalPass.id,
      passFilters: { type: "all", change: "all" },
      diffMode: "side-by-side",
    },
    new URLSearchParams({ function: "stale", passType: "analysis" }),
  );

  assert.equal(query.get("scope"), "global");
  assert.equal(query.get("function"), null);
  assert.equal(query.get("pass"), globalPass.id);
  assert.equal(query.get("passType"), null);
  assert.equal(query.get("change"), null);
  assert.equal(query.get("diff"), null);
});
