"use client";

import { useState } from "react";

import type { ReductionTraceViewModel } from "../_lib/reduction-trace-adapter";
import { JsonFileUpload } from "./json-file-upload";
import { ReductionWorkspace } from "./reduction-workspace";

export function ProgramReductionHome() {
  const [loadedTrace, setLoadedTrace] = useState<{
    model: ReductionTraceViewModel;
    resultKey: string;
  } | null>(null);

  return (
    <main
      data-workspace-theme
      className="min-h-screen bg-[var(--workspace-page-bg)] px-4 py-8 text-[var(--workspace-text)] transition-colors sm:px-6 lg:px-8"
    >
      <section className="mx-auto flex w-full max-w-[112rem] flex-col gap-8">
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
