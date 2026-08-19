"use client";

import { useRef, useState } from "react";

import type { OptimisationViewModel } from "../_lib/optimisation-types";
import type { WorkspaceState } from "../_lib/workspace-state";
import { CompilerWorkflowForm } from "./compiler-workflow-form";
import { FixtureSelector } from "./fixture-selector";
import { OptimisationWorkspace } from "./optimisation-workspace";
import { StatusPanel } from "./status-panel";

type DisplayResult = Readonly<{
  key: string;
  model: OptimisationViewModel;
  initialWorkspaceState?: WorkspaceState;
}>;

type CompilerOptimisationExplorerProps = Readonly<{
  fixtureKey:
    | "multi"
    | "real"
    | "partial"
    | "empty-passes"
    | "empty-functions"
    | "invalid"
    | "long-content"
    | "many-passes";
  initialModel?: OptimisationViewModel;
  initialWorkspaceState?: WorkspaceState;
  initialError?: string;
}>;

export function CompilerOptimisationExplorer({
  fixtureKey,
  initialModel,
  initialWorkspaceState,
  initialError,
}: CompilerOptimisationExplorerProps) {
  const nextRunIdRef = useRef(0);
  const [displayResult, setDisplayResult] = useState<DisplayResult | undefined>(
    initialModel === undefined
      ? undefined
      : {
          key: `fixture:${fixtureKey}`,
          model: initialModel,
          initialWorkspaceState,
        },
  );
  const [displayError, setDisplayError] = useState(initialError);

  function startRun() {
    setDisplayResult(undefined);
    setDisplayError(undefined);
  }

  function loadResult(model: OptimisationViewModel) {
    nextRunIdRef.current += 1;
    setDisplayResult({ key: `run:${nextRunIdRef.current}`, model });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto w-full max-w-[112rem] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <CompilerWorkflowForm onRunStart={startRun} onResult={loadResult} />
        <div className="mt-6">
          <FixtureSelector selectedFixture={fixtureKey} />
        </div>

        {displayError !== undefined ? (
          <div className="mt-8">
            <StatusPanel
              eyebrow="Invalid data"
              title="The optimisation result could not be displayed"
              description={displayError}
              tone="error"
            />
          </div>
        ) : null}
      </div>

      {displayResult !== undefined ? (
        <OptimisationWorkspace
          model={displayResult.model}
          resultKey={displayResult.key}
          initialWorkspaceState={displayResult.initialWorkspaceState}
        />
      ) : null}
    </main>
  );
}
