"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  OptimisationPassViewModel,
  OptimisationWorkspaceProps,
} from "../_lib/optimisation-types";
import { compilerWorkspaceContent } from "../content";
import {
  calculatePassFilterCounts,
  clearWorkspacePassFilters,
  createInitialWorkspaceState,
  deriveWorkspaceSelection,
  selectAdjacentWorkspacePass,
  selectWorkspaceGlobalPasses,
  selectWorkspaceFunction,
  selectWorkspacePass,
  setWorkspaceDiffMode,
  setWorkspacePassChangeFilter,
  setWorkspacePassTypeFilter,
  type PassChangeFilter,
  type DiffMode,
  type PassTypeFilter,
  type WorkspaceState,
} from "../_lib/workspace-state";
import {
  createWorkspaceUrlSearchParams,
  parseWorkspaceUrlState,
} from "../_lib/workspace-url-state";
import { FunctionSelector } from "./function-selector";
import { OptimisationSummary } from "./optimisation-summary";
import { PassDetail } from "./pass-detail";
import { PassFiltersControl } from "./pass-filters";
import { PASS_VIRTUALISATION_THRESHOLD, PassList } from "./pass-list";
import { StatusPanel } from "./status-panel";

type InteractiveOptimisationWorkspaceProps = OptimisationWorkspaceProps &
  Readonly<{
    /** Stable identity for one loaded result; changing it resets navigation. */
    resultKey: string;
    initialWorkspaceState?: WorkspaceState;
    /** Extra UI rendered beneath the selected Pass, e.g. the AI explanation. */
    renderPassExtras?: (pass: OptimisationPassViewModel) => ReactNode;
    children?: ReactNode;
  }>;

export function OptimisationWorkspace({
  model,
  resultKey,
  initialWorkspaceState,
  renderPassExtras,
  children,
}: InteractiveOptimisationWorkspaceProps) {
  return (
    <OptimisationWorkspaceSession
      key={resultKey}
      model={model}
      initialWorkspaceState={initialWorkspaceState}
      renderPassExtras={renderPassExtras}
    >
      {children}
    </OptimisationWorkspaceSession>
  );
}

function OptimisationWorkspaceSession({
  model,
  initialWorkspaceState,
  renderPassExtras,
  children,
}: OptimisationWorkspaceProps &
  Readonly<{
    initialWorkspaceState?: WorkspaceState;
    /** Extra UI rendered beneath the selected Pass, e.g. the AI explanation. */
    renderPassExtras?: (pass: OptimisationPassViewModel) => ReactNode;
    children?: ReactNode;
  }>) {
  const [workspaceState, setWorkspaceState] = useState(
    () => initialWorkspaceState ?? createInitialWorkspaceState(model),
  );

  useEffect(() => {
    function restoreUrlState() {
      setWorkspaceState(
        parseWorkspaceUrlState(model, new URLSearchParams(location.search)),
      );
    }

    window.addEventListener("popstate", restoreUrlState);
    return () => window.removeEventListener("popstate", restoreUrlState);
  }, [model]);

  useEffect(() => {
    const nextSearchParams = createWorkspaceUrlSearchParams(
      model,
      workspaceState,
      new URLSearchParams(location.search),
    );
    const query = nextSearchParams.toString();
    const nextUrl = `${location.pathname}${query.length > 0 ? `?${query}` : ""}${location.hash}`;
    const currentUrl = `${location.pathname}${location.search}${location.hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [model, workspaceState]);
  const { selectedFunction, selectedPass, visiblePasses } = useMemo(
    () => deriveWorkspaceSelection(model, workspaceState),
    [model, workspaceState],
  );
  const selectedFunctionPasses = selectedFunction?.passes;
  const selectedScopePasses = useMemo(
    () =>
      workspaceState.selectedFunctionId === undefined
        ? model.globalPasses
        : (selectedFunctionPasses ?? []),
    [
      model.globalPasses,
      selectedFunctionPasses,
      workspaceState.selectedFunctionId,
    ],
  );
  const adjacentPasses = useMemo(() => {
    if (selectedPass === undefined) return {};
    const selectedIndex = selectedScopePasses.findIndex(
      (pass) => pass.id === selectedPass.id,
    );
    if (selectedIndex === -1) return {};
    return {
      previousPass: selectedScopePasses[selectedIndex - 1],
      nextPass: selectedScopePasses[selectedIndex + 1],
    };
  }, [selectedPass, selectedScopePasses]);
  const filterCounts = useMemo(
    () =>
      calculatePassFilterCounts(
        selectedScopePasses,
        workspaceState.passFilters,
      ),
    [selectedScopePasses, workspaceState.passFilters],
  );
  const hasActiveFilters =
    workspaceState.passFilters.type !== "all" ||
    workspaceState.passFilters.change !== "all";
  const selectedPassIndex = useMemo(
    () =>
      selectedPass
        ? visiblePasses.findIndex((pass) => pass.id === selectedPass.id)
        : -1,
    [selectedPass, visiblePasses],
  );
  const canSelectPreviousPass = selectedPassIndex > 0;
  const canSelectNextPass =
    selectedPassIndex >= 0 && selectedPassIndex < visiblePasses.length - 1;

  const selectFunction = useCallback(
    (functionId: string) => {
      setWorkspaceState((state) =>
        selectWorkspaceFunction(model, state, functionId),
      );
    },
    [model],
  );

  const selectGlobalPasses = useCallback(() => {
    setWorkspaceState((state) => selectWorkspaceGlobalPasses(model, state));
  }, [model]);

  const selectPass = useCallback(
    (passId: string) => {
      setWorkspaceState((state) => selectWorkspacePass(model, state, passId));
    },
    [model],
  );

  const selectPreviousPass = useCallback(() => {
    setWorkspaceState((state) =>
      selectAdjacentWorkspacePass(model, state, "previous"),
    );
  }, [model]);

  const selectNextPass = useCallback(() => {
    setWorkspaceState((state) =>
      selectAdjacentWorkspacePass(model, state, "next"),
    );
  }, [model]);

  const setTypeFilter = useCallback(
    (filter: PassTypeFilter) => {
      setWorkspaceState((state) =>
        setWorkspacePassTypeFilter(model, state, filter),
      );
    },
    [model],
  );

  const setChangeFilter = useCallback(
    (filter: PassChangeFilter) => {
      setWorkspaceState((state) =>
        setWorkspacePassChangeFilter(model, state, filter),
      );
    },
    [model],
  );

  const clearFilters = useCallback(() => {
    setWorkspaceState((state) => clearWorkspacePassFilters(model, state));
  }, [model]);

  const setDiffMode = useCallback((diffMode: DiffMode) => {
    setWorkspaceState((state) => setWorkspaceDiffMode(state, diffMode));
  }, []);

  return (
    <div className="text-slate-100">
      <div className="mx-auto w-full max-w-[112rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-6">{children}</div>
        <header className="mb-8 border-b border-slate-800 pb-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300 uppercase">
                Compiler explorer
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Optimisation workspace
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Follow each compiler pass and compare the LLVM IR it receives
                with the IR it produces.
              </p>
            </div>
            <dl className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs text-slate-500">Source</dt>
                <dd
                  className="mt-1 truncate font-mono text-slate-200"
                  title={model.sourceFile}
                >
                  {model.sourceFile}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Optimisation</dt>
                <dd className="mt-1 font-mono text-slate-200">
                  {model.optimisationLevel}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Protocol</dt>
                <dd className="mt-1 font-mono text-slate-200">
                  v{model.schemaVersion}
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <OptimisationSummary model={model} />

        {model.functions.length === 0 && model.globalPasses.length === 0 ? (
          <div className="mt-6">
            <StatusPanel
              eyebrow="No Passes"
              title={compilerWorkspaceContent.empty.noScopesTitle}
              description={compilerWorkspaceContent.empty.noScopesDescription}
              tone="empty"
            />
          </div>
        ) : (
          <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
            <aside
              className={`min-w-0 space-y-7 lg:sticky lg:top-6 lg:pr-2 ${
                visiblePasses.length > PASS_VIRTUALISATION_THRESHOLD
                  ? ""
                  : "lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
              }`}
            >
              <FunctionSelector
                functions={model.functions}
                globalPassCount={model.globalPasses.length}
                selectedFunctionId={workspaceState.selectedFunctionId}
                onSelectGlobal={selectGlobalPasses}
                onSelect={selectFunction}
              />
              <PassFiltersControl
                filters={workspaceState.passFilters}
                counts={filterCounts}
                onTypeChange={setTypeFilter}
                onChangeChange={setChangeFilter}
              />
              <PassList
                passes={visiblePasses}
                scopeName={
                  selectedFunction?.name ??
                  compilerWorkspaceContent.scopes.globalName
                }
                selectedPassId={selectedPass?.id}
                selectedPassIndex={selectedPassIndex}
                onSelect={selectPass}
                onPrevious={selectPreviousPass}
                onNext={selectNextPass}
                canPrevious={canSelectPreviousPass}
                canNext={canSelectNextPass}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
              />
            </aside>

            <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-6 lg:p-7">
              {selectedPass === undefined &&
              visiblePasses.length === 0 &&
              selectedScopePasses.length > 0 ? (
                <div className="space-y-4">
                  <StatusPanel
                    eyebrow="Filtered timeline"
                    title="No Passes match the current filters"
                    description="Adjust the type or change filters, or clear both filters to continue inspecting this function."
                    tone="empty"
                    compact
                  />
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
                  >
                    Clear filters
                  </button>
                </div>
              ) : selectedPass === undefined ? (
                <StatusPanel
                  eyebrow="No passes"
                  title={
                    selectedFunction === undefined
                      ? compilerWorkspaceContent.empty.globalNoPassesTitle
                      : `${selectedFunction.name} has no optimisation passes`
                  }
                  description={
                    selectedFunction === undefined
                      ? compilerWorkspaceContent.empty.globalNoPassesDescription
                      : "The function is available, but no associated Pass was reported for this run."
                  }
                  tone="empty"
                  compact
                />
              ) : (
                <>
                  <PassDetail
                    pass={selectedPass}
                    previousPass={adjacentPasses.previousPass}
                    nextPass={adjacentPasses.nextPass}
                    diffMode={workspaceState.diffMode}
                    onDiffModeChange={setDiffMode}
                  />
                  {renderPassExtras?.(selectedPass)}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
