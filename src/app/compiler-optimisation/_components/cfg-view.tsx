"use client";

import { memo, useMemo, useState } from "react";

import { cfgContent } from "../content";
import {
  CFG_NODE_DIMENSIONS,
  createCfgDisplayModel,
  type CfgChange,
  type CfgDiagram,
} from "../_lib/cfg-display";
import type {
  ControlFlowGraphSnapshotViewModel,
  DataAvailability,
  PassControlFlowGraphViewModel,
} from "../_lib/optimisation-types";

type CfgViewProps = Readonly<{
  cfg: DataAvailability<PassControlFlowGraphViewModel>;
}>;

const SCALE_STEPS = [0.75, 1, 1.25, 1.5] as const;

const changeStyles: Readonly<
  Record<CfgChange, Readonly<{ node: string; edge: string; text: string }>>
> = {
  unchanged: {
    node: "fill-slate-900 stroke-slate-600",
    edge: "stroke-slate-500",
    text: "text-slate-400",
  },
  added: {
    node: "fill-emerald-950 stroke-emerald-400",
    edge: "stroke-emerald-400",
    text: "text-emerald-300",
  },
  removed: {
    node: "fill-rose-950 stroke-rose-400",
    edge: "stroke-rose-400",
    text: "text-rose-300",
  },
  changed: {
    node: "fill-amber-950 stroke-amber-400",
    edge: "stroke-amber-400",
    text: "text-amber-300",
  },
};

function shortenedLabel(label: string): string {
  const firstLine = label.split(/\r?\n/, 1)[0] ?? label;
  return firstLine.length > 28 ? `${firstLine.slice(0, 27)}…` : firstLine;
}

function edgePath(edge: CfgDiagram["edges"][number]): string {
  if (edge.source === edge.target) {
    return `M ${edge.sourceX} ${edge.sourceY} C ${edge.sourceX + 90} ${edge.sourceY + 40}, ${edge.targetX + 90} ${edge.targetY - 40}, ${edge.targetX} ${edge.targetY}`;
  }

  const middleY = (edge.sourceY + edge.targetY) / 2;
  return `M ${edge.sourceX} ${edge.sourceY} C ${edge.sourceX} ${middleY}, ${edge.targetX} ${middleY}, ${edge.targetX} ${edge.targetY}`;
}

type GraphListProps = Readonly<{
  snapshot: ControlFlowGraphSnapshotViewModel;
  label: string;
}>;

function GraphList({ snapshot, label }: GraphListProps) {
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <h5 className="font-semibold text-slate-300">
          Nodes ({snapshot.nodes.length})
        </h5>
        {snapshot.nodes.length === 0 ? (
          <p className="mt-2 text-slate-500">{cfgContent.empty}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {snapshot.nodes.map((node, index) => (
              <li
                key={`${node.id}:${index}`}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-2"
              >
                <code className="text-xs break-all text-cyan-300">
                  {node.id}
                </code>
                <pre className="mt-1 overflow-x-auto text-xs whitespace-pre-wrap text-slate-400">
                  {node.label}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h5 className="font-semibold text-slate-300">
          Directed edges ({snapshot.edges.length})
        </h5>
        {snapshot.edges.length === 0 ? (
          <p className="mt-2 text-slate-500">No directed edges reported.</p>
        ) : (
          <ul className="mt-2 space-y-2 font-mono text-xs text-slate-400">
            {snapshot.edges.map((edge, index) => (
              <li
                key={`${edge.source}:${edge.target}:${index}`}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 break-all"
              >
                <span className="text-slate-200">{edge.source}</span>
                <span aria-label="flows to"> → </span>
                <span className="text-slate-200">{edge.target}</span>
                {edge.label.status === "available" ? (
                  <span className="text-slate-500"> · {edge.label.data}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="sr-only">{label} CFG list</span>
    </div>
  );
}

type CfgPaneProps = Readonly<{
  side: "before" | "after";
  snapshot: ControlFlowGraphSnapshotViewModel;
  comparison: ControlFlowGraphSnapshotViewModel;
}>;

const CfgPane = memo(function CfgPane({
  side,
  snapshot,
  comparison,
}: CfgPaneProps) {
  const [scaleIndex, setScaleIndex] = useState(1);
  const model = useMemo(
    () => createCfgDisplayModel(snapshot, comparison, side),
    [comparison, side, snapshot],
  );
  const label = side === "before" ? "Before" : "After";
  const scale = SCALE_STEPS[scaleIndex] ?? 1;

  if (model.status === "fallback") {
    return (
      <section
        className="min-w-0 rounded-xl border border-amber-400/30 bg-amber-950/10 p-4"
        aria-label={`${label} CFG fallback`}
      >
        <p className="text-xs font-semibold tracking-[0.14em] text-amber-300 uppercase">
          {label} · {cfgContent.fallback.title}
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-100/70">
          {model.reason === "duplicate-node-id"
            ? cfgContent.fallback.duplicateNode
            : cfgContent.fallback.danglingEdge}
        </p>
        <div className="mt-4">
          <GraphList snapshot={snapshot} label={label} />
        </div>
      </section>
    );
  }

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
      aria-label={`${label} control flow graph`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <div>
          <h4 className="font-mono text-xs font-semibold tracking-[0.14em] text-slate-200 uppercase">
            {label}
          </h4>
          <p className="mt-1 text-[0.68rem] text-slate-500">
            {snapshot.nodes.length}{" "}
            {snapshot.nodes.length === 1 ? "node" : "nodes"} ·{" "}
            {snapshot.edges.length}{" "}
            {snapshot.edges.length === 1 ? "edge" : "edges"}
          </p>
        </div>
        <div
          className="flex items-center gap-1"
          aria-label={`${label} CFG zoom`}
        >
          <button
            type="button"
            onClick={() => setScaleIndex((index) => Math.max(0, index - 1))}
            disabled={scaleIndex === 0}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:opacity-35"
            aria-label={`${cfgContent.controls.zoomOut} ${label} CFG`}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setScaleIndex(1)}
            className="min-w-12 rounded-md border border-slate-700 px-2 py-1 font-mono text-[0.68rem] text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
            aria-label={`${cfgContent.controls.reset} ${label} CFG`}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={() =>
              setScaleIndex((index) =>
                Math.min(SCALE_STEPS.length - 1, index + 1),
              )
            }
            disabled={scaleIndex === SCALE_STEPS.length - 1}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:opacity-35"
            aria-label={`${cfgContent.controls.zoomIn} ${label} CFG`}
          >
            +
          </button>
        </div>
      </header>

      {model.nodes.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">{cfgContent.empty}</p>
      ) : (
        <div
          className="max-h-[34rem] min-h-72 overflow-auto overscroll-contain focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset"
          tabIndex={0}
          role="region"
          aria-label={`${label} CFG canvas; use scrolling to pan`}
        >
          <svg
            width={model.width * scale}
            height={model.height * scale}
            viewBox={`0 0 ${model.width} ${model.height}`}
            role="img"
            aria-label={`${label} directed control flow graph with ${model.nodes.length} nodes and ${model.edges.length} edges`}
          >
            <defs>
              <marker
                id={`cfg-arrow-${side}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-400" />
              </marker>
            </defs>

            {model.edges.map((edge) => (
              <g key={edge.id}>
                <path
                  d={edgePath(edge)}
                  fill="none"
                  strokeWidth="2"
                  markerEnd={`url(#cfg-arrow-${side})`}
                  className={changeStyles[edge.change].edge}
                >
                  <title>{`${edge.source} to ${edge.target}${
                    edge.label.status === "available"
                      ? `: ${edge.label.data}`
                      : ""
                  }`}</title>
                </path>
                {edge.label.status === "available" ? (
                  <text
                    x={(edge.sourceX + edge.targetX) / 2}
                    y={(edge.sourceY + edge.targetY) / 2 - 6}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px]"
                  >
                    {shortenedLabel(edge.label.data)}
                  </text>
                ) : null}
              </g>
            ))}

            {model.nodes.map((node) => (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={CFG_NODE_DIMENSIONS.width}
                  height={CFG_NODE_DIMENSIONS.height}
                  rx="10"
                  strokeWidth="2"
                  className={changeStyles[node.change].node}
                >
                  <title>{node.label}</title>
                </rect>
                <text
                  x={node.x + 14}
                  y={node.y + 25}
                  className="fill-slate-100 font-mono text-[12px] font-semibold"
                >
                  {shortenedLabel(node.label)}
                </text>
                <text
                  x={node.x + 14}
                  y={node.y + 49}
                  className="fill-slate-500 font-mono text-[10px]"
                >
                  {node.role} · {node.change}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      <details className="border-t border-slate-800 px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none">
          Accessible node and edge list
        </summary>
        <div className="mt-4">
          <GraphList snapshot={snapshot} label={label} />
        </div>
      </details>
    </section>
  );
});

export function CfgView({ cfg }: CfgViewProps) {
  return (
    <section className="mt-6" aria-labelledby="cfg-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3
            id="cfg-heading"
            className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
          >
            {cfgContent.heading}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {cfgContent.description}
          </p>
        </div>
        {cfg.status === "available" ? (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-slate-500">
            {(Object.keys(cfgContent.legend) as Array<CfgChange>).map(
              (change) => (
                <li key={change} className={changeStyles[change].text}>
                  <span aria-hidden="true">●</span> {cfgContent.legend[change]}
                </li>
              ),
            )}
          </ul>
        ) : null}
      </div>

      {cfg.status === "unavailable" ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-5 text-sm text-amber-300">
          {cfgContent.unavailable}
        </div>
      ) : (
        <div className="grid min-w-0 gap-4 2xl:grid-cols-2">
          <CfgPane
            side="before"
            snapshot={cfg.data.before}
            comparison={cfg.data.after}
          />
          <CfgPane
            side="after"
            snapshot={cfg.data.after}
            comparison={cfg.data.before}
          />
        </div>
      )}
    </section>
  );
}
