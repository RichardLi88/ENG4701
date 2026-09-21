import type { OptimisationViewModel } from "./optimisation-types";
import {
  createInitialWorkspaceState,
  selectWorkspaceAllPasses,
  selectWorkspaceFunction,
  selectWorkspaceGlobalPasses,
  selectWorkspacePass,
  setWorkspaceDiffMode,
  setWorkspaceIrEmphasis,
  setWorkspacePassChangeFilter,
  setWorkspacePassSearch,
  setWorkspacePassTypeFilter,
  type PassChangeFilter,
  type PassTypeFilter,
  type DiffMode,
  type IrEmphasis,
  type WorkspaceState,
} from "./workspace-state.ts";

export const WORKSPACE_QUERY_KEYS = Object.freeze({
  scope: "scope",
  functionId: "function",
  passId: "pass",
  passType: "passType",
  change: "change",
  search: "search",
  diffMode: "diff",
  irEmphasis: "ir",
});

type SearchParamsReader = Readonly<{
  get: (name: string) => string | null;
}>;

function isPassTypeFilter(value: string | null): value is PassTypeFilter {
  return value === "all" || value === "transform" || value === "analysis";
}

function isPassChangeFilter(value: string | null): value is PassChangeFilter {
  return value === "all" || value === "changed" || value === "unchanged";
}

function isDiffMode(value: string | null): value is DiffMode {
  return value === "side-by-side" || value === "unified";
}

function isIrEmphasis(value: string | null): value is IrEmphasis {
  return value === "guided" || value === "plain";
}

function findPassFunctionId(
  model: OptimisationViewModel,
  passId: string,
): string | undefined {
  return model.functions.find((fn) =>
    fn.passes.some((pass) => pass.id === passId),
  )?.id;
}

/** Restore a valid workspace selection from an untrusted URL query. */
export function parseWorkspaceUrlState(
  model: OptimisationViewModel,
  searchParams: SearchParamsReader,
): WorkspaceState {
  const requestedPassId = searchParams.get(WORKSPACE_QUERY_KEYS.passId);
  const requestedFunctionId = searchParams.get(WORKSPACE_QUERY_KEYS.functionId);
  let state = createInitialWorkspaceState(model);

  const requestedScope = searchParams.get(WORKSPACE_QUERY_KEYS.scope);

  if (requestedScope === "all") {
    state = selectWorkspaceAllPasses(model, state);
  } else if (requestedScope === "global") {
    state = selectWorkspaceGlobalPasses(model, state);
  } else if (
    requestedFunctionId !== null &&
    model.functionsById[requestedFunctionId] !== undefined
  ) {
    state = selectWorkspaceFunction(model, state, requestedFunctionId);
  } else if (requestedPassId !== null) {
    const inferredFunctionId = findPassFunctionId(model, requestedPassId);

    if (inferredFunctionId !== undefined) {
      state = selectWorkspaceFunction(model, state, inferredFunctionId);
    } else if (model.globalPasses.some((pass) => pass.id === requestedPassId)) {
      state = selectWorkspaceGlobalPasses(model, state);
    }
  }

  const requestedType = searchParams.get(WORKSPACE_QUERY_KEYS.passType);
  const requestedChange = searchParams.get(WORKSPACE_QUERY_KEYS.change);

  if (isPassTypeFilter(requestedType)) {
    state = setWorkspacePassTypeFilter(model, state, requestedType);
  }

  if (isPassChangeFilter(requestedChange)) {
    state = setWorkspacePassChangeFilter(model, state, requestedChange);
  }

  const requestedSearch = searchParams.get(WORKSPACE_QUERY_KEYS.search);

  if (requestedSearch !== null && requestedSearch.trim().length > 0) {
    state = setWorkspacePassSearch(model, state, requestedSearch);
  }

  const requestedDiffMode = searchParams.get(WORKSPACE_QUERY_KEYS.diffMode);

  if (isDiffMode(requestedDiffMode)) {
    state = setWorkspaceDiffMode(state, requestedDiffMode);
  }

  const requestedIrEmphasis = searchParams.get(WORKSPACE_QUERY_KEYS.irEmphasis);

  if (isIrEmphasis(requestedIrEmphasis)) {
    state = setWorkspaceIrEmphasis(state, requestedIrEmphasis);
  }

  return requestedPassId === null
    ? state
    : selectWorkspacePass(model, state, requestedPassId);
}

/** Merge workspace state into a query while preserving unrelated parameters. */
export function createWorkspaceUrlSearchParams(
  model: OptimisationViewModel,
  state: WorkspaceState,
  currentSearchParams: URLSearchParams,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams(currentSearchParams);

  Object.values(WORKSPACE_QUERY_KEYS).forEach((key) =>
    nextSearchParams.delete(key),
  );

  if (model.functions.length === 0 && model.globalPasses.length === 0) {
    return nextSearchParams;
  }

  if (state.scope.kind === "function") {
    nextSearchParams.set(
      WORKSPACE_QUERY_KEYS.functionId,
      state.scope.functionId,
    );
  } else if (state.scope.kind === "global") {
    nextSearchParams.set(WORKSPACE_QUERY_KEYS.scope, "global");
  }

  if (state.selectedPassId !== undefined) {
    nextSearchParams.set(WORKSPACE_QUERY_KEYS.passId, state.selectedPassId);
  }

  if (state.passFilters.type !== "all") {
    nextSearchParams.set(WORKSPACE_QUERY_KEYS.passType, state.passFilters.type);
  }

  if (state.passFilters.change !== "all") {
    nextSearchParams.set(WORKSPACE_QUERY_KEYS.change, state.passFilters.change);
  }

  if (state.passFilters.search.trim().length > 0) {
    nextSearchParams.set(
      WORKSPACE_QUERY_KEYS.search,
      state.passFilters.search.trim(),
    );
  }

  if (state.diffMode !== "side-by-side") {
    nextSearchParams.set(WORKSPACE_QUERY_KEYS.diffMode, state.diffMode);
  }

  if (state.irEmphasis !== "guided") {
    nextSearchParams.set(WORKSPACE_QUERY_KEYS.irEmphasis, state.irEmphasis);
  }

  return nextSearchParams;
}
