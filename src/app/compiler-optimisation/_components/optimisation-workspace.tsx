"use client";

import { useState, type ReactNode } from "react";

import type { OptimisationWorkspaceProps } from "../_lib/optimisation-types";
import { FunctionSelector } from "./function-selector";
import { OptimisationSummary } from "./optimisation-summary";
import { PassDetail } from "./pass-detail";
import { PassList } from "./pass-list";
import { StatusPanel } from "./status-panel";

type InteractiveOptimisationWorkspaceProps = OptimisationWorkspaceProps &
  Readonly<{ children?: ReactNode }>;

export function OptimisationWorkspace({
  model,
  children,
}: InteractiveOptimisationWorkspaceProps) {
  const [selectedFunctionId, setSelectedFunctionId] = useState<
    string | undefined
  >(() => model.functions[0]?.id);
  const [selectedPassId, setSelectedPassId] = useState<string | undefined>(
    () => model.functions[0]?.passes[0]?.id,
  );
  const selectedFunction =
    (selectedFunctionId === undefined
      ? undefined
      : model.functionsById[selectedFunctionId]) ?? model.functions[0];
  const selectedPass = selectedFunction?.passes.find(
    (pass) => pass.id === selectedPassId,
  );

  function selectFunction(functionId: string) {
    const nextFunction = model.functionsById[functionId];

    if (nextFunction === undefined) return;

    setSelectedFunctionId(nextFunction.id);
    setSelectedPassId(nextFunction.passes[0]?.id);
  }

  function selectPass(passId: string) {
    if (selectedFunction?.passes.some((pass) => pass.id === passId)) {
      setSelectedPassId(passId);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
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
                selectedFunctionId={selectedFunction.id}
                onSelect={selectFunction}
              />
              <PassList
                passes={selectedFunction.passes}
                selectedPassId={selectedPass?.id}
                onSelect={selectPass}
              />
            </aside>

            <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-6 lg:p-7">
              {selectedPass === undefined ? (
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
    </main>
  );
}
