import { memo, useId } from "react";

import { compilerWorkspaceContent } from "../content";
import type {
  PassChangeFilter,
  PassFilterCounts,
  PassFilters,
  PassTypeFilter,
} from "../_lib/workspace-state";

const content = compilerWorkspaceContent.filters;

type PassFiltersProps = Readonly<{
  filters: PassFilters;
  counts: PassFilterCounts;
  onTypeChange: (filter: PassTypeFilter) => void;
  onChangeChange: (filter: PassChangeFilter) => void;
  onSearchChange: (search: string) => void;
}>;

const TYPE_FILTERS = [
  { value: "all", label: content.options.all, hint: content.typeTooltips.all },
  {
    value: "transform",
    label: content.options.transform,
    hint: content.typeTooltips.transform,
  },
  {
    value: "analysis",
    label: content.options.analysis,
    hint: content.typeTooltips.analysis,
  },
] as const;

const CHANGE_FILTERS = [
  { value: "all", label: content.options.all },
  { value: "changed", label: content.options.changed },
  { value: "unchanged", label: content.options.unchanged },
] as const;

const filterButtonClass = (selected: boolean) =>
  `flex min-w-0 items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none ${
    selected
      ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
  }`;

export const PassFiltersControl = memo(function PassFiltersControl({
  filters,
  counts,
  onTypeChange,
  onChangeChange,
  onSearchChange,
}: PassFiltersProps) {
  const searchId = useId();

  return (
    <div className="space-y-3" aria-label={content.regionLabel}>
      <div>
        <label
          htmlFor={searchId}
          className="mb-1.5 block text-[0.68rem] font-semibold tracking-[0.14em] text-slate-500 uppercase"
        >
          {content.searchLabel}
        </label>
        <input
          id={searchId}
          type="search"
          value={filters.search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={content.searchPlaceholder}
          aria-describedby={`${searchId}-hint`}
          className="w-full rounded-md border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus-visible:border-cyan-400/60 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset"
        />
        <p id={`${searchId}-hint`} className="sr-only">
          {content.searchHint}
        </p>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[0.68rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
          {content.typeLegend}
        </legend>
        <div className="grid grid-cols-3 gap-1" role="group">
          {TYPE_FILTERS.map(({ value, label, hint }) => {
            const selected = filters.type === value;
            return (
              <button
                key={value}
                type="button"
                className={filterButtonClass(selected)}
                aria-pressed={selected}
                title={hint}
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
          {content.changesLegend}
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
});
