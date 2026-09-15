import { memo } from "react";

import {
  cfgContent,
  passChangeSummaryContent,
  passDescriptionContent,
  passDetailContent,
} from "../content";
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
import { summarisePassChange } from "../_lib/pass-change-summary";
import { describePassBehaviour } from "../_lib/pass-descriptions";
import { DeferredCfgView } from "./deferred-cfg-view";
import { IrDiffViewer } from "./ir-diff-viewer";
import { IrSnapshotView } from "./ir-snapshot-view";

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
  const description = describePassBehaviour(pass);
  const changeSummary = summarisePassChange(pass);
  const analysisActivity = pass.analysisActivity;
  const computedAnalyses =
    analysisActivity?.status === "available"
      ? analysisActivity.data.computed
      : [];

  const changeSummarySection = (
    <section
      aria-labelledby="pass-change-summary-heading"
      className="mb-5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3"
    >
      <h3
        id="pass-change-summary-heading"
        className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase"
      >
        {passChangeSummaryContent.heading}
      </h3>
      {changeSummary.status === "available" ? (
        <p className="mt-1.5 text-sm leading-6 text-slate-100">
          {changeSummary.data}
        </p>
      ) : (
        <p className="mt-1.5 text-sm leading-6 text-amber-200">
          {changeSummary.reason === "not-provided"
            ? passChangeSummaryContent.unavailable.notProvided
            : passChangeSummaryContent.unavailable.estimated}
        </p>
      )}
    </section>
  );

  const metricsSection = (
    <section aria-labelledby="pass-metrics-heading" className="mb-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3
            id="pass-metrics-heading"
            className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase"
          >
            {passDetailContent.metrics.heading}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {passDetailContent.metrics.description}
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
                {passDetailContent.metrics.columns.metric}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {passDetailContent.metrics.columns.before}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {passDetailContent.metrics.columns.after}
              </th>
              <th
                scope="col"
                className={`px-4 py-3 text-right font-medium ${
                  pass.changed ? "" : "text-slate-700"
                }`}
              >
                {passDetailContent.metrics.columns.change}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {passDetailContent.metrics.columns.measurement}
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
                    <span
                      className="cursor-help underline decoration-slate-700 decoration-dotted underline-offset-4"
                      title={passDetailContent.metrics.glossary[key]}
                    >
                      {label}
                    </span>
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
                          !pass.changed
                            ? "text-slate-600 opacity-60"
                            : metric.data.delta < 0
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
                            {passDetailContent.metrics.estimated}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {passDetailContent.metrics.measured}
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
      {pass.changed ? null : (
        <p className="mt-2 text-xs text-slate-500">
          {passDetailContent.metrics.unchangedDeltaNote}
        </p>
      )}
    </section>
  );

  const analysisSection = (
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
  );

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
            title={
              pass.changed ? undefined : passDetailContent.changeBadge.tooltip
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                pass.changed ? "bg-emerald-300" : "bg-slate-500"
              }`}
              aria-hidden="true"
            />
            {pass.changed
              ? passDetailContent.changeBadge.changed
              : passDetailContent.changeBadge.unchanged}
          </span>
        </div>
        <h2
          id="pass-detail-heading"
          className="mt-4 text-2xl font-semibold tracking-tight break-words text-slate-50 sm:text-3xl"
          title={pass.name}
        >
          {pass.name}
        </h2>
        {description.status === "available" ? (
          <div className="mt-3">
            <p className="max-w-prose text-base leading-7 text-slate-200">
              {description.data.text}
            </p>
            {description.data.source === "generated" ? (
              <p className="mt-2">
                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs text-slate-400">
                  {passDescriptionContent.fallbackLabel}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
        <dl className="mt-4 flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-2 text-xs">
          {description.status === "available" &&
          description.data.category.status === "available" ? (
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium tracking-wide text-slate-500 uppercase">
                {passDescriptionContent.categoryLabel}
              </dt>
              <dd className="font-mono text-slate-300">
                {description.data.category.data}
              </dd>
            </div>
          ) : null}
          <div className="flex min-w-0 items-baseline gap-1.5">
            <dt className="shrink-0 font-medium tracking-wide text-slate-500 uppercase">
              {passDetailContent.metadata.llvmName}
            </dt>
            <dd
              className="min-w-0 truncate font-mono text-slate-300"
              title={fullName}
            >
              {fullName}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="font-medium tracking-wide text-slate-500 uppercase">
              {passDetailContent.metadata.globalOrder}
            </dt>
            <dd className="font-mono text-slate-300 tabular-nums">
              {pass.position.global + 1}
            </dd>
          </div>
          {pass.position.withinFunction.status === "available" ? (
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium tracking-wide text-slate-500 uppercase">
                {passDetailContent.metadata.functionOrder}
              </dt>
              <dd className="font-mono text-slate-300 tabular-nums">
                {localPosition}
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      {pass.changed ? (
        <>
          {changeSummarySection}
          {metricsSection}
          {analysisSection}
        </>
      ) : (
        <>
          {analysisSection}
          {metricsSection}
        </>
      )}

      {pass.changed ? (
        <IrDiffViewer
          before={pass.ir.before}
          after={pass.ir.after}
          structuredDiff={
            pass.ir.diff.status === "available" ? pass.ir.diff.data : undefined
          }
          mode={diffMode}
          onModeChange={onDiffModeChange}
        />
      ) : (
        <IrSnapshotView ir={pass.ir.after} headingId="ir-snapshot-heading" />
      )}

      {pass.changed ? (
        <DeferredCfgView key={pass.id} cfg={pass.cfg} />
      ) : (
        <section className="mt-6" aria-labelledby="cfg-unchanged-heading">
          <h3
            id="cfg-unchanged-heading"
            className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
          >
            {cfgContent.heading}
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            {cfgContent.unchanged.description}
          </p>
          <details className="mt-3 rounded-xl border border-slate-800">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-300 transition hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none">
              {cfgContent.unchanged.toggle}
            </summary>
            <div className="px-3 pb-3">
              <DeferredCfgView
                key={pass.id}
                cfg={pass.cfg}
                initialMode="after"
              />
            </div>
          </details>
        </section>
      )}
    </article>
  );
});
