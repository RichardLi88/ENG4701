"use client";

import { useState } from "react";

import { workspaceContent } from "../content";
import {
  foldLineDiff,
  visibleWhitespace,
  type LineDiffResult,
  type TokenDiffResult,
} from "../_lib/reduction-diff";

function rowTone(kind: "unchanged" | "added" | "removed") {
  return kind === "added"
    ? "bg-emerald-950/30 text-emerald-200"
    : kind === "removed"
      ? "bg-rose-950/35 text-rose-200"
      : "text-[var(--app-text-secondary)]";
}

export function LineDiffViewer({
  result,
}: Readonly<{ result: LineDiffResult }>) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const rows = foldLineDiff(result.rows, expanded);

  if (!result.changed) {
    return (
      <p className="p-5 text-sm text-[var(--app-text-muted)]">
        {workspaceContent.unchanged}
      </p>
    );
  }

  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      aria-label={workspaceContent.unifiedDiffLabel}
    >
      <div className="w-max min-w-full py-2 font-mono text-xs leading-6">
        {rows.map((row, index) => {
          if (row.kind === "fold") {
            return (
              <button
                key={`fold-${row.startIndex}`}
                type="button"
                className="grid w-full grid-cols-[3.5rem_3.5rem_2rem_minmax(20rem,1fr)] bg-[var(--app-panel)] text-left text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)]"
                onClick={() =>
                  setExpanded((current) => new Set(current).add(row.startIndex))
                }
              >
                <span />
                <span />
                <span className="text-center">⋯</span>
                <span>
                  {workspaceContent.expand} ({row.hiddenCount})
                </span>
              </button>
            );
          }
          const marker =
            row.kind === "added" ? "+" : row.kind === "removed" ? "-" : " ";
          return (
            <div
              key={`${index}-${row.beforeLineNumber ?? "x"}-${row.afterLineNumber ?? "x"}`}
              className={`grid grid-cols-[3.5rem_3.5rem_2rem_minmax(20rem,1fr)] ${rowTone(row.kind)}`}
            >
              <span className="border-r border-[var(--app-border-subtle)] pr-2 text-right text-[var(--app-text-muted)] select-none">
                {row.beforeLineNumber}
              </span>
              <span className="border-r border-[var(--app-border-subtle)] pr-2 text-right text-[var(--app-text-muted)] select-none">
                {row.afterLineNumber}
              </span>
              <span
                className="text-center font-bold select-none"
                aria-label={row.kind}
              >
                {marker}
              </span>
              <code className="px-3 whitespace-pre">{row.content || " "}</code>
              {!row.endsWithNewline ? (
                <span className="col-start-4 px-3 text-[0.68rem] text-amber-500 italic">
                  {workspaceContent.noFinalNewline}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TokenDiffViewer({
  result,
}: Readonly<{ result: TokenDiffResult }>) {
  if (!result.changed) {
    return (
      <p className="p-5 text-sm text-[var(--app-text-muted)]">
        {workspaceContent.unchanged}
      </p>
    );
  }
  return (
    <div
      className="flex flex-wrap gap-1 overflow-auto p-5 font-mono text-xs"
      tabIndex={0}
      aria-label={workspaceContent.tokenDiffLabel}
    >
      {result.rows.map((row, index) => {
        const marker =
          row.kind === "added" ? "+" : row.kind === "removed" ? "-" : "";
        return (
          <span
            key={`${index}-${row.beforeIndex ?? "x"}-${row.afterIndex ?? "x"}`}
            className={`rounded border border-[var(--app-border-subtle)] px-1.5 py-1 ${rowTone(row.kind)}`}
            title={`Before ${row.beforeIndex ?? "–"}; after ${row.afterIndex ?? "–"}`}
          >
            <span className="font-bold select-none">{marker}</span>
            {visibleWhitespace(row.text) || "∅"}
          </span>
        );
      })}
    </div>
  );
}
