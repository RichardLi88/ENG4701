"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cfgContent } from "../content";
import {
  createCfgComparisonDisplayModels,
  type CfgChange,
} from "../_lib/cfg-display";
import type {
  DataAvailability,
  PassControlFlowGraphViewModel,
} from "../_lib/optimisation-types";
import {
  CfgGraphPane,
  type CfgGraphPaneHandle,
  type CfgViewport,
} from "./cfg-graph-pane";
import { CfgIcon } from "./cfg-icons";
import { CfgNodeInspector } from "./cfg-node-inspector";

type CfgViewProps = Readonly<{
  cfg: DataAvailability<PassControlFlowGraphViewModel>;
}>;

type CfgSide = "before" | "after";
type CfgViewMode = "split" | CfgSide;
type ScaleState = Readonly<Record<CfgSide, number>>;

const MIN_SCALE = 0.35;
const MAX_SCALE = 1.75;
const SCALE_STEP = 0.15;

const legendStyles: Readonly<Record<CfgChange, string>> = {
  added: "text-emerald-300",
  removed: "text-rose-300",
  changed: "text-amber-300",
  unchanged: "text-slate-400",
};

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

type IconButtonProps = Readonly<{
  label: string;
  icon:
    | "fit"
    | "fullscreen"
    | "exit-fullscreen"
    | "link"
    | "unlink"
    | "minus"
    | "plus";
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}>;

function IconButton({
  label,
  icon,
  onClick,
  pressed,
  disabled = false,
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex size-11 items-center justify-center rounded-lg border text-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 ${
        pressed
          ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
          : "border-slate-700 bg-slate-950/40 hover:bg-slate-800"
      }`}
    >
      <CfgIcon name={icon} />
    </button>
  );
}

type ModeControlProps = Readonly<{
  mode: CfgViewMode;
  onChange: (mode: CfgViewMode) => void;
}>;

function ModeControl({ mode, onChange }: ModeControlProps) {
  const modes: ReadonlyArray<Readonly<{ value: CfgViewMode; label: string }>> =
    [
      { value: "split", label: cfgContent.controls.split },
      { value: "before", label: cfgContent.controls.before },
      { value: "after", label: cfgContent.controls.after },
    ];

  return (
    <div
      className="flex min-h-11 rounded-lg border border-slate-700 bg-slate-950/40 p-1"
      role="group"
      aria-label={cfgContent.controls.modesLabel}
    >
      {modes.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={mode === item.value}
          onClick={() => onChange(item.value)}
          className={`min-h-9 rounded-md px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none ${
            item.value === "split"
              ? "hidden xl:inline-flex xl:items-center"
              : ""
          } ${
            mode === item.value
              ? "bg-slate-700 text-slate-100"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

type SearchNode = Readonly<{ id: string; label: string }>;

type CfgToolbarProps = Readonly<{
  mode: CfgViewMode;
  linked: boolean;
  fullscreen: boolean;
  scale: number;
  query: string;
  results: ReadonlyArray<SearchNode>;
  onModeChange: (mode: CfgViewMode) => void;
  onLinkedChange: () => void;
  onFit: () => void;
  onScaleChange: (delta: number) => void;
  onScaleReset: () => void;
  onFullscreenChange: () => void;
  onQueryChange: (query: string) => void;
  onSelectResult: (nodeId: string) => void;
}>;

function CfgToolbar({
  mode,
  linked,
  fullscreen,
  scale,
  query,
  results,
  onModeChange,
  onLinkedChange,
  onFit,
  onScaleChange,
  onScaleReset,
  onFullscreenChange,
  onQueryChange,
  onSelectResult,
}: CfgToolbarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/80 p-3"
      role="toolbar"
      aria-label={cfgContent.controls.toolbarLabel}
    >
      <ModeControl mode={mode} onChange={onModeChange} />
      <div className="flex items-center gap-1">
        <IconButton
          label={cfgContent.controls.fit}
          icon="fit"
          onClick={onFit}
        />
        <IconButton
          label={cfgContent.controls.zoomOut}
          icon="minus"
          onClick={() => onScaleChange(-SCALE_STEP)}
          disabled={scale <= MIN_SCALE}
        />
        <button
          type="button"
          onClick={onScaleReset}
          aria-label={cfgContent.controls.reset}
          title={cfgContent.controls.reset}
          className="min-h-11 min-w-16 rounded-lg border border-slate-700 bg-slate-950/40 px-2 font-mono text-xs text-slate-300 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
        >
          {Math.round(scale * 100)}%
        </button>
        <IconButton
          label={cfgContent.controls.zoomIn}
          icon="plus"
          onClick={() => onScaleChange(SCALE_STEP)}
          disabled={scale >= MAX_SCALE}
        />
      </div>
      <IconButton
        label={linked ? cfgContent.controls.unlink : cfgContent.controls.link}
        icon={linked ? "link" : "unlink"}
        onClick={onLinkedChange}
        pressed={linked}
      />
      <div className="relative min-w-52 flex-1 sm:max-w-sm">
        <CfgIcon
          name="search"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
        />
        <input
          type="search"
          value={query}
          aria-label={cfgContent.controls.search}
          placeholder={cfgContent.controls.searchPlaceholder}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0] !== undefined) {
              event.preventDefault();
              onSelectResult(results[0].id);
            }
          }}
          className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950/60 pr-3 pl-10 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 focus:outline-none"
        />
        {query.trim().length > 0 ? (
          <ul
            aria-label={cfgContent.search.resultLabel}
            className="absolute top-full right-0 left-0 z-30 mt-2 max-h-60 overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-lg shadow-black/30"
          >
            {results.length > 0 ? (
              results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => onSelectResult(result.id)}
                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
                  >
                    <span className="block font-mono text-xs text-slate-200">
                      {result.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[0.68rem] text-slate-500">
                      {result.id}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-3 text-sm text-slate-500">
                {cfgContent.search.noMatches}
              </li>
            )}
          </ul>
        ) : null}
      </div>
      <IconButton
        label={
          fullscreen
            ? cfgContent.controls.exitFullscreen
            : cfgContent.controls.fullscreen
        }
        icon={fullscreen ? "exit-fullscreen" : "fullscreen"}
        onClick={onFullscreenChange}
      />
    </div>
  );
}

function legend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[0.68rem] text-slate-500">
      {(Object.keys(cfgContent.legend) as Array<CfgChange>).map((change) => (
        <li key={change} className={legendStyles[change]}>
          <span aria-hidden="true">●</span> {cfgContent.legend[change]}
        </li>
      ))}
    </ul>
  );
}

export function CfgView({ cfg }: CfgViewProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const beforePaneRef = useRef<CfgGraphPaneHandle>(null);
  const afterPaneRef = useRef<CfgGraphPaneHandle>(null);
  const [mode, setMode] = useState<CfgViewMode>("split");
  const [linked, setLinked] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fitRequest, setFitRequest] = useState(0);
  const [wideEnoughForSplit, setWideEnoughForSplit] = useState(true);
  const [scales, setScales] = useState<ScaleState>({ before: 1, after: 1 });

  const models = useMemo(
    () =>
      cfg.status === "available"
        ? createCfgComparisonDisplayModels(cfg.data.before, cfg.data.after)
        : undefined,
    [cfg],
  );

  useEffect(() => {
    const element = workspaceRef.current;
    if (element === null) return;
    const update = (width: number) => {
      if (width > 0) setWideEnoughForSplit(width >= 1080);
    };
    update(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) update(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [cfg.status, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullscreen]);

  const effectiveMode: CfgViewMode =
    mode === "split" && !wideEnoughForSplit ? "before" : mode;

  const updateScale = useCallback(
    (side: CfgSide, scale: number) => {
      const nextScale = clampScale(scale);
      setScales((current) =>
        linked
          ? { before: nextScale, after: nextScale }
          : { ...current, [side]: nextScale },
      );
    },
    [linked],
  );

  const updateBeforeScale = useCallback(
    (scale: number) => updateScale("before", scale),
    [updateScale],
  );
  const updateAfterScale = useCallback(
    (scale: number) => updateScale("after", scale),
    [updateScale],
  );

  const syncViewport = useCallback(
    (source: CfgSide, viewport: CfgViewport) => {
      if (!linked) return;
      if (source === "before") afterPaneRef.current?.setViewport(viewport);
      else beforePaneRef.current?.setViewport(viewport);
    },
    [linked],
  );

  const changeVisibleScales = (delta: number) => {
    setScales((current) => {
      if (effectiveMode === "before") {
        const next = clampScale(current.before + delta);
        return linked
          ? { before: next, after: next }
          : { ...current, before: next };
      }
      if (effectiveMode === "after") {
        const next = clampScale(current.after + delta);
        return linked
          ? { before: next, after: next }
          : { ...current, after: next };
      }
      return {
        before: clampScale(current.before + delta),
        after: clampScale(current.after + delta),
      };
    });
  };

  const resetVisibleScales = () => {
    setScales((current) => {
      if (effectiveMode === "before" && !linked)
        return { ...current, before: 1 };
      if (effectiveMode === "after" && !linked) return { ...current, after: 1 };
      return { before: 1, after: 1 };
    });
  };

  const searchNodes = useMemo(() => {
    if (models === undefined) return [];
    const nodes = new Map<string, SearchNode>();
    for (const model of [models.before, models.after]) {
      for (const node of model.nodes) {
        if (!nodes.has(node.id)) {
          nodes.set(node.id, {
            id: node.id,
            label: node.label.split(/\r?\n/, 1)[0] ?? node.id,
          });
        }
      }
    }
    return [...nodes.values()];
  }, [models]);
  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length === 0) return [];
    return searchNodes
      .filter(
        (node) =>
          node.id.toLowerCase().includes(normalizedQuery) ||
          node.label.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 7);
  }, [query, searchNodes]);

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setQuery("");
    requestAnimationFrame(() => {
      beforePaneRef.current?.focusNode(nodeId);
      afterPaneRef.current?.focusNode(nodeId);
    });
  };

  const renderWorkspace = () => {
    if (cfg.status !== "available" || models === undefined) return null;
    const beforeDiagram =
      models.before.status === "diagram" ? models.before : undefined;
    const afterDiagram =
      models.after.status === "diagram" ? models.after : undefined;
    const showBefore = effectiveMode === "split" || effectiveMode === "before";
    const showAfter = effectiveMode === "split" || effectiveMode === "after";
    const activeScale =
      effectiveMode === "after" ? scales.after : scales.before;

    return (
      <div
        ref={workspaceRef}
        className={
          fullscreen
            ? "fixed inset-0 z-50 flex min-h-0 flex-col bg-slate-950 text-slate-100"
            : "overflow-hidden rounded-xl border border-slate-800 bg-slate-900/30"
        }
      >
        {fullscreen ? (
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {cfgContent.heading}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {cfgContent.description}
              </p>
            </div>
            {legend()}
          </header>
        ) : null}
        <CfgToolbar
          mode={effectiveMode}
          linked={linked}
          fullscreen={fullscreen}
          scale={activeScale}
          query={query}
          results={searchResults}
          onModeChange={setMode}
          onLinkedChange={() => setLinked((current) => !current)}
          onFit={() => setFitRequest((current) => current + 1)}
          onScaleChange={changeVisibleScales}
          onScaleReset={resetVisibleScales}
          onFullscreenChange={() => {
            setFullscreen((current) => !current);
            setFitRequest((current) => current + 1);
          }}
          onQueryChange={setQuery}
          onSelectResult={selectNode}
        />
        <div
          className={
            fullscreen &&
            beforeDiagram !== undefined &&
            afterDiagram !== undefined
              ? "grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]"
              : ""
          }
        >
          <div
            className={`grid min-h-0 min-w-0 gap-3 p-3 ${
              effectiveMode === "split" ? "xl:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {showBefore ? (
              <CfgGraphPane
                ref={beforePaneRef}
                side="before"
                snapshot={cfg.data.before}
                model={models.before}
                scale={scales.before}
                selectedNodeId={selectedNodeId}
                fitRequest={fitRequest}
                fullscreen={fullscreen}
                onScaleChange={updateBeforeScale}
                onSelectNode={selectNode}
                onViewportChange={(viewport) =>
                  syncViewport("before", viewport)
                }
              />
            ) : null}
            {showAfter ? (
              <CfgGraphPane
                ref={afterPaneRef}
                side="after"
                snapshot={cfg.data.after}
                model={models.after}
                scale={scales.after}
                selectedNodeId={selectedNodeId}
                fitRequest={fitRequest}
                fullscreen={fullscreen}
                onScaleChange={updateAfterScale}
                onSelectNode={selectNode}
                onViewportChange={(viewport) => syncViewport("after", viewport)}
              />
            ) : null}
          </div>
          {fullscreen &&
          beforeDiagram !== undefined &&
          afterDiagram !== undefined ? (
            <CfgNodeInspector
              selectedNodeId={selectedNodeId}
              before={beforeDiagram}
              after={afterDiagram}
              compact
            />
          ) : null}
        </div>
        {!fullscreen &&
        selectedNodeId !== null &&
        beforeDiagram !== undefined &&
        afterDiagram !== undefined ? (
          <div className="px-3 pb-3">
            <CfgNodeInspector
              selectedNodeId={selectedNodeId}
              before={beforeDiagram}
              after={afterDiagram}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const workspace = renderWorkspace();

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
        {cfg.status === "available" ? legend() : null}
      </div>

      {cfg.status === "unavailable" ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-5 text-sm text-amber-300">
          {cfgContent.unavailable}
        </div>
      ) : (
        workspace
      )}
    </section>
  );
}
