"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

import type { OptimisationWorkspaceProps } from "../_lib/optimisation-types";
import {
  calculatePassFilterCounts,
  clearWorkspacePassFilters,
  createInitialWorkspaceState,
  deriveWorkspaceSelection,
  selectAdjacentWorkspacePass,
  selectWorkspaceFunction,
  selectWorkspacePass,
  setWorkspacePassChangeFilter,
  setWorkspacePassTypeFilter,
  type PassChangeFilter,
  type PassTypeFilter,
} from "../_lib/workspace-state";
import { FunctionSelector } from "./function-selector";
import { OptimisationSummary } from "./optimisation-summary";
import { PassDetail } from "./pass-detail";
import { PassFiltersControl } from "./pass-filters";
import { PassList } from "./pass-list";
import { StatusPanel } from "./status-panel";

type InteractiveOptimisationWorkspaceProps = OptimisationWorkspaceProps &
  Readonly<{
    /** Stable identity for one loaded result; changing it resets navigation. */
    resultKey: string;
    children?: ReactNode;
  }>;

export function OptimisationWorkspace({
  model,
  resultKey,
  children,
}: InteractiveOptimisationWorkspaceProps) {
  return (
    <OptimisationWorkspaceSession key={resultKey} model={model}>
      {children}
    </OptimisationWorkspaceSession>
  );
}

function OptimisationWorkspaceSession({
  model,
  children,
}: OptimisationWorkspaceProps & Readonly<{ children?: ReactNode }>) {
  const [workspaceState, setWorkspaceState] = useState(() =>
    createInitialWorkspaceState(model),
  );
  const { selectedFunction, selectedPass, visiblePasses } = useMemo(
    () => deriveWorkspaceSelection(model, workspaceState),
    [model, workspaceState],
  );
  const selectedFunctionPasses = selectedFunction?.passes;
  const filterCounts = useMemo(
    () =>
      calculatePassFilterCounts(
        selectedFunctionPasses ?? [],
        workspaceState.passFilters,
      ),
    [selectedFunctionPasses, workspaceState.passFilters],
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

        {selectedFunction === undefined ? (
          <div className="mt-6">
            <StatusPanel
              eyebrow="No functions"
              title="There is no function IR to inspect"
              description="This optimisation result did not include any functions. Run the compiler with a source file that emits function-level IR."
              tone="empty"
            />
          </div>
        ) : (
          <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
            <aside className="min-w-0 space-y-7 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
              <FunctionSelector
                functions={model.functions}
                selectedFunctionId={workspaceState.selectedFunctionId}
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
              selectedFunction.passes.length > 0 ? (
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
                  title={`${selectedFunction.name} has no optimisation passes`}
                  description="The function is available, but no associated Pass was reported for this run."
                  tone="empty"
                  compact
                />
              ) : (
                <PassDetail pass={selectedPass} />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
