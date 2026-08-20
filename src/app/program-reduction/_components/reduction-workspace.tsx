"use client";

import { useState } from "react";

import { reductionWorkspaceContent, units } from "../content";
import type {
  ReductionFileComparison,
  ReductionTraceViewModel,
} from "../_lib/reduction-trace-adapter";
import { ReductionDiffViewer } from "./reduction-diff-viewer";

type ReductionWorkspaceProps = Readonly<{
  model: ReductionTraceViewModel;
  resultKey: string;
}>;

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) {
    return reductionWorkspaceContent.summary.unavailable;
  }
  return `${(milliseconds / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} s`;
}

function SummaryCard({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-panel)] p-4">
      <dt className="text-xs font-semibold tracking-wide text-[var(--app-text-muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-[var(--app-text-primary)]">
        {value}
      </dd>
    </div>
  );
}

function FileTabs({
  files,
  selectedPath,
  onSelect,
}: Readonly<{
  files: ReadonlyArray<ReductionFileComparison>;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}>) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--app-text-muted)] uppercase">
        {reductionWorkspaceContent.detail.files}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {files.map((file) => (
          <button
            key={file.path}
            type="button"
            role="tab"
            aria-selected={file.path === selectedPath}
            onClick={() => onSelect(file.path)}
            className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs transition focus-visible:ring-2 focus-visible:ring-[var(--app-focus)] focus-visible:outline-none ${
              file.path === selectedPath
                ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-text)]"
                : "border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-text-secondary)] hover:border-[var(--app-accent)]"
            }`}
          >
            {file.path}
            <span className="text-[0.65rem] opacity-75">{file.kind}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReductionWorkspace({
  model,
  resultKey,
}: ReductionWorkspaceProps) {
  return <ReductionWorkspaceSession key={resultKey} model={model} />;
}

function ReductionWorkspaceSession({
  model,
}: Readonly<{ model: ReductionTraceViewModel }>) {
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const selectedStep = model.steps[selectedStepIndex];
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
    selectedStep?.initialFilePath ?? null,
  );

  function selectStep(index: number) {
    const step = model.steps[index];
    if (step === undefined) {
      return;
    }
    setSelectedStepIndex(index);
    setSelectedFilePath(step.initialFilePath);
  }

  const selectedFile =
    selectedStep?.files.find((file) => file.path === selectedFilePath) ??
    selectedStep?.files[0];
  const unavailable = reductionWorkspaceContent.detail.unavailable;
  const originalTokens = model.originalTokens?.toLocaleString() ?? unavailable;
  const finalTokens = model.finalTokens?.toLocaleString() ?? unavailable;
  const totalReduction =
    model.tokensRemoved === null
      ? unavailable
      : `${model.tokensRemoved.toLocaleString()} ${units.tokens} (${model.reductionPercent?.toFixed(1) ?? "0.0"}%)`;

  return (
    <div className="space-y-6">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label={reductionWorkspaceContent.summary.status}
          value={model.status}
        />
        <SummaryCard
          label={reductionWorkspaceContent.summary.source}
          value={
            model.sourceFile ?? reductionWorkspaceContent.summary.unavailable
          }
        />
        <SummaryCard
          label={reductionWorkspaceContent.summary.reduction}
          value={`${originalTokens} → ${finalTokens}; ${totalReduction}`}
        />
        <SummaryCard
          label={reductionWorkspaceContent.summary.acceptedSteps}
          value={model.steps.length.toLocaleString()}
        />
        <SummaryCard
          label={reductionWorkspaceContent.summary.candidates}
          value={model.candidateCount.toLocaleString()}
        />
        <SummaryCard
          label={reductionWorkspaceContent.summary.duration}
          value={formatDuration(model.durationMillis)}
        />
      </dl>

      {selectedStep === undefined ? (
        <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center">
          <h2 className="text-lg font-semibold">
            {reductionWorkspaceContent.empty.heading}
          </h2>
          <p className="mt-2 text-sm text-[var(--app-text-muted)]">
            {reductionWorkspaceContent.empty.description}
          </p>
        </section>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
            <h2 className="font-semibold">
              {reductionWorkspaceContent.timeline.heading}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={selectedStepIndex === 0}
                onClick={() => selectStep(selectedStepIndex - 1)}
                className="rounded-md border border-[var(--app-border)] px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← {reductionWorkspaceContent.timeline.previous}
              </button>
              <button
                type="button"
                disabled={selectedStepIndex === model.steps.length - 1}
                onClick={() => selectStep(selectedStepIndex + 1)}
                className="rounded-md border border-[var(--app-border)] px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {reductionWorkspaceContent.timeline.next} →
              </button>
            </div>
            <ol className="mt-3 max-h-[calc(100vh-12rem)] space-y-2 overflow-y-auto pr-1">
              {model.steps.map((step, index) => (
                <li key={step.index}>
                  <button
                    type="button"
                    onClick={() => selectStep(index)}
                    aria-current={
                      index === selectedStepIndex ? "step" : undefined
                    }
                    className={`w-full rounded-md border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--app-focus)] focus-visible:outline-none ${
                      index === selectedStepIndex
                        ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-[var(--app-accent-text)]"
                        : "border-[var(--app-border-subtle)] bg-[var(--app-panel)] hover:border-[var(--app-accent)]"
                    }`}
                  >
                    <span className="flex justify-between gap-3 text-xs font-semibold">
                      <span>
                        {reductionWorkspaceContent.timeline.step} {index + 1}
                      </span>
                      <span>
                        −{step.tokensRemoved} {units.tokens}
                      </span>
                    </span>
                    <span className="mt-2 flex min-w-0 items-center gap-2 text-xs">
                      <span className="shrink-0 rounded bg-black/10 px-1.5 py-0.5 font-mono font-semibold">
                        {step.transformationKind ??
                          reductionWorkspaceContent.timeline
                            .unknownTransformation}
                      </span>
                      {step.reducer !== null ? (
                        <span className="truncate opacity-75">
                          {step.reducer}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <section className="min-w-0 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6">
            <div className="mb-6 flex flex-col gap-5 border-b border-[var(--app-border-subtle)] pb-5">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[var(--app-accent)] uppercase">
                  {reductionWorkspaceContent.timeline.step}{" "}
                  {selectedStepIndex + 1} / {model.steps.length}
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  {selectedStep.transformationKind ??
                    reductionWorkspaceContent.timeline.unknownTransformation}
                </h2>
                {selectedStep.description !== null ? (
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--app-text-secondary)]">
                    {selectedStep.description}
                  </p>
                ) : null}
              </div>
              <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                {[
                  [
                    reductionWorkspaceContent.detail.tokensBefore,
                    selectedStep.tokensBefore.toLocaleString(),
                  ],
                  [
                    reductionWorkspaceContent.detail.tokensAfter,
                    selectedStep.tokensAfter.toLocaleString(),
                  ],
                  [
                    reductionWorkspaceContent.detail.tokensRemoved,
                    selectedStep.tokensRemoved.toLocaleString(),
                  ],
                  [
                    reductionWorkspaceContent.detail.reducer,
                    selectedStep.reducer ?? unavailable,
                  ],
                  [
                    reductionWorkspaceContent.detail.reducerPass,
                    selectedStep.reducerPass?.toLocaleString() ?? unavailable,
                  ],
                  [
                    reductionWorkspaceContent.detail.acceptedSequence,
                    selectedStep.acceptedAtSeq.toLocaleString(),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-[var(--app-text-muted)]">
                      {label}
                    </dt>
                    <dd className="mt-1 font-mono text-sm break-words">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <FileTabs
              files={selectedStep.files}
              selectedPath={selectedFile?.path ?? null}
              onSelect={setSelectedFilePath}
            />
            {selectedFile === undefined ? (
              <p className="rounded-lg border border-[var(--app-border)] p-5 text-sm text-[var(--app-text-muted)]">
                {reductionWorkspaceContent.detail.noFiles}
              </p>
            ) : (
              <ReductionDiffViewer
                before={selectedFile.before}
                after={selectedFile.after}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
