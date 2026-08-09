import type { OptimisationPassViewProps } from "../_lib/optimisation-types";

function scopeLabel(pass: OptimisationPassViewProps["pass"]) {
  switch (pass.scope.level) {
    case "module":
      return "Module";
    case "function":
      return `Function · ${pass.scope.functionName}`;
    case "loop":
      return `Loop · ${pass.scope.loopId}`;
    case "unknown":
      return "Unknown scope";
  }
}

type IrPanelProps = Readonly<{
  label: string;
  code: string;
  accent: "before" | "after";
}>;

function IrPanel({ label, code, accent }: IrPanelProps) {
  return (
    <section
      className="flex min-h-80 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#070b12] lg:min-h-[30rem]"
      aria-label={`${label} optimisation IR`}
    >
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
        <span
          className={`size-2 rounded-full ${accent === "before" ? "bg-amber-300" : "bg-emerald-300"}`}
          aria-hidden="true"
        />
        <h3 className="font-mono text-xs font-semibold tracking-[0.14em] text-slate-300 uppercase">
          {label}
        </h3>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset"
        tabIndex={0}
        role="region"
        aria-label={`${label} IR, read only`}
      >
        <pre className="min-w-max p-4 font-mono text-[0.78rem] leading-6 text-slate-300">
          <code>{code}</code>
        </pre>
      </div>
    </section>
  );
}

export function PassDetail({ pass }: OptimisationPassViewProps) {
  const displayName =
    pass.fullName.status === "available" ? pass.fullName.data : pass.name;
  const scope = scopeLabel(pass);
  const availability = [
    { label: "Metrics", value: pass.metrics.status },
    { label: "Control-flow graph", value: pass.cfg.status },
    { label: "Transformation", value: pass.transformation.status },
    { label: "Dependencies", value: pass.dependencies.status },
  ] as const;
  const hasPartialData = availability.some(
    (item) => item.value === "unavailable",
  );

  return (
    <article className="min-w-0" aria-labelledby="pass-detail-heading">
      <header className="mb-5 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400">
          <span className="rounded-full border border-slate-700 px-2.5 py-1">
            {pass.type}
          </span>
          <span
            className="max-w-full min-w-0 truncate rounded-full border border-slate-700 px-2.5 py-1"
            title={scope}
          >
            {scope}
          </span>
          <span className="rounded-full border border-slate-700 px-2.5 py-1">
            Pass {pass.position.global + 1}
          </span>
          <span className="text-slate-600" aria-hidden="true">
            /
          </span>
          <span
            className={pass.changed ? "text-emerald-300" : "text-slate-400"}
          >
            {pass.changed ? "IR changed" : "IR unchanged"}
          </span>
        </div>
        <h2
          id="pass-detail-heading"
          className="mt-3 text-2xl font-semibold tracking-tight break-words text-slate-50 sm:text-3xl"
          title={displayName}
        >
          {displayName}
        </h2>
        {pass.transformation.status === "available" ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {pass.transformation.data.summary}
          </p>
        ) : null}
      </header>

      <section
        aria-labelledby="pass-data-heading"
        className="mb-5 rounded-xl border border-slate-800 bg-slate-950/50 p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id="pass-data-heading"
            className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase"
          >
            Optional pass data
          </h3>
          <span className="text-xs text-slate-500">
            {hasPartialData ? "Partial data" : "Complete data"}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {availability.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt
                className="truncate text-xs text-slate-500"
                title={item.label}
              >
                {item.label}
              </dt>
              <dd
                className={`mt-1 text-xs font-medium ${
                  item.value === "available"
                    ? "text-emerald-300"
                    : "text-amber-300"
                }`}
              >
                {item.value === "available" ? "Available" : "Not provided"}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">
          Intermediate representation
        </h3>
        <p className="hidden text-xs text-slate-600 sm:block">
          Scroll each pane independently
        </p>
      </div>
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <IrPanel label="Before" code={pass.ir.before} accent="before" />
        <IrPanel label="After" code={pass.ir.after} accent="after" />
      </div>
    </article>
  );
}
