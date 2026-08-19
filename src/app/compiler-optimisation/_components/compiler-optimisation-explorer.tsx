"use client";

import { useRef, useState } from "react";

import type { OptimisationViewModel } from "../_lib/optimisation-types";
import { CompilerWorkflowForm } from "./compiler-workflow-form";
import { OptimisationWorkspace } from "./optimisation-workspace";

type DisplayResult = Readonly<{
  key: string;
  model: OptimisationViewModel;
}>;

export function CompilerOptimisationExplorer() {
  const nextRunIdRef = useRef(0);
  const [displayResult, setDisplayResult] = useState<
    DisplayResult | undefined
  >();

  function startRun() {
    setDisplayResult(undefined);
  }

  function loadResult(model: OptimisationViewModel) {
    nextRunIdRef.current += 1;
    setDisplayResult({ key: `run:${nextRunIdRef.current}`, model });
  }

  return (
    <main
      data-compiler-theme
      className="min-h-screen bg-slate-950 text-slate-100 transition-colors"
    >
      <div className="mx-auto w-full max-w-[112rem] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <CompilerWorkflowForm
          onRunStart={startRun}
          onResult={loadResult}
          compact={displayResult !== undefined}
        />
      </div>

      {displayResult !== undefined ? (
        <OptimisationWorkspace
          model={displayResult.model}
          resultKey={displayResult.key}
        />
      ) : null}
    </main>
  );
}
