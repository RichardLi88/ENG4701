import type { OptimisationPassViewModel } from "../_lib/optimisation-types";

type PassListProps = Readonly<{
  passes: ReadonlyArray<OptimisationPassViewModel>;
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

export function PassList({
  passes,
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
  const navigationButtonClass =
    "rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-slate-700 disabled:hover:text-slate-300";

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
              ? "Clear the filters to restore this function's full timeline."
              : "This function has no timeline entries for this run."}
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
      ) : (
        <ol className="space-y-1.5">
          {passes.map((pass) => {
            const selected = pass.id === selectedPassId;
            const scopeLevel =
              pass.scope.level === "unknown"
                ? "Unknown scope"
                : `${pass.scope.level[0]?.toUpperCase()}${pass.scope.level.slice(1)} scope`;

            return (
              <li key={pass.id}>
                <button
                  type="button"
                  onClick={() => onSelect(pass.id)}
                  className={`grid w-full min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-2.5 text-left transition focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
                    selected
                      ? "border-cyan-400/60 bg-cyan-400/10"
                      : "border-transparent bg-slate-900/60 hover:border-slate-700"
                  }`}
                  aria-current={selected ? "step" : undefined}
                  aria-pressed={selected}
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
      )}
    </section>
  );
}
