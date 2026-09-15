import { sourcePanelContent } from "../content";
import type {
  DataAvailability,
  SourceFileViewModel,
} from "../_lib/optimisation-types";

type SourcePanelProps = Readonly<{
  source: DataAvailability<SourceFileViewModel>;
}>;

/**
 * Workspace-level orientation, not per-Pass data: the uploaded file stays
 * available whichever Pass is selected. No source-to-IR line mapping is
 * attempted; the pipeline does not emit debug locations.
 */
export function SourcePanel({ source }: SourcePanelProps) {
  return (
    <section
      aria-labelledby="source-panel-heading"
      className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-5"
    >
      <h2
        id="source-panel-heading"
        className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
      >
        {sourcePanelContent.heading}
      </h2>
      {source.status === "available" ? (
        <>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span className="font-mono text-slate-400">{source.data.name}</span>
            <span>{sourcePanelContent.description}</span>
          </p>
          <details className="mt-3 overflow-hidden rounded-xl border border-slate-800">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-300 transition hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset">
              {sourcePanelContent.toggle}
            </summary>
            <div
              className="max-h-[30rem] overflow-auto overscroll-contain border-t border-slate-800 bg-[var(--workspace-code-bg)] focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset"
              tabIndex={0}
              role="region"
              aria-label={sourcePanelContent.regionLabel}
            >
              <div className="w-max min-w-full py-2 font-mono text-[0.78rem] leading-6">
                {source.data.text.split("\n").map((line, index) => (
                  <div
                    key={`source-line-${index}`}
                    className="grid min-h-6 grid-cols-[3.5rem_minmax(0,1fr)] text-slate-300"
                  >
                    <span className="border-r border-slate-800/70 pr-3 text-right text-slate-600 select-none">
                      {index + 1}
                    </span>
                    <code className="px-4 whitespace-pre">{line || " "}</code>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </>
      ) : (
        <p className="mt-1 text-xs text-slate-500">
          {sourcePanelContent.unavailable}
        </p>
      )}
    </section>
  );
}
