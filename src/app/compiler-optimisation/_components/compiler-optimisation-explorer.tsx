"use client";

import { useRef, useState } from "react";
import {
  ExplanationContainer,
  ExplanationSessionProvider,
} from "~/app/_components/ai/explanation-container";
import { toExplainInput } from "../_lib/ai-explain-input";

import type {
  DataAvailability,
  OptimisationViewModel,
  SourceFileViewModel,
} from "../_lib/optimisation-types";
import { CompilerWorkflowForm } from "./compiler-workflow-form";
import { OptimisationWorkspace } from "./optimisation-workspace";

type DisplayResult = Readonly<{
  key: string;
  model: OptimisationViewModel;
  source: DataAvailability<SourceFileViewModel>;
}>;

export function CompilerOptimisationExplorer() {
  const nextRunIdRef = useRef(0);
  const [displayResult, setDisplayResult] = useState<
    DisplayResult | undefined
  >();

  function startRun() {
    setDisplayResult(undefined);
  }

  function loadResult(
    model: OptimisationViewModel,
    source: SourceFileViewModel,
  ) {
    nextRunIdRef.current += 1;
    setDisplayResult({
      key: `run:${nextRunIdRef.current}`,
      model,
      source: { status: "available", data: source },
    });
  }

  return (
    <main
      data-workspace-theme
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
        <ExplanationSessionProvider key={displayResult.key}>
          <OptimisationWorkspace
            model={displayResult.model}
            source={displayResult.source}
            resultKey={displayResult.key}
            renderPassExtras={(pass) => (
              <ExplanationContainer
                input={toExplainInput(pass, displayResult.model)}
              />
            )}
          />
        </ExplanationSessionProvider>
      ) : null}
    </main>
  );
}
