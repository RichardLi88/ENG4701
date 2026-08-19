"use client";

import { useMemo } from "react";

import { irDiffContent } from "../content";
import { createIrDiff, type IrDiffLine } from "~/app/_helpers/text-diff";
import type { DiffMode } from "../_lib/workspace-state";

export type IrDiffViewerProps = Readonly<{
  before?: string | null;
  after?: string | null;
  structuredDiff?: ReadonlyArray<IrDiffLine> | null;
  mode?: DiffMode;
  onModeChange?: (mode: DiffMode) => void;
}>;

type DiffRow = Readonly<{
  before: IrDiffLine | null;
  after: IrDiffLine | null;
}>;

function alignDiffRows(lines: ReadonlyArray<IrDiffLine>): Array<DiffRow> {
  const rows: Array<DiffRow> = [];
  let removed: Array<IrDiffLine> = [];
  let added: Array<IrDiffLine> = [];

  function flushChangedLines() {
    const rowCount = Math.max(removed.length, added.length);

    for (let index = 0; index < rowCount; index += 1) {
      rows.push({
        before: removed[index] ?? null,
        after: added[index] ?? null,
      });
    }

    removed = [];
    added = [];
  }

  for (const line of lines) {
    if (line.kind === "removed") {
      removed.push(line);
    } else if (line.kind === "added") {
      added.push(line);
    } else {
      flushChangedLines();
      rows.push({ before: line, after: line });
    }
  }

  flushChangedLines();
  return rows;
}

function unavailableMessage(
  reason: "missing-before" | "missing-after" | "missing-both",
) {
  switch (reason) {
    case "missing-before":
      return "The IR snapshot before this Pass was not provided.";
    case "missing-after":
      return "The IR snapshot after this Pass was not provided.";
    case "missing-both":
      return "The IR snapshots before and after this Pass were not provided.";
  }
}

type DiffPaneProps = Readonly<{
  side: "before" | "after";
  rows: ReadonlyArray<DiffRow>;
}>;

function DiffPane({ side, rows }: DiffPaneProps) {
  const isBefore = side === "before";
  const label = isBefore ? "Before" : "After";

  return (
    <section
      className="flex min-h-80 min-w-0 flex-col overflow-hidden border-slate-800 bg-[#070b12] first:border-b xl:min-h-[30rem] xl:first:border-r xl:first:border-b-0"
      aria-label={`${label} optimisation IR`}
    >
      <header className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${isBefore ? "bg-amber-300" : "bg-emerald-300"}`}
            aria-hidden="true"
          />
          <h4 className="font-mono text-xs font-semibold tracking-[0.14em] text-slate-200 uppercase">
            {label}
          </h4>
        </div>
        <span className="font-mono text-[0.65rem] tracking-wider text-slate-500 uppercase">
          {isBefore ? "Input" : "Output"}
        </span>
      </header>

      <div
        className="min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset"
        tabIndex={0}
        role="region"
        aria-label={`${label} IR Diff, read only`}
      >
        <div className="w-max min-w-full py-2 font-mono text-[0.78rem] leading-6">
          {rows.map((row, index) => {
            const line = isBefore ? row.before : row.after;

            if (line === null) {
              return (
                <div
                  key={`${side}-empty-${index}`}
                  className="grid min-h-6 grid-cols-[2rem_3.5rem_minmax(0,1fr)] bg-slate-950/35"
                  aria-hidden="true"
                >
                  <span />
                  <span className="border-r border-slate-800/70" />
                  <span />
                </div>
              );
            }

            const changed = line.kind !== "unchanged";
            const symbol = line.kind === "removed" ? "-" : "+";
            const lineNumber = isBefore
              ? line.beforeLineNumber
              : line.afterLineNumber;
            const rowTone =
              line.kind === "removed"
                ? "bg-rose-950/35 text-rose-100"
                : line.kind === "added"
                  ? "bg-emerald-950/30 text-emerald-100"
                  : "text-slate-300";
            const symbolTone =
              line.kind === "removed"
                ? "bg-rose-400/15 text-rose-300"
                : "bg-emerald-400/15 text-emerald-300";

            return (
              <div
                key={`${side}-${index}-${lineNumber ?? "none"}`}
                className={`grid min-h-6 grid-cols-[2rem_3.5rem_minmax(0,1fr)] ${rowTone}`}
              >
                <span
                  className={`text-center font-bold select-none ${changed ? symbolTone : "text-slate-700"}`}
                  aria-label={
                    changed
                      ? line.kind === "removed"
                        ? "Removed line"
                        : "Added line"
                      : "Unchanged line"
                  }
                >
                  {changed ? symbol : " "}
                </span>
                <span className="border-r border-slate-800/70 pr-3 text-right text-slate-600 select-none">
                  {lineNumber}
                </span>
                <code className="px-4 whitespace-pre">
                  {line.content || " "}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type UnifiedDiffProps = Readonly<{
  lines: ReadonlyArray<IrDiffLine>;
}>;

function UnifiedDiff({ lines }: UnifiedDiffProps) {
  return (
    <section
      className="min-h-80 min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-[#070b12] xl:min-h-[30rem]"
      aria-label="Unified optimisation IR"
    >
      <header className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full bg-cyan-300"
            aria-hidden="true"
          />
          <h4 className="font-mono text-xs font-semibold tracking-[0.14em] text-slate-200 uppercase">
            Unified
          </h4>
        </div>
        <span className="font-mono text-[0.65rem] tracking-wider text-slate-500 uppercase">
          Before / After
        </span>
      </header>

      <div
        className="max-h-[42rem] overflow-auto overscroll-contain focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset"
        tabIndex={0}
        role="region"
        aria-label="Unified IR Diff, read only"
      >
        <div className="w-max min-w-full py-2 font-mono text-[0.78rem] leading-6">
          {lines.map((line, index) => {
            const changed = line.kind !== "unchanged";
            const symbol =
              line.kind === "removed" ? "-" : line.kind === "added" ? "+" : " ";
            const rowTone =
              line.kind === "removed"
                ? "bg-rose-950/35 text-rose-100"
                : line.kind === "added"
                  ? "bg-emerald-950/30 text-emerald-100"
                  : "text-slate-300";
            const symbolTone =
              line.kind === "removed"
                ? "bg-rose-400/15 text-rose-300"
                : "bg-emerald-400/15 text-emerald-300";

            return (
              <div
                key={`unified-${index}-${line.beforeLineNumber ?? "none"}-${line.afterLineNumber ?? "none"}`}
                className={`grid min-h-6 grid-cols-[2rem_3.5rem_3.5rem_minmax(0,1fr)] ${rowTone}`}
              >
                <span
                  className={`text-center font-bold select-none ${changed ? symbolTone : "text-slate-700"}`}
                  aria-label={
                    line.kind === "removed"
                      ? "Removed line"
                      : line.kind === "added"
                        ? "Added line"
                        : "Unchanged line"
                  }
                >
                  {symbol}
                </span>
                <span
                  className="border-r border-slate-800/70 pr-3 text-right text-slate-600 select-none"
                  aria-label={
                    line.beforeLineNumber === null
                      ? undefined
                      : `Before line ${line.beforeLineNumber}`
                  }
                  aria-hidden={line.beforeLineNumber === null}
                >
                  {line.beforeLineNumber}
                </span>
                <span
                  className="border-r border-slate-800/70 pr-3 text-right text-slate-600 select-none"
                  aria-label={
                    line.afterLineNumber === null
                      ? undefined
                      : `After line ${line.afterLineNumber}`
                  }
                  aria-hidden={line.afterLineNumber === null}
                >
                  {line.afterLineNumber}
                </span>
                <code className="px-4 whitespace-pre">
                  {line.content || " "}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const ignoreModeChange = () => undefined;

export function IrDiffViewer({
  before,
  after,
  structuredDiff,
  mode = "side-by-side",
  onModeChange = ignoreModeChange,
}: IrDiffViewerProps) {
  const { diff, rows } = useMemo(() => {
    const currentDiff = createIrDiff({ before, after, structuredDiff });

    return {
      diff: currentDiff,
      rows:
        currentDiff.status === "unavailable"
          ? []
          : alignDiffRows(currentDiff.lines),
    };
  }, [before, after, structuredDiff]);

  if (diff.status === "unavailable") {
    return (
      <section
        className="rounded-xl border border-rose-400/30 bg-rose-950/20 px-5 py-6"
        role="alert"
        aria-labelledby="ir-diff-error-heading"
      >
        <p className="font-mono text-xs font-semibold tracking-[0.16em] text-rose-300 uppercase">
          Data error
        </p>
        <h3
          id="ir-diff-error-heading"
          className="mt-2 text-base font-semibold text-rose-100"
        >
          IR comparison is unavailable
        </h3>
        <p className="mt-1 text-sm leading-6 text-rose-200/70">
          {unavailableMessage(diff.reason)}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="ir-diff-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3
            id="ir-diff-heading"
            className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
          >
            Intermediate representation
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            {mode === "side-by-side"
              ? irDiffContent.descriptions.sideBySide
              : irDiffContent.descriptions.unified}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div
            className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1"
            role="group"
            aria-label={irDiffContent.viewLabel}
          >
            {(
              [
                ["side-by-side", irDiffContent.modes.sideBySide],
                ["unified", irDiffContent.modes.unified],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                aria-pressed={mode === value}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none ${
                  mode === value
                    ? "bg-cyan-400/15 text-cyan-100"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 font-mono text-[0.68rem] tracking-wide text-slate-500 uppercase">
            <span>
              <strong className="mr-1 text-rose-300">-</strong> Removed
            </span>
            <span>
              <strong className="mr-1 text-emerald-300">+</strong> Added
            </span>
          </div>
        </div>
      </div>

      {diff.status === "unchanged" ? (
        <div
          className="mb-3 flex items-start gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-4 py-3"
          role="status"
        >
          <span
            className="mt-1 size-2 shrink-0 rounded-full bg-cyan-300"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-cyan-100">No IR changes</p>
            <p className="mt-0.5 text-xs leading-5 text-cyan-200/60">
              This Pass ran successfully but left the intermediate
              representation unchanged.
            </p>
          </div>
        </div>
      ) : null}

      {mode === "side-by-side" ? (
        <div className="grid min-w-0 overflow-hidden rounded-xl border border-slate-800 xl:grid-cols-2">
          <DiffPane side="before" rows={rows} />
          <DiffPane side="after" rows={rows} />
        </div>
      ) : (
        <UnifiedDiff lines={diff.lines} />
      )}
    </section>
  );
}
