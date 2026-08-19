import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type UIEvent,
} from "react";

import type { OptimisationPassViewModel } from "../_lib/optimisation-types";

type PassListProps = Readonly<{
  passes: ReadonlyArray<OptimisationPassViewModel>;
  scopeName: string;
  selectedPassId?: string;
  selectedPassIndex: number;
  onSelect: (passId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}>;

export const PASS_VIRTUALISATION_THRESHOLD = 50;
const VIRTUAL_ROW_HEIGHT = 78;
const VIRTUAL_VIEWPORT_HEIGHT = 512;
const VIRTUAL_OVERSCAN = 6;

export const PassList = memo(function PassList({
  passes,
  scopeName,
  selectedPassId,
  selectedPassIndex,
  onSelect,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  hasActiveFilters,
  onClearFilters,
}: PassListProps) {
  const passButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const virtualViewportRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusIndexRef = useRef<number | undefined>(undefined);
  const [virtualStartIndex, setVirtualStartIndex] = useState(0);
  const shouldVirtualise = passes.length > PASS_VIRTUALISATION_THRESHOLD;
  const virtualVisibleCount =
    Math.ceil(VIRTUAL_VIEWPORT_HEIGHT / VIRTUAL_ROW_HEIGHT) +
    VIRTUAL_OVERSCAN * 2;
  const boundedVirtualStartIndex = Math.min(
    virtualStartIndex,
    Math.max(0, passes.length - virtualVisibleCount),
  );
  const renderedPasses = useMemo(() => {
    const startIndex = shouldVirtualise ? boundedVirtualStartIndex : 0;
    const endIndex = shouldVirtualise
      ? Math.min(passes.length, startIndex + virtualVisibleCount)
      : passes.length;

    return passes.slice(startIndex, endIndex).map((pass, offset) => ({
      pass,
      passIndex: startIndex + offset,
    }));
  }, [boundedVirtualStartIndex, passes, shouldVirtualise, virtualVisibleCount]);
  const navigationButtonClass =
    "rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-slate-700 disabled:hover:text-slate-300";

  useEffect(() => {
    const pendingFocusIndex = pendingFocusIndexRef.current;
    const pendingButton =
      pendingFocusIndex === undefined
        ? undefined
        : passButtonRefs.current[pendingFocusIndex];

    if (pendingButton !== null && pendingButton !== undefined) {
      pendingButton.focus();
      pendingFocusIndexRef.current = undefined;
    }
  });

  useEffect(() => {
    if (!shouldVirtualise || selectedPassIndex < 0) return;

    const viewport = virtualViewportRef.current;
    if (viewport === null) return;

    const selectedTop = selectedPassIndex * VIRTUAL_ROW_HEIGHT;
    const selectedBottom = selectedTop + VIRTUAL_ROW_HEIGHT;
    let nextScrollTop: number | undefined;

    if (selectedTop < viewport.scrollTop) {
      nextScrollTop = selectedTop;
    } else if (selectedBottom > viewport.scrollTop + viewport.clientHeight) {
      nextScrollTop = selectedBottom - viewport.clientHeight;
    }

    if (nextScrollTop !== undefined) {
      viewport.scrollTop = nextScrollTop;
      setVirtualStartIndex(
        Math.max(
          0,
          Math.floor(nextScrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN,
        ),
      );
    }
  }, [selectedPassIndex, shouldVirtualise]);

  function handleVirtualScroll(event: UIEvent<HTMLDivElement>) {
    const nextStartIndex = Math.max(
      0,
      Math.floor(event.currentTarget.scrollTop / VIRTUAL_ROW_HEIGHT) -
        VIRTUAL_OVERSCAN,
    );

    setVirtualStartIndex((currentStartIndex) =>
      currentStartIndex === nextStartIndex ? currentStartIndex : nextStartIndex,
    );
  }

  function handlePassKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    passIndex: number,
  ) {
    const targetIndex =
      event.key === "ArrowUp"
        ? passIndex - 1
        : event.key === "ArrowDown"
          ? passIndex + 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? passes.length - 1
              : undefined;

    if (
      targetIndex === undefined ||
      targetIndex < 0 ||
      targetIndex >= passes.length
    ) {
      return;
    }

    event.preventDefault();
    const targetPass = passes[targetIndex];

    if (targetPass !== undefined) {
      pendingFocusIndexRef.current = targetIndex;
      onSelect(targetPass.id);

      const targetButton = passButtonRefs.current[targetIndex];

      if (targetButton !== null && targetButton !== undefined) {
        targetButton.focus();
        pendingFocusIndexRef.current = undefined;
      } else if (shouldVirtualise) {
        const nextStartIndex = Math.max(0, targetIndex - VIRTUAL_OVERSCAN);
        const viewport = virtualViewportRef.current;

        if (viewport !== null) {
          viewport.scrollTop = nextStartIndex * VIRTUAL_ROW_HEIGHT;
        }

        setVirtualStartIndex(nextStartIndex);
      }
    }
  }

  const passList = (
    <ol
      className={shouldVirtualise ? "relative" : "space-y-1.5"}
      style={
        shouldVirtualise
          ? { height: passes.length * VIRTUAL_ROW_HEIGHT }
          : undefined
      }
    >
      {renderedPasses.map(({ pass, passIndex }) => {
        const selected = pass.id === selectedPassId;
        const scopeLevel =
          pass.scope.level === "unknown"
            ? "Unknown scope"
            : `${pass.scope.level[0]?.toUpperCase()}${pass.scope.level.slice(1)} scope`;

        return (
          <li
            key={pass.id}
            aria-posinset={passIndex + 1}
            aria-setsize={passes.length}
            className={shouldVirtualise ? "absolute inset-x-0 h-18" : undefined}
            style={
              shouldVirtualise
                ? {
                    transform: `translateY(${passIndex * VIRTUAL_ROW_HEIGHT}px)`,
                  }
                : undefined
            }
          >
            <button
              ref={(element) => {
                passButtonRefs.current[passIndex] = element;
              }}
              type="button"
              onClick={() => onSelect(pass.id)}
              onKeyDown={(event) => handlePassKeyDown(event, passIndex)}
              className={`grid w-full min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${shouldVirtualise ? "h-18" : ""} ${
                selected
                  ? "border-cyan-400/60 bg-cyan-400/10"
                  : "border-transparent bg-slate-900/60 hover:border-slate-700"
              }`}
              aria-current={selected ? "step" : undefined}
              aria-pressed={selected}
              aria-keyshortcuts="ArrowUp ArrowDown Home End"
              aria-label={`Pass ${pass.position.global + 1}, ${pass.name}, ${pass.type}, ${scopeLevel}, ${pass.changed ? "changed" : "unchanged"}${selected ? ", current" : ""}`}
            >
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {String(pass.position.global + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span
                  className="block truncate text-sm font-medium text-slate-200"
                  title={
                    pass.fullName.status === "available"
                      ? pass.fullName.data
                      : pass.name
                  }
                >
                  {pass.name}
                </span>
                <span className="mt-0.5 block text-[0.68rem] tracking-wide text-slate-500 uppercase">
                  {pass.type} · {scopeLevel}
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-1 text-[0.65rem] font-semibold uppercase ${
                  pass.changed
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {pass.changed ? "Changed" : "No change"}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <section aria-labelledby="passes-heading" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="passes-heading"
          className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
        >
          Pass timeline
        </h2>
        <span className="font-mono text-xs text-slate-500">
          {passes.length}
        </span>
      </div>
      <nav
        aria-label="Pass timeline navigation"
        className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2"
      >
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canPrevious}
          className={navigationButtonClass}
          aria-label="Previous Pass"
        >
          ← Previous
        </button>
        <span
          className="min-w-12 text-center font-mono text-xs text-slate-500 tabular-nums"
          aria-live="polite"
        >
          {selectedPassIndex >= 0 ? selectedPassIndex + 1 : 0}/{passes.length}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className={navigationButtonClass}
          aria-label="Next Pass"
        >
          Next →
        </button>
      </nav>
      {passes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-4 text-center">
          <p className="text-sm font-medium text-slate-200">
            {hasActiveFilters ? "No matching Passes" : "No Passes reported"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {hasActiveFilters
              ? `Clear the filters to restore the ${scopeName} timeline.`
              : `The ${scopeName} scope has no timeline entries for this run.`}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-3 rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : shouldVirtualise ? (
        <div
          ref={virtualViewportRef}
          className="h-128 overflow-y-auto overscroll-contain pr-1 focus-within:ring-1 focus-within:ring-cyan-400/30"
          onScroll={handleVirtualScroll}
          data-virtualised="true"
        >
          {passList}
        </div>
      ) : (
        passList
      )}
    </section>
  );
});
