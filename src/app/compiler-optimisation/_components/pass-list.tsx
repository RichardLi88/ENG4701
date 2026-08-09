import type { OptimisationPassViewModel } from "../_lib/optimisation-types";

type PassListProps = Readonly<{
  passes: ReadonlyArray<OptimisationPassViewModel>;
  selectedPassId?: string;
  onSelect: (passId: string) => void;
}>;

export function PassList({ passes, selectedPassId, onSelect }: PassListProps) {
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
      <ol className="space-y-1.5">
        {passes.map((pass) => {
          const selected = pass.id === selectedPassId;

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
                    {pass.type}
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
    </section>
  );
}
