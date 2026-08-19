import type {
  ControlFlowGraphEdgeViewModel,
  ControlFlowGraphNodeViewModel,
  ControlFlowGraphSnapshotViewModel,
} from "./optimisation-types";

export type CfgChange = "unchanged" | "added" | "removed" | "changed";
export type CfgNodeRole = "entry" | "exit" | "entry-exit" | "internal";

export type CfgDiagramNode = ControlFlowGraphNodeViewModel &
  Readonly<{
    x: number;
    y: number;
    change: CfgChange;
    role: CfgNodeRole;
  }>;

export type CfgDiagramEdge = ControlFlowGraphEdgeViewModel &
  Readonly<{
    id: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    change: CfgChange;
  }>;

export type CfgDiagram = Readonly<{
  status: "diagram";
  width: number;
  height: number;
  nodes: ReadonlyArray<CfgDiagramNode>;
  edges: ReadonlyArray<CfgDiagramEdge>;
}>;

export type CfgDiagramFallback = Readonly<{
  status: "fallback";
  reason: "duplicate-node-id" | "dangling-edge";
  nodes: ReadonlyArray<ControlFlowGraphNodeViewModel>;
  edges: ReadonlyArray<ControlFlowGraphEdgeViewModel>;
}>;

export type CfgDisplayModel = CfgDiagram | CfgDiagramFallback;

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;
const HORIZONTAL_GAP = 88;
const VERTICAL_GAP = 92;
const CANVAS_PADDING = 40;
const MAX_COLUMNS = 4;

function edgeLabel(edge: ControlFlowGraphEdgeViewModel): string {
  return edge.label.status === "available" ? edge.label.data : "";
}

function edgeSignature(edge: ControlFlowGraphEdgeViewModel): string {
  return `${edge.source}\u0000${edge.target}\u0000${edgeLabel(edge)}`;
}

function classifyNode(
  node: ControlFlowGraphNodeViewModel,
  comparisonNodes: ReadonlyMap<string, ControlFlowGraphNodeViewModel>,
  side: "before" | "after",
): CfgChange {
  const comparisonNode = comparisonNodes.get(node.id);

  if (comparisonNode === undefined) {
    return side === "before" ? "removed" : "added";
  }

  return comparisonNode.label === node.label ? "unchanged" : "changed";
}

function classifyRole(
  nodeId: string,
  incomingCount: ReadonlyMap<string, number>,
  outgoingCount: ReadonlyMap<string, number>,
): CfgNodeRole {
  const isEntry = (incomingCount.get(nodeId) ?? 0) === 0;
  const isExit = (outgoingCount.get(nodeId) ?? 0) === 0;

  if (isEntry && isExit) return "entry-exit";
  if (isEntry) return "entry";
  if (isExit) return "exit";
  return "internal";
}

/** Build a deterministic, display-safe graph without mutating service data. */
export function createCfgDisplayModel(
  snapshot: ControlFlowGraphSnapshotViewModel,
  comparison: ControlFlowGraphSnapshotViewModel,
  side: "before" | "after",
): CfgDisplayModel {
  const nodeIds = new Set<string>();

  for (const node of snapshot.nodes) {
    if (nodeIds.has(node.id)) {
      return {
        status: "fallback",
        reason: "duplicate-node-id",
        nodes: snapshot.nodes,
        edges: snapshot.edges,
      };
    }
    nodeIds.add(node.id);
  }

  if (
    snapshot.edges.some(
      (edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target),
    )
  ) {
    return {
      status: "fallback",
      reason: "dangling-edge",
      nodes: snapshot.nodes,
      edges: snapshot.edges,
    };
  }

  const columnCount = Math.min(
    MAX_COLUMNS,
    Math.max(1, Math.ceil(Math.sqrt(snapshot.nodes.length))),
  );
  const rowCount = Math.max(1, Math.ceil(snapshot.nodes.length / columnCount));
  const width =
    CANVAS_PADDING * 2 +
    columnCount * NODE_WIDTH +
    (columnCount - 1) * HORIZONTAL_GAP;
  const height =
    CANVAS_PADDING * 2 + rowCount * NODE_HEIGHT + (rowCount - 1) * VERTICAL_GAP;
  const comparisonNodes = new Map(
    comparison.nodes.map((node) => [node.id, node] as const),
  );
  const comparisonEdges = new Set(comparison.edges.map(edgeSignature));
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();

  for (const edge of snapshot.edges) {
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1);
  }

  const nodes = snapshot.nodes.map(
    (node, index): CfgDiagramNode => ({
      ...node,
      x: CANVAS_PADDING + (index % columnCount) * (NODE_WIDTH + HORIZONTAL_GAP),
      y:
        CANVAS_PADDING +
        Math.floor(index / columnCount) * (NODE_HEIGHT + VERTICAL_GAP),
      change: classifyNode(node, comparisonNodes, side),
      role: classifyRole(node.id, incomingCount, outgoingCount),
    }),
  );
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const edges = snapshot.edges.map((edge, index): CfgDiagramEdge => {
    const source = nodesById.get(edge.source)!;
    const target = nodesById.get(edge.target)!;

    return {
      ...edge,
      id: `${edgeSignature(edge)}\u0000${index}`,
      sourceX: source.x + NODE_WIDTH / 2,
      sourceY: source.y + NODE_HEIGHT,
      targetX: target.x + NODE_WIDTH / 2,
      targetY: target.y,
      change: comparisonEdges.has(edgeSignature(edge))
        ? "unchanged"
        : side === "before"
          ? "removed"
          : "added",
    };
  });

  return { status: "diagram", width, height, nodes, edges };
}

export const CFG_NODE_DIMENSIONS = {
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
} as const;
