"use client";

import { useMemo, useState } from "react";

import { compilerWorkspaceContent } from "../content";
import type { OptimisationViewModel } from "../_lib/optimisation-types";
import { deriveOverallIrComparison } from "../_lib/overall-ir";
import type { DiffMode, IrEmphasis } from "../_lib/workspace-state";
import { IrDiffViewer } from "./ir-diff-viewer";

const content = compilerWorkspaceContent.overallIr;

type OverallIrComparisonProps = Readonly<{
  model: OptimisationViewModel;
  irEmphasis?: IrEmphasis;
  onIrEmphasisChange?: (irEmphasis: IrEmphasis) => void;
}>;

export function OverallIrComparison({
  model,
  irEmphasis = "guided",
  onIrEmphasisChange,
}: OverallIrComparisonProps) {
  const comparison = useMemo(() => deriveOverallIrComparison(model), [model]);
  // Collapsed by default: expanded, this diff runs past 2,000px and pushes the
  // function list and Pass timeline several screens below the fold.
  const [expanded, setExpanded] = useState(false);
  const [diffMode, setDiffMode] = useState<DiffMode>("side-by-side");

  return (
    <section
      aria-labelledby="overall-ir-heading"
      className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2
            id="overall-ir-heading"
            className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
          >
            {content.heading}
          </h2>
          {comparison.status === "available" ? (
            <p className="mt-1.5 font-mono text-sm text-slate-200">
              {comparison.data.summary}
            </p>
          ) : null}
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            {comparison.status === "available"
              ? content.description
              : content.unavailable}
          </p>
        </div>
        {comparison.status === "available" ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            aria-controls="overall-ir-panel"
            className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
          >
            {expanded ? content.hide : content.show}
          </button>
        ) : null}
      </div>

      {comparison.status === "available" && expanded ? (
        <div id="overall-ir-panel" className="mt-4">
          <IrDiffViewer
            before={comparison.data.before}
            after={comparison.data.after}
            mode={diffMode}
            onModeChange={setDiffMode}
            emphasis={irEmphasis}
            onEmphasisChange={onIrEmphasisChange}
            headingId="overall-ir-diff-heading"
            heading={content.diffHeading}
            description={content.diffDescription}
          />
        </div>
      ) : null}
    </section>
  );
}
