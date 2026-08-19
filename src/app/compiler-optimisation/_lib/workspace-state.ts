import type {
  OptimisationFunctionViewModel,
  OptimisationPassViewModel,
  OptimisationViewModel,
} from "./optimisation-types";

/**
 * The complete client-owned navigation state for one optimisation result.
 * Function and Pass objects are derived from the current View Model.
 */
export type WorkspaceState = Readonly<{
  selectedFunctionId: string | undefined;
  selectedPassId: string | undefined;
  passFilters: PassFilters;
}>;

export type PassTypeFilter = "all" | "transform" | "analysis";
export type PassChangeFilter = "all" | "changed" | "unchanged";
export type PassNavigationDirection = "previous" | "next";

export type PassFilters = Readonly<{
  type: PassTypeFilter;
  change: PassChangeFilter;
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
  selectedFunctionId: string | undefined,
): ReadonlyArray<OptimisationPassViewModel> {
  return selectedFunctionId === undefined
    ? model.globalPasses
    : (model.functionsById[selectedFunctionId]?.passes ?? EMPTY_PASSES);
}

export const DEFAULT_PASS_FILTERS: PassFilters = Object.freeze({
  type: "all",
  change: "all",
});

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
      matchesChangeFilter(pass, filters.change),
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
  const passesForTypeCounts = passes.filter((pass) =>
    matchesChangeFilter(pass, filters.change),
  );
  const passesForChangeCounts = passes.filter((pass) =>
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
    getSelectedScopePasses(model, state.selectedFunctionId),
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

/** Select the first function and its first Pass, if either exists. */
export function createInitialWorkspaceState(
  model: OptimisationViewModel,
): WorkspaceState {
  const selectedFunction = model.functions[0];

  return {
    selectedFunctionId: selectedFunction?.id,
    selectedPassId:
      selectedFunction?.passes[0]?.id ??
      (selectedFunction === undefined ? model.globalPasses[0]?.id : undefined),
    passFilters: DEFAULT_PASS_FILTERS,
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
    selectedFunctionId: selectedFunction.id,
    selectedPassId: selectedFunction.passes[0]?.id,
    passFilters: DEFAULT_PASS_FILTERS,
  };
}

/** Select module-level and otherwise unowned Passes as one global timeline. */
export function selectWorkspaceGlobalPasses(
  model: OptimisationViewModel,
  state: WorkspaceState,
): WorkspaceState {
  if (model.globalPasses.length === 0) return state;

  return {
    selectedFunctionId: undefined,
    selectedPassId: model.globalPasses[0]?.id,
    passFilters: DEFAULT_PASS_FILTERS,
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
      getSelectedScopePasses(model, state.selectedFunctionId),
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

export function clearWorkspacePassFilters(
  model: OptimisationViewModel,
  state: WorkspaceState,
): WorkspaceState {
  return normaliseWorkspacePassSelection(model, {
    ...state,
    passFilters: DEFAULT_PASS_FILTERS,
  });
}

/** Resolve state IDs against the current result without storing derived data. */
export function deriveWorkspaceSelection(
  model: OptimisationViewModel,
  state: WorkspaceState,
): WorkspaceSelection {
  const selectedFunction =
    state.selectedFunctionId === undefined
      ? undefined
      : model.functionsById[state.selectedFunctionId];
  const visiblePasses = filterPasses(
    getSelectedScopePasses(model, state.selectedFunctionId),
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
