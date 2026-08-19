"use client";

import { useState } from "react";

import { programReductionContent, workspaceContent } from "../content";
import type { TraceParseResult } from "../_lib/trace-model";
import { JsonlFileLoader } from "./jsonl-file-loader";
import { ReductionWorkspace } from "./reduction-workspace";

export function ProgramReductionHome() {
  const [loaded, setLoaded] = useState<{
    fileName: string;
    result: TraceParseResult;
  }>();

  if (loaded?.result.ok === true) {
    return (
      <ReductionWorkspace
        fileName={loaded.fileName}
        runs={loaded.result.runs}
        diagnostics={loaded.result.diagnostics}
        onReset={() => setLoaded(undefined)}
      />
    );
  }

  return (
    <main className="px-6 py-12">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-[var(--app-accent)] uppercase">
            {programReductionContent.eyebrow}
          </p>
          <h1 className="text-4xl font-bold">
            {programReductionContent.heading}
          </h1>
          <p className="max-w-2xl text-base text-[var(--app-text-secondary)]">
            {programReductionContent.description}
          </p>
          <p className="text-sm text-[var(--app-text-muted)]">
            {programReductionContent.privacy}
          </p>
        </div>

        {loaded?.result.ok === false ? (
          <section
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-5"
            role="alert"
          >
            <h2 className="font-semibold text-[var(--app-error)]">
              {loaded.result.message}
            </h2>
            <ul className="mt-3 max-h-48 space-y-1 overflow-auto text-sm text-[var(--app-text-secondary)]">
              {loaded.result.diagnostics.map((item, index) => (
                <li key={`${item.lineNumber}-${index}`}>
                  {workspaceContent.linePrefix} {item.lineNumber}:{" "}
                  {item.message}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 rounded-md border border-[var(--app-border)] px-4 py-2 text-sm font-semibold"
              onClick={() => setLoaded(undefined)}
            >
              {workspaceContent.tryAnother}
            </button>
          </section>
        ) : (
          <JsonlFileLoader
            onLoaded={(fileName, result) => setLoaded({ fileName, result })}
          />
        )}
      </section>
    </main>
  );
}
