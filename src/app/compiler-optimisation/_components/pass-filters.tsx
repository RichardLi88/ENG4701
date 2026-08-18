import type {
  PassChangeFilter,
  PassFilterCounts,
  PassFilters,
  PassTypeFilter,
} from "../_lib/workspace-state";

type PassFiltersProps = Readonly<{
  filters: PassFilters;
  counts: PassFilterCounts;
  onTypeChange: (filter: PassTypeFilter) => void;
  onChangeChange: (filter: PassChangeFilter) => void;
}>;

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "transform", label: "Transform" },
  { value: "analysis", label: "Analysis" },
] as const;

const CHANGE_FILTERS = [
  { value: "all", label: "All" },
  { value: "changed", label: "Changed" },
  { value: "unchanged", label: "Unchanged" },
] as const;

const filterButtonClass = (selected: boolean) =>
  `flex min-w-0 items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none ${
    selected
      ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
  }`;

export function PassFiltersControl({
  filters,
  counts,
  onTypeChange,
  onChangeChange,
}: PassFiltersProps) {
  return (
    <div className="space-y-3" aria-label="Pass filters">
      <fieldset>
        <legend className="mb-1.5 text-[0.68rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          Type
        </legend>
        <div className="grid grid-cols-3 gap-1" role="group">
          {TYPE_FILTERS.map(({ value, label }) => {
            const selected = filters.type === value;
            return (
              <button
                key={value}
                type="button"
                className={filterButtonClass(selected)}
                aria-pressed={selected}
                onClick={() => onTypeChange(value)}
              >
                <span className="truncate">{label}</span>
                <span className="font-mono text-[0.65rem] text-slate-500 tabular-nums">
                  {counts.type[value]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-[0.68rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          Changes
        </legend>
        <div className="grid grid-cols-3 gap-1" role="group">
          {CHANGE_FILTERS.map(({ value, label }) => {
            const selected = filters.change === value;
            return (
              <button
                key={value}
                type="button"
                className={filterButtonClass(selected)}
                aria-pressed={selected}
                onClick={() => onChangeChange(value)}
              >
                <span className="truncate">{label}</span>
                <span className="font-mono text-[0.65rem] text-slate-500 tabular-nums">
                  {counts.change[value]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
