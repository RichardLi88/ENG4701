"use client";

import { useMemo, useRef, type RefObject, type UIEvent } from "react";

import { createIrDiff, type IrDiffLine } from "~/app/_helpers/text-diff";

import { reductionWorkspaceContent } from "../content";

type DiffRow = Readonly<{
  before: IrDiffLine | null;
  after: IrDiffLine | null;
}>;

function alignRows(lines: ReadonlyArray<IrDiffLine>) {
  const rows: Array<DiffRow> = [];
  let removed: Array<IrDiffLine> = [];
  let added: Array<IrDiffLine> = [];

  function flushChanges() {
    const count = Math.max(removed.length, added.length);
    for (let index = 0; index < count; index += 1) {
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
      flushChanges();
      rows.push({ before: line, after: line });
    }
  }
  flushChanges();
  return rows;
}

type DiffPaneProps = Readonly<{
  side: "before" | "after";
  rows: ReadonlyArray<DiffRow>;
  paneRef: RefObject<HTMLDivElement | null>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
}>;

function DiffPane({ side, rows, paneRef, onScroll }: DiffPaneProps) {
  const isBefore = side === "before";
  const label = isBefore
    ? reductionWorkspaceContent.detail.before
    : reductionWorkspaceContent.detail.after;

  return (
    <section
      className="flex h-[32rem] min-w-0 flex-col overflow-hidden bg-[#070b12] first:border-r first:border-slate-800"
      aria-label={label}
    >
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-3 font-mono text-xs font-semibold tracking-wider text-slate-200 uppercase">
        {label}
      </header>
      <div
        ref={paneRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:ring-2 focus-visible:ring-[var(--app-focus)] focus-visible:outline-none focus-visible:ring-inset"
        tabIndex={0}
        role="region"
        aria-label={`${label}, read only`}
      >
        <div className="w-max min-w-full py-2 font-mono text-[0.78rem] leading-6 text-slate-300">
          {rows.map((row, index) => {
            const line = isBefore ? row.before : row.after;
            if (line === null) {
              return (
                <div
                  key={`${side}-empty-${index}`}
                  className="grid min-h-6 grid-cols-[2rem_3.5rem_minmax(0,1fr)] bg-slate-950/50"
                  aria-hidden="true"
                >
                  <span />
                  <span className="border-r border-slate-800" />
                  <span />
                </div>
              );
            }

            const changed = line.kind !== "unchanged";
            const lineNumber = isBefore
              ? line.beforeLineNumber
              : line.afterLineNumber;
            const tone =
              line.kind === "removed"
                ? "bg-rose-950/50 text-rose-100"
                : line.kind === "added"
                  ? "bg-emerald-950/45 text-emerald-100"
                  : "";
            const symbol = line.kind === "removed" ? "−" : "+";

            return (
              <div
                key={`${side}-${index}-${lineNumber ?? "none"}`}
                className={`grid min-h-6 grid-cols-[2rem_3.5rem_minmax(0,1fr)] ${tone}`}
              >
                <span
                  className={`text-center font-bold select-none ${
                    line.kind === "removed"
                      ? "text-rose-300"
                      : line.kind === "added"
                        ? "text-emerald-300"
                        : "text-slate-700"
                  }`}
                  aria-label={
                    changed
                      ? line.kind === "removed"
                        ? reductionWorkspaceContent.detail.diffLegendRemoved
                        : reductionWorkspaceContent.detail.diffLegendAdded
                      : undefined
                  }
                >
                  {changed ? symbol : " "}
                </span>
                <span className="border-r border-slate-800 pr-3 text-right text-slate-600 select-none">
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

type ReductionDiffViewerProps = Readonly<{
  before: string;
  after: string;
}>;

export function ReductionDiffViewer({
  before,
  after,
}: ReductionDiffViewerProps) {
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const rows = useMemo(() => {
    const diff = createIrDiff({ before, after });
    return diff.status === "unavailable" ? [] : alignRows(diff.lines);
  }, [before, after]);

  function synchroniseScroll(
    source: HTMLDivElement,
    target: HTMLDivElement | null,
  ) {
    if (target === null || syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    target.scrollTop = source.scrollTop;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }

  return (
    <section aria-label={reductionWorkspaceContent.detail.comparison}>
      <div className="mb-3 flex items-center justify-between gap-4 text-xs text-[var(--app-text-muted)]">
        <span>{reductionWorkspaceContent.detail.comparison}</span>
        <span className="flex gap-4 font-mono uppercase">
          <span className="text-rose-600">
            − {reductionWorkspaceContent.detail.diffLegendRemoved}
          </span>
          <span className="text-emerald-600">
            + {reductionWorkspaceContent.detail.diffLegendAdded}
          </span>
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <div className="grid min-w-[56rem] grid-cols-2">
          <DiffPane
            side="before"
            rows={rows}
            paneRef={beforeRef}
            onScroll={(event) =>
              synchroniseScroll(event.currentTarget, afterRef.current)
            }
          />
          <DiffPane
            side="after"
            rows={rows}
            paneRef={afterRef}
            onScroll={(event) =>
              synchroniseScroll(event.currentTarget, beforeRef.current)
            }
          />
        </div>
      </div>
    </section>
  );
}
