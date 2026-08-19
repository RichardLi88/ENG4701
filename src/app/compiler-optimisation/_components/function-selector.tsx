import { memo } from "react";

import { compilerWorkspaceContent } from "../content";
import type { OptimisationFunctionViewModel } from "../_lib/optimisation-types";

type FunctionSelectorProps = Readonly<{
  functions: ReadonlyArray<OptimisationFunctionViewModel>;
  globalPassCount: number;
  selectedFunctionId?: string;
  onSelectGlobal: () => void;
  onSelect: (functionId: string) => void;
}>;

export const FunctionSelector = memo(function FunctionSelector({
  functions,
  globalPassCount,
  selectedFunctionId,
  onSelectGlobal,
  onSelect,
}: FunctionSelectorProps) {
  const globalSelected = selectedFunctionId === undefined;

  return (
    <section aria-labelledby="functions-heading" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="functions-heading"
          className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
        >
          {compilerWorkspaceContent.scopes.heading}
        </h2>
        <span className="font-mono text-xs text-slate-500">
          {functions.length + (globalPassCount > 0 ? 1 : 0)}
        </span>
      </div>
      <ul className="space-y-2">
        {globalPassCount > 0 ? (
          <li>
            <button
              type="button"
              onClick={onSelectGlobal}
              className={`w-full min-w-0 rounded-xl border px-3 py-3 text-left transition focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
                globalSelected
                  ? "border-cyan-400/60 bg-cyan-400/10"
                  : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
              }`}
              aria-current={globalSelected ? "true" : undefined}
              aria-pressed={globalSelected}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${globalSelected ? "bg-cyan-300" : "bg-slate-600"}`}
                  aria-hidden="true"
                />
                <p className="min-w-0 truncate font-mono text-sm font-semibold text-slate-100">
                  {compilerWorkspaceContent.scopes.globalName}
                </p>
                <span className="ml-auto shrink-0 rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[0.65rem] text-slate-400">
                  {globalPassCount} {globalPassCount === 1 ? "Pass" : "Passes"}
                </span>
              </div>
              <p className="mt-1.5 truncate pl-3.5 font-mono text-xs text-slate-500">
                {compilerWorkspaceContent.scopes.globalDescription}
              </p>
            </button>
          </li>
        ) : null}
        {functions.map((fn) => {
          const selected = fn.id === selectedFunctionId;
          const passCountLabel = `${fn.passes.length} ${
            fn.passes.length === 1 ? "Pass" : "Passes"
          }`;

          return (
            <li key={fn.id}>
              <button
                type="button"
                onClick={() => onSelect(fn.id)}
                className={`w-full min-w-0 rounded-xl border px-3 py-3 text-left transition focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
                  selected
                    ? "border-cyan-400/60 bg-cyan-400/10"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
                }`}
                aria-current={selected ? "true" : undefined}
                aria-pressed={selected}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${selected ? "bg-cyan-300" : "bg-slate-600"}`}
                    aria-hidden="true"
                  />
                  <p
                    className="min-w-0 truncate font-mono text-sm font-semibold text-slate-100"
                    title={fn.name}
                  >
                    {fn.name}
                  </p>
                  <span className="ml-auto shrink-0 rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[0.65rem] text-slate-400">
                    {passCountLabel}
                  </span>
                </div>
                <p
                  className="mt-1.5 truncate pl-3.5 font-mono text-xs text-slate-500"
                  title={
                    fn.signature.status === "available"
                      ? fn.signature.data
                      : "Signature not provided"
                  }
                >
                  {fn.signature.status === "available"
                    ? fn.signature.data
                    : "Signature unavailable"}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
});
