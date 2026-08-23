"use client";

import { Fragment, useMemo, useState } from "react";

import { reductionWorkspaceContent, units } from "../content";
import {
  buildCandidateComparison,
  type ReductionCandidateView,
  type ReductionFileComparison,
  type ReductionStepView,
  type ReductionTraceViewModel,
} from "../_lib/reduction-trace-adapter";
import { CumulativeReductionChart } from "./cumulative-reduction-chart";
import { ReductionDiffViewer } from "./reduction-diff-viewer";

type ReductionWorkspaceProps = Readonly<{
  model: ReductionTraceViewModel;
  resultKey: string;
}>;

type TimelineMode = "accepted" | "all";

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) {
    return reductionWorkspaceContent.summary.unavailable;
  }
  return `${(milliseconds / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} s`;
}

function formatTokenDelta(tokensRemoved: number) {
  if (tokensRemoved > 0) {
    return `−${tokensRemoved.toLocaleString()}`;
  }
  if (tokensRemoved < 0) {
    return `+${Math.abs(tokensRemoved).toLocaleString()}`;
  }
  return "0";
}

function SummaryCard({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-lg border border-[var(--workspace-border-muted)] bg-[var(--workspace-inset-bg)] p-4">
      <dt className="text-xs font-semibold tracking-wide text-[var(--workspace-text-muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold text-[var(--workspace-text)]">
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
      <p className="mb-2 text-xs font-semibold tracking-wide text-[var(--workspace-text-muted)] uppercase">
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
            className={`flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 font-mono text-xs transition focus-visible:ring-2 focus-visible:ring-[var(--workspace-focus)] focus-visible:outline-none ${
              file.path === selectedPath
                ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent)] text-[var(--workspace-accent-text)]"
                : "border-[var(--workspace-border)] bg-[var(--workspace-inset-bg)] text-[var(--workspace-text-secondary)] hover:border-[var(--workspace-accent)]"
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

function CandidateBlock({
  stateId,
  candidates,
  expanded,
  selectedCandidateId,
  onToggle,
  onSelect,
}: Readonly<{
  stateId: string;
  candidates: ReadonlyArray<ReductionCandidateView>;
  expanded: boolean;
  selectedCandidateId: string | null;
  onToggle: () => void;
  onSelect: (candidate: ReductionCandidateView) => void;
}>) {
  if (candidates.length === 0) {
    return null;
  }

  const statusCounts = new Map<string, number>();
  for (const candidate of candidates) {
    statusCounts.set(
      candidate.status,
      (statusCounts.get(candidate.status) ?? 0) + 1,
    );
  }

  return (
    <li className="rounded-md border border-dashed border-[var(--workspace-border)] bg-[var(--workspace-inset-bg)]">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={`candidate-block-${stateId}`}
        onClick={onToggle}
        className="w-full p-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--workspace-focus)] focus-visible:outline-none"
      >
        <span className="flex items-center justify-between gap-3 text-xs font-semibold">
          <span>
            {candidates.length.toLocaleString()}{" "}
            {reductionWorkspaceContent.timeline.otherCandidates}
          </span>
          <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        </span>
        <span className="mt-1 block truncate font-mono text-[0.65rem] text-[var(--workspace-text-muted)]">
          {[...statusCounts]
            .map(([status, count]) => `${status} ${count}`)
            .join(" · ")}
        </span>
      </button>
      {expanded ? (
        <ul
          id={`candidate-block-${stateId}`}
          className="max-h-80 space-y-1 overflow-y-auto border-t border-[var(--workspace-border-muted)] p-2"
        >
          {candidates.map((candidate) => (
            <li key={candidate.candidateId}>
              <button
                type="button"
                aria-current={
                  selectedCandidateId === candidate.candidateId
                    ? "true"
                    : undefined
                }
                onClick={() => onSelect(candidate)}
                className={`w-full rounded p-2 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-[var(--workspace-focus)] focus-visible:outline-none ${
                  selectedCandidateId === candidate.candidateId
                    ? "bg-[var(--workspace-accent)] text-[var(--workspace-accent-text)]"
                    : "hover:bg-[var(--workspace-surface)]"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="rounded bg-black/10 px-1.5 py-0.5 font-mono font-semibold">
                    {candidate.transformationKind}
                  </span>
                  <span className="font-mono opacity-75">
                    {formatTokenDelta(candidate.tokensRemoved)} {units.tokens}
                  </span>
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-2 opacity-75">
                  <span className="shrink-0 font-semibold">
                    {candidate.status}
                  </span>
                  <span className="truncate">
                    {candidate.reducer ?? candidate.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
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
  const [timelineMode, setTimelineMode] = useState<TimelineMode>("accepted");
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const selectedStep = model.steps[selectedStepIndex];
  const [selectedCandidate, setSelectedCandidate] =
    useState<ReductionCandidateView | null>(null);
  const [expandedStateId, setExpandedStateId] = useState<string | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
    selectedStep?.initialFilePath ?? null,
  );
  const candidateComparison = useMemo(
    () =>
      selectedCandidate === null
        ? null
        : buildCandidateComparison(selectedCandidate),
    [selectedCandidate],
  );

  function selectStep(index: number) {
    const step = model.steps[index];
    if (step === undefined) {
      return;
    }
    setSelectedStepIndex(index);
    setSelectedCandidate(null);
    setSelectedFilePath(step.initialFilePath);
  }

  function selectCandidate(candidate: ReductionCandidateView) {
    const comparison = buildCandidateComparison(candidate);
    setSelectedCandidate(candidate);
    setSelectedFilePath(comparison.ok ? comparison.initialFilePath : null);
  }

  function changeTimelineMode(mode: TimelineMode) {
    setTimelineMode(mode);
    if (mode === "accepted" && selectedCandidate !== null) {
      const followingStep = model.steps.findIndex(
        (step) => step.fromStateId === selectedCandidate.baseStateId,
      );
      selectStep(followingStep < 0 ? 0 : followingStep);
    }
  }

  const selectedFiles =
    selectedCandidate === null
      ? (selectedStep?.files ?? [])
      : candidateComparison?.ok
        ? candidateComparison.files
        : [];
  const selectedFile =
    selectedFiles.find((file) => file.path === selectedFilePath) ??
    selectedFiles[0];
  const unavailable = reductionWorkspaceContent.detail.unavailable;
  const originalTokens = model.originalTokens?.toLocaleString() ?? unavailable;
  const finalTokens = model.finalTokens?.toLocaleString() ?? unavailable;
  const totalReduction =
    model.tokensRemoved === null
      ? unavailable
      : `${model.tokensRemoved.toLocaleString()} ${units.tokens} (${model.reductionPercent?.toFixed(1) ?? "0.0"}%)`;
  const hasCandidateGroups = Object.values(model.candidatesByState).some(
    (candidates) => candidates.length > 0,
  );
  const hasVisibleTimeline =
    model.steps.length > 0 || (timelineMode === "all" && hasCandidateGroups);
  const finalStateId =
    model.steps.at(-1)?.toStateId ?? model.originalStateId ?? "initial";

  const detailKind =
    selectedCandidate?.transformationKind ??
    selectedStep?.transformationKind ??
    reductionWorkspaceContent.timeline.unknownTransformation;
  const detailDescription =
    selectedCandidate?.description ??
    selectedStep?.description ??
    selectedStep?.systemReason ??
    null;
  const detailMetrics: ReadonlyArray<readonly [string, string]> =
    selectedCandidate !== null
      ? [
          [
            reductionWorkspaceContent.detail.tokensBefore,
            selectedCandidate.tokensBefore.toLocaleString(),
          ],
          [
            reductionWorkspaceContent.detail.tokensAfter,
            selectedCandidate.tokensAfter.toLocaleString(),
          ],
          [
            reductionWorkspaceContent.detail.tokensRemoved,
            formatTokenDelta(selectedCandidate.tokensRemoved),
          ],
          [
            reductionWorkspaceContent.detail.candidateStatus,
            selectedCandidate.status,
          ],
          [
            reductionWorkspaceContent.detail.reducer,
            selectedCandidate.reducer ?? unavailable,
          ],
          [
            reductionWorkspaceContent.detail.reducerPass,
            selectedCandidate.reducerPass.toLocaleString(),
          ],
          [
            reductionWorkspaceContent.detail.testDuration,
            formatDuration(selectedCandidate.elapsedMillis),
          ],
          [
            reductionWorkspaceContent.detail.exitCode,
            selectedCandidate.exitCode?.toLocaleString() ?? unavailable,
          ],
        ]
      : selectedStep === undefined
        ? []
        : [
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
          ];

  function acceptedStepItem(step: ReductionStepView, index: number) {
    return (
      <li key={`step-${step.index}`}>
        <button
          type="button"
          onClick={() => selectStep(index)}
          aria-current={
            selectedCandidate === null && index === selectedStepIndex
              ? "step"
              : undefined
          }
          className={`w-full rounded-md border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-[var(--workspace-focus)] focus-visible:outline-none ${
            selectedCandidate === null && index === selectedStepIndex
              ? "border-[var(--workspace-accent)] bg-[var(--workspace-accent)] text-[var(--workspace-accent-text)]"
              : "border-[var(--workspace-border-muted)] bg-[var(--workspace-inset-bg)] hover:border-[var(--workspace-accent)]"
          }`}
        >
          <span className="flex justify-between gap-3 text-xs font-semibold">
            <span>
              {reductionWorkspaceContent.timeline.step} {index + 1}
            </span>
            <span>
              {formatTokenDelta(step.tokensRemoved)} {units.tokens}
            </span>
          </span>
          <span className="mt-2 flex min-w-0 items-center gap-2 text-xs">
            <span className="shrink-0 rounded bg-black/10 px-1.5 py-0.5 font-mono font-semibold">
              {step.transformationKind ??
                reductionWorkspaceContent.timeline.unknownTransformation}
            </span>
            {step.reducer !== null ? (
              <span className="truncate opacity-75">{step.reducer}</span>
            ) : null}
          </span>
        </button>
      </li>
    );
  }

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

      <CumulativeReductionChart
        originalTokens={model.originalTokens}
        steps={model.steps}
      />

      <div
        className="inline-flex rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-inset-bg)] p-1"
        role="group"
        aria-label={reductionWorkspaceContent.timeline.modeLabel}
      >
        {(
          [
            ["accepted", reductionWorkspaceContent.timeline.acceptedOnly],
            ["all", reductionWorkspaceContent.timeline.allAttempts],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={timelineMode === mode}
            onClick={() => changeTimelineMode(mode)}
            className={`rounded-md px-3 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-[var(--workspace-focus)] focus-visible:outline-none ${
              timelineMode === mode
                ? "bg-[var(--workspace-accent)] text-[var(--workspace-accent-text)]"
                : "text-[var(--workspace-text-secondary)] hover:text-[var(--workspace-text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!hasVisibleTimeline ? (
        <section className="rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-8 text-center">
          <h2 className="text-lg font-semibold">
            {reductionWorkspaceContent.empty.heading}
          </h2>
          <p className="mt-2 text-sm text-[var(--workspace-text-muted)]">
            {reductionWorkspaceContent.empty.description}
          </p>
        </section>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="min-w-0 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
            <h2 className="font-semibold">
              {timelineMode === "accepted"
                ? reductionWorkspaceContent.timeline.heading
                : reductionWorkspaceContent.timeline.allAttemptsHeading}
            </h2>
            {model.steps.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={selectedStepIndex === 0}
                  onClick={() => selectStep(selectedStepIndex - 1)}
                  className="rounded-md border border-[var(--workspace-border)] px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← {reductionWorkspaceContent.timeline.previous}
                </button>
                <button
                  type="button"
                  disabled={selectedStepIndex === model.steps.length - 1}
                  onClick={() => selectStep(selectedStepIndex + 1)}
                  className="rounded-md border border-[var(--workspace-border)] px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reductionWorkspaceContent.timeline.next} →
                </button>
              </div>
            ) : null}
            <ol className="mt-3 max-h-[calc(100vh-12rem)] space-y-2 overflow-y-auto pr-1">
              {timelineMode === "all" ? (
                <li className="rounded-md border border-[var(--workspace-border-muted)] bg-[var(--workspace-inset-bg)] p-3 text-xs font-semibold">
                  {reductionWorkspaceContent.timeline.original}
                </li>
              ) : null}
              {model.steps.map((step, index) =>
                timelineMode === "accepted" ? (
                  acceptedStepItem(step, index)
                ) : (
                  <Fragment key={`stage-${step.fromStateId}`}>
                    <CandidateBlock
                      stateId={step.fromStateId}
                      candidates={
                        model.candidatesByState[step.fromStateId] ?? []
                      }
                      expanded={expandedStateId === step.fromStateId}
                      selectedCandidateId={
                        selectedCandidate?.candidateId ?? null
                      }
                      onToggle={() =>
                        setExpandedStateId((current) =>
                          current === step.fromStateId
                            ? null
                            : step.fromStateId,
                        )
                      }
                      onSelect={selectCandidate}
                    />
                    {acceptedStepItem(step, index)}
                  </Fragment>
                ),
              )}
              {timelineMode === "all" ? (
                <CandidateBlock
                  stateId={finalStateId}
                  candidates={model.candidatesByState[finalStateId] ?? []}
                  expanded={expandedStateId === finalStateId}
                  selectedCandidateId={selectedCandidate?.candidateId ?? null}
                  onToggle={() =>
                    setExpandedStateId((current) =>
                      current === finalStateId ? null : finalStateId,
                    )
                  }
                  onSelect={selectCandidate}
                />
              ) : null}
            </ol>
          </aside>

          <section className="min-w-0 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-4 sm:p-6">
            {selectedStep === undefined && selectedCandidate === null ? (
              <div className="p-4 text-sm text-[var(--workspace-text-muted)]">
                {reductionWorkspaceContent.empty.description}
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-col gap-5 border-b border-[var(--workspace-border-muted)] pb-5">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-[var(--workspace-accent)] uppercase">
                      {selectedCandidate === null
                        ? `${reductionWorkspaceContent.timeline.step} ${selectedStepIndex + 1} / ${model.steps.length}`
                        : `${reductionWorkspaceContent.timeline.candidate} ${selectedCandidate.candidateId}`}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">{detailKind}</h2>
                    {detailDescription !== null ? (
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--workspace-text-secondary)]">
                        {detailDescription}
                      </p>
                    ) : null}
                  </div>
                  <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {detailMetrics.map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-[var(--workspace-text-muted)]">
                          {label}
                        </dt>
                        <dd className="mt-1 font-mono text-sm break-words">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {candidateComparison !== null && !candidateComparison.ok ? (
                  <div
                    className="rounded-lg border border-[var(--workspace-error)] p-5"
                    role="alert"
                  >
                    <h3 className="font-semibold">
                      {reductionWorkspaceContent.detail.unavailableComparison}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--workspace-text-muted)]">
                      {candidateComparison.message}
                    </p>
                  </div>
                ) : (
                  <>
                    <FileTabs
                      files={selectedFiles}
                      selectedPath={selectedFile?.path ?? null}
                      onSelect={setSelectedFilePath}
                    />
                    {selectedFile === undefined ? (
                      <p className="rounded-lg border border-[var(--workspace-border)] p-5 text-sm text-[var(--workspace-text-muted)]">
                        {reductionWorkspaceContent.detail.noFiles}
                      </p>
                    ) : (
                      <ReductionDiffViewer
                        before={selectedFile.before}
                        after={selectedFile.after}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
