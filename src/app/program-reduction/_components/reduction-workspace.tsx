"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  candidateStatusLabels,
  filterLabels,
  units,
  workspaceContent,
} from "../content";
import {
  createLineDiff,
  createTokenDiff,
  type LineDiffResult,
  type TokenDiffResult,
} from "../_lib/reduction-diff";
import {
  filterCandidates,
  type CandidateFilter,
} from "../_lib/reduction-workspace";
import type {
  ReductionCandidate,
  ReductionRun,
  TraceDiagnostic,
} from "../_lib/trace-model";
import { LineDiffViewer, TokenDiffViewer } from "./reduction-diff-viewer";

type ReductionWorkspaceProps = Readonly<{
  fileName: string;
  runs: ReadonlyArray<ReductionRun>;
  diagnostics: ReadonlyArray<TraceDiagnostic>;
  onReset: () => void;
}>;

const FILTERS: ReadonlyArray<CandidateFilter> = [
  "all",
  "pass",
  "fail",
  "cache-rejected",
  "cancelled",
  "internal-commit",
  "committed",
];
const CANDIDATE_WINDOW_SIZE = 100;

function filterLabel(filter: CandidateFilter) {
  if (filter === "all") return workspaceContent.allStatuses;
  if (filter === "committed") return workspaceContent.committedOnly;
  return filterLabels[filter];
}

function CandidateRow({
  candidate,
  baselineTokenCount,
  selected,
  onSelect,
}: Readonly<{
  candidate: ReductionCandidate;
  baselineTokenCount?: number;
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      className={`w-full rounded-lg border p-3 text-left transition ${selected ? "border-[var(--app-accent)] bg-[var(--app-panel)]" : "border-[var(--app-border-subtle)] hover:border-[var(--app-border)]"}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs font-semibold">
          #{candidate.sequence} · {candidate.candidateId}
        </span>
        {candidate.committed ? (
          <span className="rounded bg-violet-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-violet-500 uppercase">
            {workspaceContent.committedBadge}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
        <span>{candidateStatusLabels[candidate.status]}</span>
        <span>·</span>
        <span>
          {baselineTokenCount === undefined
            ? "?"
            : `${candidate.snapshot.tokenCount - baselineTokenCount >= 0 ? "+" : ""}${candidate.snapshot.tokenCount - baselineTokenCount}`}{" "}
          {workspaceContent.tokens}
        </span>
        {candidate.elapsedMillis !== undefined ? (
          <>
            <span>·</span>
            <span>
              {candidate.elapsedMillis} {units.milliseconds}
            </span>
          </>
        ) : null}
      </div>
      <p className="mt-1 truncate text-xs text-[var(--app-text-secondary)]">
        {candidate.edit?.kind ?? workspaceContent.internalEdit}
      </p>
    </button>
  );
}

function Diagnostics({
  diagnostics,
}: Readonly<{ diagnostics: ReadonlyArray<TraceDiagnostic> }>) {
  return (
    <details className="border-t border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {workspaceContent.diagnostics} ({diagnostics.length})
      </summary>
      {diagnostics.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--app-text-muted)]">
          {workspaceContent.noDiagnostics}
        </p>
      ) : (
        <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-xs">
          {diagnostics.map((item, index) => (
            <li
              key={`${item.lineNumber}-${index}`}
              className={
                item.severity === "error"
                  ? "text-[var(--app-error)]"
                  : "text-amber-600"
              }
            >
              {workspaceContent.linePrefix} {item.lineNumber}: {item.message}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

export function ReductionWorkspace({
  fileName,
  runs,
  diagnostics,
  onReset,
}: ReductionWorkspaceProps) {
  const [runIndex, setRunIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CandidateFilter>("all");
  const [selectedId, setSelectedId] = useState(
    runs[0]?.candidates[0]?.candidateId,
  );
  const [selectedPath, setSelectedPath] = useState<string>();
  const [mode, setMode] = useState<"lines" | "tokens">("lines");
  const [candidateWindowStart, setCandidateWindowStart] = useState(0);
  const lineCache = useRef(new Map<string, LineDiffResult>());
  const tokenCache = useRef(new Map<string, TokenDiffResult>());
  const run = runs[runIndex]!;
  const visibleCandidates = useMemo(
    () => filterCandidates(run.candidates, query, filter),
    [filter, query, run.candidates],
  );
  const selected =
    visibleCandidates.find(
      (candidate) => candidate.candidateId === selectedId,
    ) ?? visibleCandidates[0];
  const selectedIndex =
    selected === undefined ? -1 : visibleCandidates.indexOf(selected);
  const renderedCandidates = visibleCandidates.slice(
    candidateWindowStart,
    candidateWindowStart + CANDIDATE_WINDOW_SIZE,
  );
  const baseline =
    selected === undefined
      ? undefined
      : run.revisions.get(selected.baseRevision);
  const activePath =
    selected?.changedFiles.includes(selectedPath ?? "") === true
      ? selectedPath
      : selected?.changedFiles[0];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      const index =
        selected === undefined ? -1 : visibleCandidates.indexOf(selected);
      if (event.key === "j" && index < visibleCandidates.length - 1)
        setSelectedId(visibleCandidates[index + 1]?.candidateId);
      if (event.key === "k" && index > 0)
        setSelectedId(visibleCandidates[index - 1]?.candidateId);
      if (selected !== undefined && (event.key === "[" || event.key === "]")) {
        const fileIndex =
          activePath === undefined
            ? -1
            : selected.changedFiles.indexOf(activePath);
        const nextIndex = event.key === "[" ? fileIndex - 1 : fileIndex + 1;
        if (nextIndex >= 0 && nextIndex < selected.changedFiles.length)
          setSelectedPath(selected.changedFiles[nextIndex]);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activePath, selected, visibleCandidates]);

  useEffect(() => {
    if (
      selectedIndex >= 0 &&
      (selectedIndex < candidateWindowStart ||
        selectedIndex >= candidateWindowStart + CANDIDATE_WINDOW_SIZE)
    ) {
      setCandidateWindowStart(
        Math.floor(selectedIndex / CANDIDATE_WINDOW_SIZE) *
          CANDIDATE_WINDOW_SIZE,
      );
    }
  }, [candidateWindowStart, selectedIndex]);

  useEffect(() => setCandidateWindowStart(0), [filter, query, runIndex]);

  const lineResult = useMemo(() => {
    if (
      selected === undefined ||
      baseline === undefined ||
      activePath === undefined
    )
      return undefined;
    const key = `${run.id}:${selected.baseRevision}:${selected.candidateId}:${activePath}:lines`;
    const cached = lineCache.current.get(key);
    if (cached !== undefined) return cached;
    const result = createLineDiff(
      baseline.filesByPath.get(activePath),
      selected.snapshot.filesByPath.get(activePath),
    );
    lineCache.current.set(key, result);
    return result;
  }, [activePath, baseline, run.id, selected]);

  const lineSummary = useMemo(() => {
    if (selected === undefined || baseline === undefined) return undefined;
    return selected.changedFiles.reduce(
      (summary, path) => {
        const key = `${run.id}:${selected.baseRevision}:${selected.candidateId}:${path}:lines`;
        let result = lineCache.current.get(key);
        if (result === undefined) {
          result = createLineDiff(
            baseline.filesByPath.get(path),
            selected.snapshot.filesByPath.get(path),
          );
          lineCache.current.set(key, result);
        }
        return {
          addedLines: summary.addedLines + result.addedLines,
          removedLines: summary.removedLines + result.removedLines,
        };
      },
      { addedLines: 0, removedLines: 0 },
    );
  }, [baseline, run.id, selected]);

  const tokenResult = useMemo(() => {
    if (selected === undefined || baseline === undefined) return undefined;
    const key = `${run.id}:${selected.baseRevision}:${selected.candidateId}:tokens`;
    const cached = tokenCache.current.get(key);
    if (cached !== undefined) return cached;
    const result = createTokenDiff(baseline.tokens, selected.snapshot.tokens);
    tokenCache.current.set(key, result);
    return result;
  }, [baseline, run.id, selected]);

  const committedCandidates = run.candidates.filter(
    (candidate) => candidate.committed,
  );
  const previousCommit =
    selected === undefined
      ? undefined
      : [...committedCandidates]
          .reverse()
          .find((candidate) => candidate.sequence < selected.sequence);
  const nextCommit =
    selected === undefined
      ? undefined
      : committedCandidates.find(
          (candidate) => candidate.sequence > selected.sequence,
        );
  const runDiagnostics = [
    ...diagnostics,
    ...run.diagnostics.filter((item) => !diagnostics.includes(item)),
  ];

  return (
    <main className="flex min-h-[calc(100vh-4rem)] flex-col bg-[var(--app-page-bg)] text-[var(--app-text-primary)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4">
        <div className="min-w-0">
          <h1 className="truncate font-semibold">{fileName}</h1>
          <p className="text-xs text-[var(--app-text-muted)]">
            {workspaceContent.protocol}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {runs.length > 1 ? (
            <label>
              {workspaceContent.run}{" "}
              <select
                className="ml-2 rounded border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-1"
                value={runIndex}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRunIndex(next);
                  setSelectedId(runs[next]?.candidates[0]?.candidateId);
                  setSelectedPath(undefined);
                }}
              >
                {runs.map((item, index) => (
                  <option key={item.id} value={index}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <span>
            {run.candidates.length}{" "}
            {workspaceContent.candidates.toLocaleLowerCase()}
          </span>
          <span>
            {run.candidates.filter((candidate) => candidate.committed).length}{" "}
            {workspaceContent.commits.toLocaleLowerCase()}
          </span>
          <button
            type="button"
            className="rounded border border-[var(--app-border)] px-3 py-2 font-semibold hover:bg-[var(--app-panel)]"
            onClick={onReset}
          >
            {workspaceContent.openAnother}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-r border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <label className="text-xs font-semibold" htmlFor="candidate-search">
            {workspaceContent.searchLabel}
          </label>
          <input
            id="candidate-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={workspaceContent.searchPlaceholder}
            className="mt-2 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm"
          />
          <label
            className="mt-4 block text-xs font-semibold"
            htmlFor="candidate-filter"
          >
            {workspaceContent.filterLabel}
          </label>
          <select
            id="candidate-filter"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as CandidateFilter)
            }
            className="mt-2 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-sm"
          >
            {FILTERS.map((item) => (
              <option key={item} value={item}>
                {filterLabel(item)}
              </option>
            ))}
          </select>
          <div className="mt-4 max-h-[calc(100vh-15rem)] space-y-2 overflow-y-auto">
            {candidateWindowStart > 0 ? (
              <button
                type="button"
                className="w-full rounded border border-[var(--app-border)] px-3 py-2 text-xs font-semibold"
                onClick={() =>
                  setCandidateWindowStart((start) =>
                    Math.max(0, start - CANDIDATE_WINDOW_SIZE),
                  )
                }
              >
                {workspaceContent.earlierCandidates}
              </button>
            ) : null}
            {renderedCandidates.map((candidate) => (
              <CandidateRow
                key={candidate.candidateId}
                candidate={candidate}
                baselineTokenCount={
                  run.revisions.get(candidate.baseRevision)?.tokenCount
                }
                selected={candidate.candidateId === selected?.candidateId}
                onSelect={() => {
                  setSelectedId(candidate.candidateId);
                  setSelectedPath(undefined);
                }}
              />
            ))}
            {candidateWindowStart + CANDIDATE_WINDOW_SIZE <
            visibleCandidates.length ? (
              <button
                type="button"
                className="w-full rounded border border-[var(--app-border)] px-3 py-2 text-xs font-semibold"
                onClick={() =>
                  setCandidateWindowStart(
                    (start) => start + CANDIDATE_WINDOW_SIZE,
                  )
                }
              >
                {workspaceContent.laterCandidates}
              </button>
            ) : null}
            {visibleCandidates.length === 0 ? (
              <p className="p-3 text-sm text-[var(--app-text-muted)]">
                {run.candidates.length === 0
                  ? workspaceContent.noCandidates
                  : workspaceContent.noMatches}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0 p-4 sm:p-6">
          {selected === undefined ? null : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-sm text-[var(--app-text-muted)]">
                    #{selected.sequence}
                  </p>
                  <h2 className="text-2xl font-bold">{selected.candidateId}</h2>
                  <p className="mt-1 text-sm text-[var(--app-text-secondary)]">
                    {selected.edit?.description ??
                      workspaceContent.internalEdit}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded bg-[var(--app-panel)] px-3 py-1 text-sm font-semibold">
                    {candidateStatusLabels[selected.status]}
                  </span>
                  {selected.committed ? (
                    <span className="rounded bg-violet-500/15 px-3 py-1 text-sm font-semibold text-violet-500">
                      {workspaceContent.committedBadge}
                    </span>
                  ) : null}
                </div>
              </div>
              <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <dt className="text-[var(--app-text-muted)]">
                    {workspaceContent.baseRevision}
                  </dt>
                  <dd className="font-mono">{selected.baseRevision}</dd>
                </div>
                {selected.newRevision !== undefined ? (
                  <div>
                    <dt className="text-[var(--app-text-muted)]">
                      {workspaceContent.newRevision}
                    </dt>
                    <dd className="font-mono">{selected.newRevision}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[var(--app-text-muted)]">
                    {workspaceContent.tokens}
                  </dt>
                  <dd>
                    {baseline?.tokenCount ?? "–"} →{" "}
                    {selected.snapshot.tokenCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--app-text-muted)]">
                    {workspaceContent.changedFiles}
                  </dt>
                  <dd>{selected.changedFiles.length}</dd>
                </div>
                {lineSummary !== undefined ? (
                  <div>
                    <dt className="text-[var(--app-text-muted)]">
                      {workspaceContent.lineView}
                    </dt>
                    <dd>
                      <span className="text-rose-500">
                        −{lineSummary.removedLines}
                      </span>{" "}
                      /{" "}
                      <span className="text-emerald-600">
                        +{lineSummary.addedLines}
                      </span>
                    </dd>
                  </div>
                ) : null}
                {tokenResult !== undefined ? (
                  <div>
                    <dt className="text-[var(--app-text-muted)]">
                      {workspaceContent.tokenView}
                    </dt>
                    <dd>
                      <span className="text-rose-500">
                        −{tokenResult.removedTokens}
                      </span>{" "}
                      /{" "}
                      <span className="text-emerald-600">
                        +{tokenResult.addedTokens}
                      </span>
                    </dd>
                  </div>
                ) : null}
              </dl>
              {baseline === undefined ? (
                <div
                  className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-[var(--app-error)]"
                  role="alert"
                >
                  {workspaceContent.missingBaseline}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] p-3">
                    <div className="flex max-w-full gap-1 overflow-x-auto">
                      {selected.changedFiles.map((path) => (
                        <button
                          key={path}
                          type="button"
                          className={`shrink-0 rounded px-3 py-1.5 font-mono text-xs ${path === activePath ? "bg-[var(--app-accent)] text-[var(--app-accent-text)]" : "bg-[var(--app-panel)]"}`}
                          onClick={() => setSelectedPath(path)}
                        >
                          {path}
                        </button>
                      ))}
                    </div>
                    <div className="flex rounded border border-[var(--app-border)] p-0.5">
                      <button
                        type="button"
                        className={`rounded px-3 py-1 text-xs font-semibold ${mode === "lines" ? "bg-[var(--app-accent)] text-[var(--app-accent-text)]" : ""}`}
                        onClick={() => setMode("lines")}
                      >
                        {workspaceContent.lineView}
                      </button>
                      <button
                        type="button"
                        className={`rounded px-3 py-1 text-xs font-semibold ${mode === "tokens" ? "bg-[var(--app-accent)] text-[var(--app-accent-text)]" : ""}`}
                        onClick={() => setMode("tokens")}
                      >
                        {workspaceContent.tokenView}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-5 border-b border-[var(--app-border-subtle)] px-4 py-2 text-xs text-[var(--app-text-muted)]">
                    {mode === "lines" && lineResult !== undefined ? (
                      <>
                        <span className="text-rose-500">
                          −{lineResult.removedLines} lines
                        </span>
                        <span className="text-emerald-600">
                          +{lineResult.addedLines} lines
                        </span>
                      </>
                    ) : tokenResult !== undefined ? (
                      <>
                        <span className="text-rose-500">
                          −{tokenResult.removedTokens} tokens
                        </span>
                        <span className="text-emerald-600">
                          +{tokenResult.addedTokens} tokens
                        </span>
                      </>
                    ) : null}
                  </div>
                  {mode === "lines" && selected.changedFiles.length === 0 ? (
                    <p className="p-5 text-sm text-[var(--app-text-muted)]">
                      {workspaceContent.noChangedFiles}
                    </p>
                  ) : mode === "lines" && lineResult !== undefined ? (
                    <LineDiffViewer
                      key={`${selected.candidateId}:${activePath}`}
                      result={lineResult}
                    />
                  ) : tokenResult !== undefined ? (
                    <TokenDiffViewer result={tokenResult} />
                  ) : null}
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--app-border-subtle)] pt-4">
                <button
                  type="button"
                  disabled={previousCommit === undefined}
                  className="rounded border border-[var(--app-border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  onClick={() => {
                    setQuery("");
                    setFilter("committed");
                    setSelectedId(previousCommit?.candidateId);
                    setSelectedPath(undefined);
                  }}
                >
                  {workspaceContent.previousCommit}
                </button>
                <button
                  type="button"
                  disabled={nextCommit === undefined}
                  className="rounded border border-[var(--app-border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  onClick={() => {
                    setQuery("");
                    setFilter("committed");
                    setSelectedId(nextCommit?.candidateId);
                    setSelectedPath(undefined);
                  }}
                >
                  {workspaceContent.nextCommit}
                </button>
              </div>
              <div className="flex justify-between">
                <button
                  type="button"
                  disabled={selectedIndex <= 0}
                  className="rounded border border-[var(--app-border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  onClick={() =>
                    setSelectedId(
                      visibleCandidates[selectedIndex - 1]?.candidateId,
                    )
                  }
                >
                  {workspaceContent.previous}
                </button>
                <button
                  type="button"
                  disabled={
                    selectedIndex < 0 ||
                    selectedIndex >= visibleCandidates.length - 1
                  }
                  className="rounded border border-[var(--app-border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  onClick={() =>
                    setSelectedId(
                      visibleCandidates[selectedIndex + 1]?.candidateId,
                    )
                  }
                >
                  {workspaceContent.next}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      <Diagnostics diagnostics={runDiagnostics} />
    </main>
  );
}
