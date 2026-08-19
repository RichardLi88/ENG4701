"use client";

import {
  useCallback,
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { cfgContent } from "../content";
import {
  CFG_NODE_DIMENSIONS,
  type CfgChange,
  type CfgDisplayModel,
} from "../_lib/cfg-display";
import type { ControlFlowGraphSnapshotViewModel } from "../_lib/optimisation-types";

export type CfgViewport = Readonly<{ x: number; y: number }>;

export type CfgGraphPaneHandle = Readonly<{
  focusNode: (nodeId: string) => void;
  setViewport: (viewport: CfgViewport) => void;
}>;

type CfgGraphPaneProps = Readonly<{
  side: "before" | "after";
  snapshot: ControlFlowGraphSnapshotViewModel;
  model: CfgDisplayModel;
  scale: number;
  selectedNodeId: string | null;
  fitRequest: number;
  fullscreen: boolean;
  onScaleChange: (scale: number) => void;
  onSelectNode: (nodeId: string) => void;
  onViewportChange: (viewport: CfgViewport) => void;
}>;

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

function edgeDash(change: CfgChange): string | undefined {
  if (change === "removed") return "8 6";
  if (change === "added") return "3 4";
  return undefined;
}

type GraphListProps = Readonly<{
  snapshot: ControlFlowGraphSnapshotViewModel;
  label: string;
  onSelectNode: (nodeId: string) => void;
}>;

function GraphList({ snapshot, label, onSelectNode }: GraphListProps) {
  return (
    <div className="grid gap-5 text-sm lg:grid-cols-2">
      <div>
        <h5 className="font-semibold text-slate-300">
          {cfgContent.graphData.nodes} ({snapshot.nodes.length})
        </h5>
        {snapshot.nodes.length === 0 ? (
          <p className="mt-2 text-slate-500">{cfgContent.empty}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {snapshot.nodes.map((node, index) => (
              <li key={`${node.id}:${index}`}>
                <button
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-left focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
                >
                  <code className="text-xs break-all text-cyan-300">
                    {node.id}
                  </code>
                  <pre className="mt-1 overflow-x-auto text-xs leading-5 whitespace-pre-wrap text-slate-400">
                    {node.label}
                  </pre>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h5 className="font-semibold text-slate-300">
          {cfgContent.graphData.edges} ({snapshot.edges.length})
        </h5>
        {snapshot.edges.length === 0 ? (
          <p className="mt-2 text-slate-500">{cfgContent.graphData.noEdges}</p>
        ) : (
          <ul className="mt-2 space-y-2 font-mono text-xs text-slate-400">
            {snapshot.edges.map((edge, index) => (
              <li
                key={`${edge.source}:${edge.target}:${index}`}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 break-all"
              >
                <span className="text-slate-200">{edge.source}</span>
                <span aria-label={cfgContent.pane.flowsTo}> → </span>
                <span className="text-slate-200">{edge.target}</span>
                {edge.label.status === "available" ? (
                  <span className="text-slate-500"> · {edge.label.data}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="sr-only">
        {label} {cfgContent.pane.graphList}
      </span>
    </div>
  );
}

export const CfgGraphPane = memo(
  forwardRef<CfgGraphPaneHandle, CfgGraphPaneProps>(function CfgGraphPane(
    {
      side,
      snapshot,
      model,
      scale,
      selectedNodeId,
      fitRequest,
      fullscreen,
      onScaleChange,
      onSelectNode,
      onViewportChange,
    },
    forwardedRef,
  ) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const programmaticScrollRef = useRef(false);
    const dragRef = useRef<
      | Readonly<{
          pointerId: number;
          x: number;
          y: number;
          scrollLeft: number;
          scrollTop: number;
        }>
      | undefined
    >(undefined);
    const label =
      side === "before" ? cfgContent.pane.before : cfgContent.pane.after;

    const setViewport = useCallback((nextViewport: CfgViewport) => {
      const element = viewportRef.current;
      if (element === null) return;
      programmaticScrollRef.current = true;
      element.scrollLeft =
        nextViewport.x * Math.max(0, element.scrollWidth - element.clientWidth);
      element.scrollTop =
        nextViewport.y *
        Math.max(0, element.scrollHeight - element.clientHeight);
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    }, []);

    const focusNode = useCallback(
      (nodeId: string) => {
        if (model.status !== "diagram") return;
        const node = model.nodes.find((candidate) => candidate.id === nodeId);
        const element = viewportRef.current;
        if (node === undefined || element === null) return;
        const left =
          (node.x + CFG_NODE_DIMENSIONS.width / 2) * scale -
          element.clientWidth / 2;
        const top =
          (node.y + CFG_NODE_DIMENSIONS.height / 2) * scale -
          element.clientHeight / 2;
        element.scrollTo({ left, top, behavior: "smooth" });
      },
      [model, scale],
    );

    useImperativeHandle(forwardedRef, () => ({ focusNode, setViewport }), [
      focusNode,
      setViewport,
    ]);

    const fitToView = useCallback(() => {
      if (model.status !== "diagram") return;
      const element = viewportRef.current;
      if (element === null || element.clientWidth === 0) return;
      const widthScale = (element.clientWidth - 32) / model.width;
      const heightScale = (element.clientHeight - 32) / model.height;
      onScaleChange(
        Math.min(1.25, Math.max(0.35, widthScale), Math.max(0.35, heightScale)),
      );
      setViewport({ x: 0.5, y: 0 });
    }, [model, onScaleChange, setViewport]);

    useEffect(() => {
      const frame = requestAnimationFrame(fitToView);
      return () => cancelAnimationFrame(frame);
    }, [fitRequest, fitToView]);

    const selectedConnections = useMemo(() => {
      if (model.status !== "diagram" || selectedNodeId === null) {
        return new Set<string>();
      }
      const connected = new Set<string>([selectedNodeId]);
      for (const edge of model.edges) {
        if (edge.source === selectedNodeId) connected.add(edge.target);
        if (edge.target === selectedNodeId) connected.add(edge.source);
      }
      return connected;
    }, [model, selectedNodeId]);

    if (model.status === "fallback") {
      return (
        <section
          className="min-w-0 rounded-xl border border-amber-400/30 bg-amber-950/10 p-5"
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
            <GraphList
              snapshot={snapshot}
              label={label}
              onSelectNode={onSelectNode}
            />
          </div>
        </section>
      );
    }

    return (
      <section
        className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
        aria-label={`${label} control flow graph`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
          <div>
            <h4 className="font-mono text-xs font-semibold tracking-[0.14em] text-slate-200 uppercase">
              {label}
            </h4>
            <p className="mt-1 text-[0.68rem] text-slate-500">
              {snapshot.nodes.length} {cfgContent.pane.nodeCount} ·{" "}
              {snapshot.edges.length} {cfgContent.pane.edgeCount}
            </p>
          </div>
          <p className="hidden text-[0.68rem] text-slate-500 md:block">
            {cfgContent.controls.keyboardHint}
          </p>
        </header>

        {model.nodes.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">{cfgContent.empty}</p>
        ) : (
          <div
            ref={viewportRef}
            className={`relative cursor-grab overflow-auto overscroll-contain bg-slate-950/40 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset active:cursor-grabbing ${
              fullscreen
                ? "h-full min-h-80 flex-1"
                : "h-[min(34rem,65vh)] min-h-80"
            }`}
            tabIndex={0}
            role="region"
            aria-label={`${label} CFG canvas; ${cfgContent.pane.canvasHelp}`}
            onScroll={(event) => {
              const element = event.currentTarget;
              const nextViewport = {
                x:
                  element.scrollWidth > element.clientWidth
                    ? element.scrollLeft /
                      (element.scrollWidth - element.clientWidth)
                    : 0,
                y:
                  element.scrollHeight > element.clientHeight
                    ? element.scrollTop /
                      (element.scrollHeight - element.clientHeight)
                    : 0,
              };
              if (!programmaticScrollRef.current) {
                onViewportChange(nextViewport);
              }
            }}
            onPointerDown={(event) => {
              if (
                event.button !== 0 ||
                (event.target instanceof Element &&
                  event.target.closest("[data-cfg-node]") !== null)
              ) {
                return;
              }
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                scrollLeft: event.currentTarget.scrollLeft,
                scrollTop: event.currentTarget.scrollTop,
              };
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (drag?.pointerId !== event.pointerId) return;
              event.currentTarget.scrollLeft =
                drag.scrollLeft - (event.clientX - drag.x);
              event.currentTarget.scrollTop =
                drag.scrollTop - (event.clientY - drag.y);
            }}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                event.currentTarget.releasePointerCapture(event.pointerId);
                dragRef.current = undefined;
              }
            }}
            onPointerCancel={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                dragRef.current = undefined;
              }
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              const distance = event.shiftKey ? 160 : 56;
              if (event.key === "ArrowLeft")
                event.currentTarget.scrollBy({ left: -distance });
              else if (event.key === "ArrowRight")
                event.currentTarget.scrollBy({ left: distance });
              else if (event.key === "ArrowUp")
                event.currentTarget.scrollBy({ top: -distance });
              else if (event.key === "ArrowDown")
                event.currentTarget.scrollBy({ top: distance });
              else if (event.key === "0") fitToView();
              else if (event.key === "+" || event.key === "=") {
                onScaleChange(scale + 0.15);
              } else if (event.key === "-") {
                onScaleChange(scale - 0.15);
              } else return;
              event.preventDefault();
            }}
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

              {model.edges.map((edge) => {
                const isConnected =
                  selectedNodeId === null ||
                  edge.source === selectedNodeId ||
                  edge.target === selectedNodeId;
                return (
                  <g key={edge.id} opacity={isConnected ? 1 : 0.18}>
                    <path
                      d={edge.path}
                      fill="none"
                      strokeWidth={edge.route === "back" ? 2.5 : 2}
                      strokeDasharray={edgeDash(edge.change)}
                      markerEnd={`url(#cfg-arrow-${side})`}
                      className={changeStyles[edge.change].edge}
                    >
                      <title>{`${edge.source} to ${edge.target}`}</title>
                    </path>
                    {edge.change === "added" || edge.change === "removed" ? (
                      <g transform={`translate(${edge.labelX} ${edge.labelY})`}>
                        <circle
                          r="9"
                          className={
                            edge.change === "added"
                              ? "fill-emerald-950 stroke-emerald-400"
                              : "fill-rose-950 stroke-rose-400"
                          }
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="fill-slate-100 text-[10px] font-semibold"
                        >
                          {edge.change === "added" ? "+" : "−"}
                        </text>
                      </g>
                    ) : edge.label.status === "available" ? (
                      <text
                        x={edge.labelX}
                        y={edge.labelY}
                        textAnchor="middle"
                        className="fill-slate-400 text-[10px]"
                      >
                        {shortenedLabel(edge.label.data)}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {model.nodes.map((node) => {
                const selected = node.id === selectedNodeId;
                const dimmed =
                  selectedNodeId !== null && !selectedConnections.has(node.id);
                return (
                  <g
                    key={node.id}
                    data-cfg-node="true"
                    role="button"
                    tabIndex={0}
                    aria-label={`${shortenedLabel(node.label)}, ${node.role}, ${node.change}`}
                    onClick={() => onSelectNode(node.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectNode(node.id);
                      }
                    }}
                    opacity={dimmed ? 0.28 : 1}
                    className="group cursor-pointer focus:outline-none"
                  >
                    <rect
                      x={node.x - 5}
                      y={node.y - 5}
                      width={CFG_NODE_DIMENSIONS.width + 10}
                      height={CFG_NODE_DIMENSIONS.height + 10}
                      rx="13"
                      fill="none"
                      className="stroke-transparent group-focus:stroke-cyan-300"
                      strokeWidth="3"
                    />
                    {selected ? (
                      <rect
                        x={node.x - 6}
                        y={node.y - 6}
                        width={CFG_NODE_DIMENSIONS.width + 12}
                        height={CFG_NODE_DIMENSIONS.height + 12}
                        rx="14"
                        fill="none"
                        className="stroke-cyan-300"
                        strokeWidth="3"
                      />
                    ) : null}
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
                      className="pointer-events-none fill-slate-100 font-mono text-[12px] font-semibold"
                    >
                      {shortenedLabel(node.label)}
                    </text>
                    <text
                      x={node.x + 14}
                      y={node.y + 49}
                      className="pointer-events-none fill-slate-500 font-mono text-[10px]"
                    >
                      {node.role} · {node.change}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        <details className="border-t border-slate-800 px-4 py-3">
          <summary className="cursor-pointer text-xs font-semibold text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none">
            {cfgContent.graphData.heading}
          </summary>
          <div className="mt-4">
            <GraphList
              snapshot={snapshot}
              label={label}
              onSelectNode={onSelectNode}
            />
          </div>
        </details>
      </section>
    );
  }),
);
