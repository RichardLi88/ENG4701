import { memo } from "react";

import { passDetailContent } from "../content";
import type {
  OptimisationPassViewModel,
  OptimisationPassViewProps,
} from "../_lib/optimisation-types";
import type { DiffMode } from "../_lib/workspace-state";
import {
  describePassScope,
  formatMetricDelta,
  formatMetricValue,
  getPassMetric,
  PASS_METRIC_DEFINITIONS,
} from "../_lib/pass-detail-display";
import { DeferredCfgView } from "./deferred-cfg-view";
import { IrDiffViewer } from "./ir-diff-viewer";

const NOT_AVAILABLE = "Not available";
const ignoreDiffModeChange = () => undefined;

type PassDetailProps = OptimisationPassViewProps &
  Readonly<{
    previousPass?: OptimisationPassViewModel;
    nextPass?: OptimisationPassViewModel;
    diffMode?: DiffMode;
    onDiffModeChange?: (diffMode: DiffMode) => void;
  }>;

export const PassDetail = memo(function PassDetail({
  pass,
  previousPass,
  nextPass,
  diffMode = "side-by-side",
  onDiffModeChange = ignoreDiffModeChange,
}: PassDetailProps) {
  const scope = describePassScope(pass);
  const localPosition =
    pass.position.withinFunction.status === "available"
      ? String(pass.position.withinFunction.data + 1)
      : NOT_AVAILABLE;
  const fullName =
    pass.fullName.status === "available" ? pass.fullName.data : NOT_AVAILABLE;
  const analysisActivity = pass.analysisActivity;
  const computedAnalyses =
    analysisActivity?.status === "available"
      ? analysisActivity.data.computed
      : [];

  return (
    <article className="min-w-0" aria-labelledby="pass-detail-heading">
      <header className="mb-5 min-w-0 border-b border-slate-800/80 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs font-medium">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono tracking-[0.12em] text-cyan-300 uppercase">
              {pass.type}
            </span>
            <span className="text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="min-w-0 truncate text-slate-400" title={scope}>
              {scope}
            </span>
          </div>
          <span
            className={`flex shrink-0 items-center gap-2 font-semibold tracking-wide uppercase ${
              pass.changed ? "text-emerald-300" : "text-slate-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                pass.changed ? "bg-emerald-300" : "bg-slate-500"
              }`}
              aria-hidden="true"
            />
            {pass.changed ? "IR changed" : "IR unchanged"}
          </span>
        </div>
        <h2
          id="pass-detail-heading"
          className="mt-4 text-2xl font-semibold tracking-tight break-words text-slate-50 sm:text-3xl"
          title={pass.name}
        >
          {pass.name}
        </h2>
        <div className="mt-2 flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <code
            className="min-w-0 truncate text-xs text-slate-400"
            title={fullName}
            aria-label={`${passDetailContent.metadata.fullName}: ${fullName}`}
          >
            {fullName}
          </code>
          <dl className="flex shrink-0 items-center gap-2 text-xs">
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium tracking-wide text-slate-500 uppercase">
                {passDetailContent.metadata.globalOrder}
              </dt>
              <dd className="font-mono text-slate-200 tabular-nums">
                {pass.position.global + 1}
              </dd>
            </div>
            {pass.position.withinFunction.status === "available" ? (
              <div className="flex items-baseline gap-2">
                <dt className="flex items-baseline gap-2 font-medium tracking-wide text-slate-500 uppercase">
                  <span className="font-mono text-cyan-700" aria-hidden="true">
                    →
                  </span>
                  {passDetailContent.metadata.functionOrder}
                </dt>
                <dd className="font-mono text-slate-200 tabular-nums">
                  {localPosition}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

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

      <section
        aria-labelledby="analysis-context-heading"
        className="mb-5 rounded-xl border border-slate-800 bg-slate-950/50 p-5"
      >
        <h3
          id="analysis-context-heading"
          className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase"
        >
          {passDetailContent.analysisContext.heading}
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              {passDetailContent.analysisContext.preservation}
            </p>
            {analysisActivity?.status === "available" ? (
              <span
                className={`mt-1.5 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                  analysisActivity.data.preservation === "all"
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                    : "border-amber-400/25 bg-amber-400/10 text-amber-200"
                }`}
              >
                {analysisActivity.data.preservation === "all"
                  ? passDetailContent.analysisContext.allPreserved
                  : passDetailContent.analysisContext.notAllPreserved}
              </span>
            ) : (
              <p className="mt-1.5 text-sm text-slate-400">
                {passDetailContent.analysisContext.unavailable}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              {passDetailContent.analysisContext.computed}
            </p>
            {computedAnalyses.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {computedAnalyses.slice(0, 4).map((analysis) => (
                  <code
                    key={analysis}
                    className="max-w-full truncate rounded-md bg-slate-800/80 px-2 py-1 text-xs text-slate-300"
                    title={analysis}
                  >
                    {analysis}
                  </code>
                ))}
                {computedAnalyses.length > 4 ? (
                  <span className="px-1 py-1 text-xs text-slate-500">
                    +{computedAnalyses.length - 4}{" "}
                    {passDetailContent.analysisContext.more}
                  </span>
                ) : null}
              </div>
            ) : analysisActivity?.status === "available" ? (
              <p className="mt-1.5 text-sm text-slate-400">
                {passDetailContent.analysisContext.noneComputed}
              </p>
            ) : null}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-4">
          {[
            {
              label: passDetailContent.analysisContext.previous,
              pass: previousPass,
              fallback: passDetailContent.analysisContext.pipelineStart,
            },
            {
              label: passDetailContent.analysisContext.next,
              pass: nextPass,
              fallback: passDetailContent.analysisContext.pipelineEnd,
            },
          ].map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs text-slate-500">{item.label}</dt>
              <dd
                className="mt-1 truncate font-mono text-sm text-slate-300"
                title={item.pass?.name}
              >
                {item.pass?.name ?? item.fallback}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <IrDiffViewer
        before={pass.ir.before}
        after={pass.ir.after}
        structuredDiff={
          pass.ir.diff.status === "available" ? pass.ir.diff.data : undefined
        }
        mode={diffMode}
        onModeChange={onDiffModeChange}
      />
      <DeferredCfgView key={pass.id} cfg={pass.cfg} />
    </article>
  );
});
