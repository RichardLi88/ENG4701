import { cfgContent } from "../content";
import type { CfgDiagram, CfgDiagramNode } from "../_lib/cfg-display";

type CfgNodeInspectorProps = Readonly<{
  selectedNodeId: string | null;
  before: CfgDiagram;
  after: CfgDiagram;
  compact?: boolean;
}>;

function displayName(node: CfgDiagramNode | undefined): string | undefined {
  return node?.label.split(/\r?\n/, 1)[0];
}

function connections(
  model: CfgDiagram,
  nodeId: string,
  direction: "incoming" | "outgoing",
): ReadonlyArray<string> {
  return model.edges.flatMap((edge) => {
    if (direction === "incoming" && edge.target === nodeId) {
      return [edge.source];
    }
    if (direction === "outgoing" && edge.source === nodeId) {
      return [edge.target];
    }
    return [];
  });
}

type SnapshotInspectorProps = Readonly<{
  label: string;
  node: CfgDiagramNode | undefined;
  model: CfgDiagram;
  selectedNodeId: string;
}>;

function SnapshotInspector({
  label,
  node,
  model,
  selectedNodeId,
}: SnapshotInspectorProps) {
  if (node === undefined) {
    return (
      <section aria-label={label} className="py-4">
        <h5 className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
          {label}
        </h5>
        <p className="mt-3 text-sm text-slate-500">
          {cfgContent.inspector.missing}
        </p>
      </section>
    );
  }

  const incoming = connections(model, selectedNodeId, "incoming");
  const outgoing = connections(model, selectedNodeId, "outgoing");
  const instructionLines = node.label.split(/\r?\n/).slice(1);

  return (
    <section aria-label={label} className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
          {label}
        </h5>
        <span className="rounded-full bg-slate-800 px-2 py-1 font-mono text-[0.65rem] text-slate-300">
          {node.change}
        </span>
      </div>
      <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-slate-950/70 p-3 font-mono text-xs leading-5 whitespace-pre-wrap text-slate-300">
        {instructionLines.length > 0
          ? instructionLines.join("\n")
          : displayName(node)}
      </pre>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {(
          [
            [cfgContent.inspector.incoming, incoming],
            [cfgContent.inspector.outgoing, outgoing],
          ] as const
        ).map(([heading, values]) => (
          <div key={heading}>
            <p className="text-[0.68rem] font-medium text-slate-500">
              {heading}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {values.length > 0 ? (
                values.map((value) => (
                  <code
                    key={value}
                    className="rounded-md bg-slate-800 px-2 py-1 text-[0.65rem] text-cyan-300"
                  >
                    {value}
                  </code>
                ))
              ) : (
                <span className="text-xs text-slate-500">
                  {cfgContent.inspector.noEdges}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CfgNodeInspector({
  selectedNodeId,
  before,
  after,
  compact = false,
}: CfgNodeInspectorProps) {
  const beforeNode =
    selectedNodeId === null
      ? undefined
      : before.nodes.find((node) => node.id === selectedNodeId);
  const afterNode =
    selectedNodeId === null
      ? undefined
      : after.nodes.find((node) => node.id === selectedNodeId);
  const selectedName = displayName(beforeNode) ?? displayName(afterNode);

  return (
    <aside
      aria-label={cfgContent.inspector.heading}
      className={
        compact
          ? "min-h-0 overflow-auto border-t border-slate-800 bg-slate-900/60 px-5 xl:border-t-0 xl:border-l"
          : "mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-5"
      }
    >
      <header className="border-b border-slate-800 py-4">
        <h4 className="text-xs font-semibold tracking-[0.16em] text-slate-300 uppercase">
          {cfgContent.inspector.heading}
        </h4>
        {selectedNodeId === null ? (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {cfgContent.inspector.empty}
          </p>
        ) : (
          <div className="mt-2">
            <p className="font-mono text-sm font-semibold text-slate-100">
              {selectedName}
            </p>
            <p className="mt-1 text-[0.68rem] text-slate-500">
              {cfgContent.inspector.stableId}: {selectedNodeId}
            </p>
          </div>
        )}
      </header>
      {selectedNodeId === null ? null : (
        <div className="divide-y divide-slate-800">
          <SnapshotInspector
            label={cfgContent.inspector.before}
            node={beforeNode}
            model={before}
            selectedNodeId={selectedNodeId}
          />
          <SnapshotInspector
            label={cfgContent.inspector.after}
            node={afterNode}
            model={after}
            selectedNodeId={selectedNodeId}
          />
        </div>
      )}
    </aside>
  );
}
