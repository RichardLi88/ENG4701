type StatusPanelProps = Readonly<{
  eyebrow?: string;
  title: string;
  description: string;
  tone?: "info" | "empty" | "error";
  compact?: boolean;
}>;

const toneStyles = {
  info: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  empty: "border-slate-700 bg-slate-900 text-slate-200",
  error: "border-rose-400/30 bg-rose-400/10 text-rose-100",
} as const;

const toneSymbols = {
  info: "i",
  empty: "—",
  error: "!",
} as const;

export function StatusPanel({
  eyebrow = "Status",
  title,
  description,
  tone = "info",
  compact = false,
}: StatusPanelProps) {
  return (
    <section
      className={`w-full rounded-2xl border ${toneStyles[tone]} ${compact ? "p-5" : "max-w-2xl p-8"}`}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div className="flex items-start gap-4">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-current font-mono text-sm font-bold"
          aria-hidden="true"
        >
          {toneSymbols[tone]}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase opacity-75">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-balance">{title}</h2>
          <p className="mt-2 text-sm leading-6 opacity-80">{description}</p>
        </div>
      </div>
    </section>
  );
}
