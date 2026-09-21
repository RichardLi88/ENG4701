import { irDiffContent } from "../content";
import type { IrEmphasis } from "../_lib/workspace-state";
import { IrLine } from "./ir-line";

const content = irDiffContent.snapshot;

type IrSnapshotViewProps = Readonly<{
  ir: string;
  headingId: string;
  emphasis?: IrEmphasis;
}>;

/**
 * The IR shown once, for a Pass that changed nothing. Two identical panes with
 * no highlighting invite a hunt for a difference that is not there.
 */
export function IrSnapshotView({
  ir,
  headingId,
  emphasis = "guided",
}: IrSnapshotViewProps) {
  const lines = ir.split("\n");

  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
      >
        {content.heading}
      </h3>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
        {content.description}
      </p>
      <details className="mt-3 overflow-hidden rounded-xl border border-slate-800">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-300 transition hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none">
          {content.toggle}
        </summary>
        <div
          className="max-h-[30rem] overflow-auto overscroll-contain border-t border-slate-800 bg-[var(--workspace-code-bg)] focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none focus-visible:ring-inset"
          tabIndex={0}
          role="region"
          aria-label={content.regionLabel}
        >
          <div className="w-max min-w-full py-2 font-mono text-[0.78rem] leading-6">
            {lines.map((line, index) => (
              <div
                key={`ir-line-${index}`}
                className="grid min-h-6 grid-cols-[3.5rem_minmax(0,1fr)] text-slate-300"
              >
                <span className="border-r border-slate-800/70 pr-3 text-right text-slate-600 select-none">
                  {index + 1}
                </span>
                <code className="px-4 whitespace-pre">
                  <IrLine content={line} emphasis={emphasis} />
                </code>
              </div>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}
