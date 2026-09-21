import type {
  OptimisationFunctionViewModel,
  OptimisationPassViewModel,
  OptimisationViewModel,
} from "./optimisation-types";

/**
 * Which Passes the timeline is showing. "all" is the whole run, which is the
 * framing most questions about a run use; the narrower scopes exist to isolate
 * one function or the Passes that belong to no function.
 */
export type WorkspaceScope =
  | Readonly<{ kind: "all" }>
  | Readonly<{ kind: "global" }>
  | Readonly<{ kind: "function"; functionId: string }>;

/**
 * The complete client-owned navigation state for one optimisation result.
 * Function and Pass objects are derived from the current View Model.
 */
export type WorkspaceState = Readonly<{
  scope: WorkspaceScope;
  selectedPassId: string | undefined;
  passFilters: PassFilters;
  diffMode: DiffMode;
}>;

export const ALL_PASSES_SCOPE: WorkspaceScope = Object.freeze({ kind: "all" });
export const GLOBAL_PASSES_SCOPE: WorkspaceScope = Object.freeze({
  kind: "global",
});

export type PassTypeFilter = "all" | "transform" | "analysis";
export type PassChangeFilter = "all" | "changed" | "unchanged";
export type PassNavigationDirection = "previous" | "next";
export type DiffMode = "side-by-side" | "unified";

export type PassFilters = Readonly<{
  type: PassTypeFilter;
  change: PassChangeFilter;
  /** Free-text query over Pass names. */
  search: string;
}>;

export type PassFilterCounts = Readonly<{
  type: Readonly<Record<PassTypeFilter, number>>;
  change: Readonly<Record<PassChangeFilter, number>>;
}>;

export type WorkspaceSelection = Readonly<{
  selectedFunction: OptimisationFunctionViewModel | undefined;
  selectedPass: OptimisationPassViewModel | undefined;
  /** Passes currently eligible for filtering and navigation. */
  visiblePasses: ReadonlyArray<OptimisationPassViewModel>;
}>;

const EMPTY_PASSES: ReadonlyArray<OptimisationPassViewModel> = Object.freeze(
  [],
);

function getSelectedScopePasses(
  model: OptimisationViewModel,
  scope: WorkspaceScope,
): ReadonlyArray<OptimisationPassViewModel> {
  switch (scope.kind) {
    case "all":
      return model.passes;
    case "global":
      return model.globalPasses;
    case "function":
      return model.functionsById[scope.functionId]?.passes ?? EMPTY_PASSES;
  }
}

/** The function a scope is pinned to, if it is pinned to one. */
export function scopeFunctionId(scope: WorkspaceScope): string | undefined {
  return scope.kind === "function" ? scope.functionId : undefined;
}

export const DEFAULT_PASS_FILTERS: PassFilters = Object.freeze({
  type: "all",
  change: "all",
  search: "",
});

/** Trim and case-fold once so every comparison below is a plain substring test. */
export function normalisePassSearch(search: string): string {
  return search.trim().toLocaleLowerCase();
}

function matchesSearchFilter(pass: OptimisationPassViewModel, search: string) {
  const query = normalisePassSearch(search);

  if (query.length === 0) return true;

  const haystack = [
    pass.name,
    pass.fullName.status === "available" ? pass.fullName.data : undefined,
  ];

  return haystack.some((value) => value?.toLocaleLowerCase().includes(query));
}

function matchesTypeFilter(
  pass: OptimisationPassViewModel,
  filter: PassTypeFilter,
) {
  return filter === "all" || pass.type === filter;
}

function matchesChangeFilter(
  pass: OptimisationPassViewModel,
  filter: PassChangeFilter,
) {
  return (
    filter === "all" || (filter === "changed" ? pass.changed : !pass.changed)
  );
}

/** Apply both Pass filters without mutating the source collection. */
export function filterPasses(
  passes: ReadonlyArray<OptimisationPassViewModel>,
  filters: PassFilters,
): ReadonlyArray<OptimisationPassViewModel> {
  return passes.filter(
    (pass) =>
      matchesTypeFilter(pass, filters.type) &&
      matchesChangeFilter(pass, filters.change) &&
      matchesSearchFilter(pass, filters.search),
  );
}

/**
 * Calculate faceted counts. Each filter group respects the current selection
 * in the other group, so the numbers preview the result of each choice.
 */
export function calculatePassFilterCounts(
  passes: ReadonlyArray<OptimisationPassViewModel>,
  filters: PassFilters,
): PassFilterCounts {
  const searchMatches = passes.filter((pass) =>
    matchesSearchFilter(pass, filters.search),
  );
  const passesForTypeCounts = searchMatches.filter((pass) =>
    matchesChangeFilter(pass, filters.change),
  );
  const passesForChangeCounts = searchMatches.filter((pass) =>
    matchesTypeFilter(pass, filters.type),
  );

  return {
    type: {
      all: passesForTypeCounts.length,
      transform: passesForTypeCounts.filter((pass) => pass.type === "transform")
        .length,
      analysis: passesForTypeCounts.filter((pass) => pass.type === "analysis")
        .length,
    },
    change: {
      all: passesForChangeCounts.length,
      changed: passesForChangeCounts.filter((pass) => pass.changed).length,
      unchanged: passesForChangeCounts.filter((pass) => !pass.changed).length,
    },
  };
}

function normaliseWorkspacePassSelection(
  model: OptimisationViewModel,
  state: WorkspaceState,
): WorkspaceState {
  const visiblePasses = filterPasses(
    getSelectedScopePasses(model, state.scope),
    state.passFilters,
  );
  const selectedPassIsVisible = visiblePasses.some(
    (pass) => pass.id === state.selectedPassId,
  );

  return {
    ...state,
    selectedPassId: selectedPassIsVisible
      ? state.selectedPassId
      : visiblePasses[0]?.id,
  };
}

/**
 * Open on the whole run. Scoping to one function first hides the rest of the
 * pipeline behind a choice the reader has to know to make.
 */
export function createInitialWorkspaceState(
  model: OptimisationViewModel,
): WorkspaceState {
  return {
    scope: ALL_PASSES_SCOPE,
    selectedPassId: model.passes[0]?.id,
    passFilters: DEFAULT_PASS_FILTERS,
    diffMode: "side-by-side",
  };
}

/** Reset all navigation state when a new result is loaded. */
export function resetWorkspaceState(
  model: OptimisationViewModel,
): WorkspaceState {
  return createInitialWorkspaceState(model);
}

/**
 * Change functions and reset the dependent Pass in the same state transition.
 * Unknown IDs leave the current, valid state untouched.
 */
export function selectWorkspaceFunction(
  model: OptimisationViewModel,
  state: WorkspaceState,
  functionId: string,
): WorkspaceState {
  const selectedFunction = model.functionsById[functionId];

  if (selectedFunction === undefined) return state;

  return {
    scope: { kind: "function", functionId: selectedFunction.id },
    selectedPassId: selectedFunction.passes[0]?.id,
    passFilters: DEFAULT_PASS_FILTERS,
    diffMode: state.diffMode,
  };
}

/** Select module-level and otherwise unowned Passes as one global timeline. */
export function selectWorkspaceGlobalPasses(
  model: OptimisationViewModel,
  state: WorkspaceState,
): WorkspaceState {
  if (model.globalPasses.length === 0) return state;

  return {
    scope: GLOBAL_PASSES_SCOPE,
    selectedPassId: model.globalPasses[0]?.id,
    passFilters: DEFAULT_PASS_FILTERS,
    diffMode: state.diffMode,
  };
}

/** Select the complete Pass stream for the run. */
export function selectWorkspaceAllPasses(
  model: OptimisationViewModel,
  state: WorkspaceState,
): WorkspaceState {
  if (model.passes.length === 0) return state;

  return {
    scope: ALL_PASSES_SCOPE,
    selectedPassId: model.passes[0]?.id,
    passFilters: DEFAULT_PASS_FILTERS,
    diffMode: state.diffMode,
  };
}

/** Select a Pass only when it belongs to the currently selected scope. */
export function selectWorkspacePass(
  model: OptimisationViewModel,
  state: WorkspaceState,
  passId: string,
): WorkspaceState {
  if (
    !filterPasses(
      getSelectedScopePasses(model, state.scope),
      state.passFilters,
    ).some((pass) => pass.id === passId)
  ) {
    return state;
  }

  return { ...state, selectedPassId: passId };
}

/** Navigate within the currently filtered Pass list without crossing edges. */
export function selectAdjacentWorkspacePass(
  model: OptimisationViewModel,
  state: WorkspaceState,
  direction: PassNavigationDirection,
): WorkspaceState {
  const { selectedPass, visiblePasses } = deriveWorkspaceSelection(
    model,
    state,
  );

  if (selectedPass === undefined) return state;

  const currentIndex = visiblePasses.findIndex(
    (pass) => pass.id === selectedPass.id,
  );
  const offset = direction === "previous" ? -1 : 1;
  const adjacentPass = visiblePasses[currentIndex + offset];

  return adjacentPass === undefined
    ? state
    : { ...state, selectedPassId: adjacentPass.id };
}

export function setWorkspacePassTypeFilter(
  model: OptimisationViewModel,
  state: WorkspaceState,
  type: PassTypeFilter,
): WorkspaceState {
  return normaliseWorkspacePassSelection(model, {
    ...state,
    passFilters: { ...state.passFilters, type },
  });
}

export function setWorkspacePassChangeFilter(
  model: OptimisationViewModel,
  state: WorkspaceState,
  change: PassChangeFilter,
): WorkspaceState {
  return normaliseWorkspacePassSelection(model, {
    ...state,
    passFilters: { ...state.passFilters, change },
  });
}

export function setWorkspacePassSearch(
  model: OptimisationViewModel,
  state: WorkspaceState,
  search: string,
): WorkspaceState {
  return normaliseWorkspacePassSelection(model, {
    ...state,
    passFilters: { ...state.passFilters, search },
  });
}

export function clearWorkspacePassFilters(
  model: OptimisationViewModel,
  state: WorkspaceState,
): WorkspaceState {
  return normaliseWorkspacePassSelection(model, {
    ...state,
    passFilters: DEFAULT_PASS_FILTERS,
  });
}

export function setWorkspaceDiffMode(
  state: WorkspaceState,
  diffMode: DiffMode,
): WorkspaceState {
  return state.diffMode === diffMode ? state : { ...state, diffMode };
}

/** Resolve state IDs against the current result without storing derived data. */
export function deriveWorkspaceSelection(
  model: OptimisationViewModel,
  state: WorkspaceState,
): WorkspaceSelection {
  const selectedFunction =
    state.scope.kind === "function"
      ? model.functionsById[state.scope.functionId]
      : undefined;
  const visiblePasses = filterPasses(
    getSelectedScopePasses(model, state.scope),
    state.passFilters,
  );
  const selectedPass = visiblePasses.find(
    (pass) => pass.id === state.selectedPassId,
  );

  return {
    selectedFunction,
    selectedPass,
    visiblePasses,
  };
}
