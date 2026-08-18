import type { OptimisationPassViewProps } from "../_lib/optimisation-types";
import {
  describePassScope,
  formatMetricDelta,
  formatMetricValue,
  getPassMetric,
  PASS_METRIC_DEFINITIONS,
} from "../_lib/pass-detail-display";
import { IrDiffViewer } from "./ir-diff-viewer";

const NOT_AVAILABLE = "Not available";

export function PassDetail({ pass }: OptimisationPassViewProps) {
  const scope = describePassScope(pass);
  const localPosition =
    pass.position.withinFunction.status === "available"
      ? String(pass.position.withinFunction.data + 1)
      : NOT_AVAILABLE;
  const overviewItems = [
    { label: "Name", value: pass.name, mono: true },
    {
      label: "Full name",
      value:
        pass.fullName.status === "available"
          ? pass.fullName.data
          : NOT_AVAILABLE,
      mono: true,
    },
    {
      label: "Global order",
      value: String(pass.position.global + 1),
      mono: false,
    },
    { label: "Function order", value: localPosition, mono: false },
    { label: "Type", value: pass.type, mono: false },
    { label: "Scope", value: scope, mono: false },
  ] as const;

  return (
    <article className="min-w-0" aria-labelledby="pass-detail-heading">
      <header className="mb-5 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
          <span className="rounded-full border border-slate-700 px-2.5 py-1">
            {pass.type}
          </span>
          <span
            className="max-w-full min-w-0 truncate rounded-full border border-slate-700 px-2.5 py-1"
            title={scope}
          >
            {scope}
          </span>
          <span className="rounded-full border border-slate-700 px-2.5 py-1">
            Pass {pass.position.global + 1}
          </span>
          <span className="text-slate-600" aria-hidden="true">
            /
          </span>
          <span
            className={pass.changed ? "text-emerald-300" : "text-slate-400"}
          >
            {pass.changed ? "IR changed" : "IR unchanged"}
          </span>
        </div>
        <h2
          id="pass-detail-heading"
          className="mt-3 text-2xl font-semibold tracking-tight break-words text-slate-50 sm:text-3xl"
          title={pass.name}
        >
          {pass.name}
        </h2>
      </header>

      <section
        aria-labelledby="pass-overview-heading"
        className="mb-5 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
      >
        <h3
          id="pass-overview-heading"
          className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase"
        >
          Pass details
        </h3>
        <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {overviewItems.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs text-slate-500">{item.label}</dt>
              <dd
                className={`mt-1 text-sm break-words text-slate-200 ${item.mono ? "font-mono" : "capitalize"}`}
                title={item.value}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="pass-metrics-heading" className="mb-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3
              id="pass-metrics-heading"
              className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase"
            >
              Core metrics
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Before and after this Pass; delta is after minus before.
            </p>
          </div>
          {pass.metrics.status === "unavailable" ? (
            <span className="text-xs font-medium text-amber-300">
              {NOT_AVAILABLE}
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="bg-slate-950/70 text-xs text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Metric
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Before
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  After
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Delta
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Quality
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {PASS_METRIC_DEFINITIONS.map(({ key, label }) => {
                const metric = getPassMetric(pass, key);

                return (
                  <tr key={key} className="bg-slate-900/30">
                    <th
                      scope="row"
                      className="px-4 py-3 font-medium text-slate-300"
                    >
                      {label}
                    </th>
                    {metric.status === "available" ? (
                      <>
                        <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">
                          {formatMetricValue(metric.data.before)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-200 tabular-nums">
                          {formatMetricValue(metric.data.after)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-mono tabular-nums ${
                            metric.data.delta < 0
                              ? "text-emerald-300"
                              : metric.data.delta > 0
                                ? "text-amber-300"
                                : "text-slate-400"
                          }`}
                        >
                          {formatMetricDelta(metric.data.delta)}
                        </td>
                        <td className="px-4 py-3">
                          {metric.data.estimated ? (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-200">
                              Estimated
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              Measured
                            </span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-sm text-amber-300"
                      >
                        {NOT_AVAILABLE}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <section
          aria-labelledby="transformation-heading"
          className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
        >
          <h3
            id="transformation-heading"
            className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase"
          >
            Transformation
          </h3>
          {pass.transformation.status === "available" ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-cyan-300">
                {pass.transformation.data.category}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {pass.transformation.data.summary}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-amber-300">{NOT_AVAILABLE}</p>
          )}
        </section>

        <section
          aria-labelledby="dependencies-heading"
          className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
        >
          <h3
            id="dependencies-heading"
            className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase"
          >
            Dependencies and relations
          </h3>
          {pass.dependencies.status === "available" ? (
            pass.dependencies.data.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {pass.dependencies.data.map((dependency, index) => (
                  <li
                    key={`${dependency.passId}:${dependency.relation}:${index}`}
                    className="flex min-w-0 flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300 capitalize">
                      {dependency.relation}
                    </span>
                    <code className="break-all text-slate-400">
                      {dependency.passId}
                    </code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                No dependencies reported.
              </p>
            )
          ) : (
            <p className="mt-3 text-sm text-amber-300">{NOT_AVAILABLE}</p>
          )}
        </section>
      </div>

      <IrDiffViewer before={pass.ir.before} after={pass.ir.after} />
    </article>
  );
}
