import type { OptimisationViewModel } from "../_lib/optimisation-types";

type OptimisationSummaryProps = Readonly<{
  model: OptimisationViewModel;
}>;

export function OptimisationSummary({ model }: OptimisationSummaryProps) {
  const summaryItems = [
    { label: "Functions", value: model.summary.functionCount },
    { label: "Passes", value: model.summary.totalPassCount },
    { label: "Changed", value: model.summary.changedPassCount },
    { label: "Unchanged", value: model.summary.unchangedPassCount },
  ] as const;

  return (
    <section aria-labelledby="run-summary-heading">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2
          id="run-summary-heading"
          className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
        >
          Run summary
        </h2>
        <span className="font-mono text-xs text-slate-500">
          schema {model.schemaVersion}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3"
          >
            <dt className="text-xs text-slate-500">{item.label}</dt>
            <dd className="mt-1 font-mono text-xl font-semibold text-slate-100 tabular-nums">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="mt-2 flex flex-wrap gap-2 text-xs">
        <div className="rounded-full border border-slate-800 px-3 py-1.5 text-slate-400">
          <dt className="inline">Transforms </dt>
          <dd className="inline font-mono text-slate-200">
            {model.summary.transformPassCount}
          </dd>
        </div>
        <div className="rounded-full border border-slate-800 px-3 py-1.5 text-slate-400">
          <dt className="inline">Analyses </dt>
          <dd className="inline font-mono text-slate-200">
            {model.summary.analysisPassCount}
          </dd>
        </div>
        <div className="rounded-full border border-slate-800 px-3 py-1.5 text-slate-400">
          <dt className="inline">Unknown </dt>
          <dd className="inline font-mono text-slate-200">
            {model.summary.unknownPassCount}
          </dd>
        </div>
      </dl>
    </section>
  );
}
