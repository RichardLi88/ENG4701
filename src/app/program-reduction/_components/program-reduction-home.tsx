"use client";

import { useState } from "react";

import { programReductionContent } from "../content";
import type { ReductionTraceViewModel } from "../_lib/reduction-trace-adapter";
import { JsonFileUpload } from "./json-file-upload";
import { ReductionWorkspace } from "./reduction-workspace";

export function ProgramReductionHome() {
  const [loadedTrace, setLoadedTrace] = useState<{
    model: ReductionTraceViewModel;
    resultKey: string;
  } | null>(null);

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto flex w-full max-w-[112rem] flex-col gap-8">
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
        </div>

        <JsonFileUpload
          hasLoadedTrace={loadedTrace !== null}
          onTraceLoaded={(model, fileName) =>
            setLoadedTrace({
              model,
              resultKey: `${fileName}:${Date.now()}`,
            })
          }
        />

        {loadedTrace !== null ? (
          <ReductionWorkspace
            model={loadedTrace.model}
            resultKey={loadedTrace.resultKey}
          />
        ) : null}
      </section>
    </main>
  );
}
