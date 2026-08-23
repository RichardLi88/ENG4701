"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { reductionWorkspaceContent, units } from "../content";
import type { ReductionStepView } from "../_lib/reduction-trace-adapter";

type CumulativeReductionChartProps = Readonly<{
  originalTokens: number | null;
  steps: ReadonlyArray<ReductionStepView>;
}>;

type CandidatePoint = Readonly<{
  order: number;
  candidateId: string;
  tokensBefore: number;
  tokensAfter: number;
  cumulativeReduction: number;
}>;

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 300;
const PLOT_LEFT = 72;
const PLOT_RIGHT = 24;
const PLOT_TOP = 24;
const PLOT_BOTTOM = 52;
const PLOT_WIDTH = VIEWBOX_WIDTH - PLOT_LEFT - PLOT_RIGHT;
const PLOT_HEIGHT = VIEWBOX_HEIGHT - PLOT_TOP - PLOT_BOTTOM;

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatReduction(value: number) {
  if (value < 0) {
    return `−${Math.abs(value).toLocaleString()} ${units.tokens}`;
  }
  return `${value.toLocaleString()} ${units.tokens}`;
}

function EmptyChart({
  heading,
  description,
}: Readonly<{ heading: string; description: string }>) {
  return (
    <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6">
      <h2 className="font-semibold">{heading}</h2>
      <p className="mt-2 text-sm text-[var(--app-text-muted)]">{description}</p>
    </section>
  );
}

function xTickOrders(candidateCount: number) {
  const tickCount = Math.min(6, candidateCount);
  const orders = new Set<number>();

  for (let index = 0; index < tickCount; index += 1) {
    const progress = tickCount === 1 ? 0 : index / (tickCount - 1);
    orders.add(Math.round(1 + progress * (candidateCount - 1)));
  }

  return [...orders];
}

function isCandidateStep(
  step: ReductionStepView,
): step is ReductionStepView & Readonly<{ candidateId: string }> {
  return step.candidateId !== null;
}

export function CumulativeReductionChart({
  originalTokens,
  steps,
}: CumulativeReductionChartProps) {
  const content = reductionWorkspaceContent.cumulativeReductionChart;
  const sectionRef = useRef<HTMLElement>(null);
  const [inspectedIndex, setInspectedIndex] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const candidateSteps = useMemo(() => steps.filter(isCandidateStep), [steps]);
  const points = useMemo<ReadonlyArray<CandidatePoint>>(
    () =>
      originalTokens === null
        ? []
        : candidateSteps.map((step, index) => ({
            order: index + 1,
            candidateId: step.candidateId,
            tokensBefore: step.tokensBefore,
            tokensAfter: step.tokensAfter,
            cumulativeReduction: originalTokens - step.tokensAfter,
          })),
    [candidateSteps, originalTokens],
  );

  useEffect(() => {
    if (!isPinned) return;

    function clearPinnedInspection(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !sectionRef.current?.contains(target)) {
        setIsPinned(false);
        setInspectedIndex(null);
      }
    }

    document.addEventListener("pointerdown", clearPinnedInspection);
    return () =>
      document.removeEventListener("pointerdown", clearPinnedInspection);
  }, [isPinned]);

  if (candidateSteps.length === 0) {
    return (
      <EmptyChart
        heading={content.empty.heading}
        description={content.empty.description}
      />
    );
  }

  if (originalTokens === null) {
    return (
      <EmptyChart
        heading={content.unavailable.heading}
        description={content.unavailable.description}
      />
    );
  }

  const { rawMinimum, rawMaximum } = points.reduce(
    (range, point) => ({
      rawMinimum: Math.min(range.rawMinimum, point.cumulativeReduction),
      rawMaximum: Math.max(range.rawMaximum, point.cumulativeReduction),
    }),
    { rawMinimum: 0, rawMaximum: 0 },
  );
  const rawRange = rawMaximum - rawMinimum;
  const padding = rawRange === 0 ? 1 : rawRange * 0.08;
  const minimum = rawMinimum < 0 ? rawMinimum - padding : 0;
  const maximum = rawMaximum > 0 ? rawMaximum + padding : 0;
  const chartMinimum = minimum === maximum ? -1 : minimum;
  const chartMaximum = minimum === maximum ? 1 : maximum;
  const chartRange = chartMaximum - chartMinimum;
  const xForOrder = (order: number) =>
    PLOT_LEFT + (order / points.length) * PLOT_WIDTH;
  const yForReduction = (reduction: number) =>
    PLOT_TOP + ((chartMaximum - reduction) / chartRange) * PLOT_HEIGHT;
  const baselineX = xForOrder(0);
  const baselineY = yForReduction(0);
  const path = [
    `M ${baselineX} ${baselineY}`,
    ...points.map(
      (point) =>
        `L ${xForOrder(point.order)} ${yForReduction(point.cumulativeReduction)}`,
    ),
  ].join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = chartMaximum - (index / 4) * chartRange;
    return { value, y: yForReduction(value) };
  });
  const inspectedPoint =
    inspectedIndex === null ? undefined : points[inspectedIndex];
  const latestPoint = points.at(-1)!;
  const summary = `${content.acceptedCandidates}: ${points.length.toLocaleString()}. ${content.startingTokens}: ${originalTokens.toLocaleString()}. ${content.latestPlottedTokens}: ${latestPoint.tokensAfter.toLocaleString()}. ${content.cumulativeReduction}: ${formatReduction(latestPoint.cumulativeReduction)}.`;

  function inspectPointer(clientX: number, bounds: DOMRect) {
    if (bounds.width === 0) return;
    const viewboxX = ((clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH;
    const progress = (viewboxX - PLOT_LEFT) / PLOT_WIDTH;
    const order = Math.min(
      points.length,
      Math.max(1, Math.round(progress * points.length)),
    );
    setInspectedIndex(order - 1);
  }

  function moveInspection(offset: number) {
    setInspectedIndex((current) => {
      const next = (current ?? 0) + offset;
      return Math.min(points.length - 1, Math.max(0, next));
    });
  }

  return (
    <section
      ref={sectionRef}
      className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 sm:p-6"
      aria-labelledby="cumulative-reduction-heading"
    >
      <div>
        <h2 id="cumulative-reduction-heading" className="font-semibold">
          {content.heading}
        </h2>
        <p className="mt-1 text-sm text-[var(--app-text-muted)]">
          {content.description}
        </p>
        <p className="mt-3 text-xs text-[var(--app-text-secondary)]">
          {summary}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="mt-4 min-h-56 w-full"
        role="img"
        tabIndex={0}
        aria-label={`${content.heading}. ${summary} ${content.keyboardHelp}`}
        data-point-count={points.length}
        onFocus={() => {
          setIsFocused(true);
          setInspectedIndex((current) => current ?? 0);
        }}
        onBlur={() => {
          setIsFocused(false);
          if (!isPinned) setInspectedIndex(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            moveInspection(-1);
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            moveInspection(1);
          } else if (event.key === "Home") {
            event.preventDefault();
            setInspectedIndex(0);
          } else if (event.key === "End") {
            event.preventDefault();
            setInspectedIndex(points.length - 1);
          } else if (event.key === "Escape") {
            setIsPinned(false);
            setInspectedIndex(null);
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== "touch") {
            inspectPointer(
              event.clientX,
              event.currentTarget.getBoundingClientRect(),
            );
          }
        }}
        onPointerDown={(event) => {
          inspectPointer(
            event.clientX,
            event.currentTarget.getBoundingClientRect(),
          );
          setIsPinned(true);
        }}
        onPointerLeave={() => {
          if (!isFocused && !isPinned) setInspectedIndex(null);
        }}
      >
        <title>{content.description}</title>
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={PLOT_LEFT}
              x2={VIEWBOX_WIDTH - PLOT_RIGHT}
              y1={tick.y}
              y2={tick.y}
              stroke="var(--app-border-subtle)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PLOT_LEFT - 10}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-[var(--app-text-muted)] text-[11px]"
            >
              {formatNumber(tick.value)}
            </text>
          </g>
        ))}
        <line
          x1={PLOT_LEFT}
          x2={VIEWBOX_WIDTH - PLOT_RIGHT}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--app-text-secondary)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {xTickOrders(points.length).map((order) => (
          <g key={order}>
            <line
              x1={xForOrder(order)}
              x2={xForOrder(order)}
              y1={PLOT_TOP}
              y2={VIEWBOX_HEIGHT - PLOT_BOTTOM}
              stroke="var(--app-border-subtle)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={xForOrder(order)}
              y={VIEWBOX_HEIGHT - PLOT_BOTTOM + 20}
              textAnchor="middle"
              className="fill-[var(--app-text-muted)] text-[11px]"
            >
              {order.toLocaleString()}
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          stroke="var(--app-accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {[points[0]!, latestPoint].map((point, index) =>
          index === 1 && points.length === 1 ? null : (
            <circle
              key={point.order}
              cx={xForOrder(point.order)}
              cy={yForReduction(point.cumulativeReduction)}
              r="4"
              fill="var(--app-accent)"
              stroke="var(--app-surface)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}
        {inspectedPoint !== undefined ? (
          <circle
            cx={xForOrder(inspectedPoint.order)}
            cy={yForReduction(inspectedPoint.cumulativeReduction)}
            r="7"
            fill="var(--app-surface)"
            stroke="var(--app-focus)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <text
          x={PLOT_LEFT + PLOT_WIDTH / 2}
          y={VIEWBOX_HEIGHT - 4}
          textAnchor="middle"
          className="fill-[var(--app-text-muted)] text-[11px] font-semibold"
        >
          {content.horizontalAxis}
        </text>
        <text
          x="12"
          y={PLOT_TOP - 8}
          className="fill-[var(--app-text-muted)] text-[11px] font-semibold"
        >
          {content.verticalAxis}
        </text>
      </svg>

      <p className="sr-only">{content.keyboardHelp}</p>
      {inspectedPoint !== undefined ? (
        <dl
          className="mt-3 grid gap-3 rounded-lg border border-[var(--app-border-subtle)] bg-[var(--app-panel)] p-4 text-xs sm:grid-cols-2 lg:grid-cols-5"
          aria-live="polite"
        >
          {[
            [content.point.acceptedCandidate, inspectedPoint.order],
            [content.point.candidateId, inspectedPoint.candidateId],
            [content.point.tokensBefore, inspectedPoint.tokensBefore],
            [content.point.tokensAfter, inspectedPoint.tokensAfter],
            [
              content.point.cumulativeReduction,
              formatReduction(inspectedPoint.cumulativeReduction),
            ],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="font-semibold text-[var(--app-text-muted)]">
                {label}
              </dt>
              <dd className="mt-1 truncate font-mono text-[var(--app-text-primary)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
