import type {
  ControlFlowGraphEdgeViewModel,
  ControlFlowGraphNodeViewModel,
  ControlFlowGraphSnapshotViewModel,
} from "./optimisation-types";

export type CfgChange = "unchanged" | "added" | "removed" | "changed";
export type CfgNodeRole = "entry" | "exit" | "entry-exit" | "internal";
export type CfgEdgeRoute = "forward" | "long" | "back" | "self";

export type CfgDiagramNode = ControlFlowGraphNodeViewModel &
  Readonly<{
    x: number;
    y: number;
    rank: number;
    change: CfgChange;
    role: CfgNodeRole;
  }>;

export type CfgDiagramEdge = ControlFlowGraphEdgeViewModel &
  Readonly<{
    id: string;
    path: string;
    labelX: number;
    labelY: number;
    route: CfgEdgeRoute;
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

export type CfgComparisonDisplayModels = Readonly<{
  before: CfgDisplayModel;
  after: CfgDisplayModel;
}>;

type NodePosition = Readonly<{ x: number; y: number; rank: number }>;

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;
const HORIZONTAL_GAP = 72;
const VERTICAL_GAP = 88;
const CANVAS_PADDING = 40;
const ROUTE_GUTTER = 104;
const ROUTE_LANE_GAP = 18;
const EDGE_PORT_GAP = 18;

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

function validateSnapshot(
  snapshot: ControlFlowGraphSnapshotViewModel,
): CfgDiagramFallback | undefined {
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
  return undefined;
}

function sharedNodeOrder(
  before: ControlFlowGraphSnapshotViewModel,
  after: ControlFlowGraphSnapshotViewModel,
): ReadonlyArray<string> {
  const order: Array<string> = [];
  const seen = new Set<string>();
  for (const node of [...before.nodes, ...after.nodes]) {
    if (!seen.has(node.id)) {
      seen.add(node.id);
      order.push(node.id);
    }
  }
  return order;
}

function sharedEdges(
  before: ControlFlowGraphSnapshotViewModel,
  after: ControlFlowGraphSnapshotViewModel,
): ReadonlyArray<ControlFlowGraphEdgeViewModel> {
  const edges: Array<ControlFlowGraphEdgeViewModel> = [];
  const seen = new Set<string>();
  for (const edge of [...before.edges, ...after.edges]) {
    const signature = edgeSignature(edge);
    if (!seen.has(signature)) {
      seen.add(signature);
      edges.push(edge);
    }
  }
  return edges;
}

function createSharedPositions(
  before: ControlFlowGraphSnapshotViewModel,
  after: ControlFlowGraphSnapshotViewModel,
): Readonly<{
  positions: ReadonlyMap<string, NodePosition>;
  width: number;
  height: number;
}> {
  const nodeOrder = sharedNodeOrder(before, after);
  const nodeOrderIndex = new Map(
    nodeOrder.map((nodeId, index) => [nodeId, index] as const),
  );
  const outgoing = new Map<string, Array<string>>();
  const incomingCount = new Map<string, number>();
  for (const nodeId of nodeOrder) {
    outgoing.set(nodeId, []);
    incomingCount.set(nodeId, 0);
  }
  for (const edge of sharedEdges(before, after)) {
    if (edge.source === edge.target) continue;
    const targets = outgoing.get(edge.source);
    if (targets !== undefined && !targets.includes(edge.target)) {
      targets.push(edge.target);
      incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
    }
  }

  const roots = nodeOrder.filter(
    (nodeId) => (incomingCount.get(nodeId) ?? 0) === 0,
  );
  const queue = roots.length > 0 ? [...roots] : nodeOrder.slice(0, 1);
  const ranks = new Map<string, number>(queue.map((nodeId) => [nodeId, 0]));
  for (const source of queue) {
    const sourceRank = ranks.get(source) ?? 0;
    for (const target of outgoing.get(source) ?? []) {
      if (!ranks.has(target)) {
        ranks.set(target, sourceRank + 1);
        queue.push(target);
      }
    }
  }

  let lastRank = Math.max(0, ...ranks.values());
  for (const nodeId of nodeOrder) {
    if (!ranks.has(nodeId)) {
      lastRank += 1;
      ranks.set(nodeId, lastRank);
    }
  }

  const layers = new Map<number, Array<string>>();
  for (const nodeId of nodeOrder) {
    const rank = ranks.get(nodeId) ?? 0;
    const layer = layers.get(rank) ?? [];
    layer.push(nodeId);
    layers.set(rank, layer);
  }
  for (const layer of layers.values()) {
    layer.sort(
      (left, right) =>
        (nodeOrderIndex.get(left) ?? 0) - (nodeOrderIndex.get(right) ?? 0),
    );
  }

  const maxLayerSize = Math.max(
    1,
    ...[...layers.values()].map((l) => l.length),
  );
  const contentWidth =
    maxLayerSize * NODE_WIDTH + Math.max(0, maxLayerSize - 1) * HORIZONTAL_GAP;
  const width =
    CANVAS_PADDING * 2 + ROUTE_GUTTER * 2 + Math.max(NODE_WIDTH, contentWidth);
  const height =
    CANVAS_PADDING * 2 + (lastRank + 1) * NODE_HEIGHT + lastRank * VERTICAL_GAP;
  const positions = new Map<string, NodePosition>();
  for (const [rank, layer] of layers) {
    const layerWidth =
      layer.length * NODE_WIDTH +
      Math.max(0, layer.length - 1) * HORIZONTAL_GAP;
    const layerStartX = (width - layerWidth) / 2;
    layer.forEach((nodeId, index) => {
      positions.set(nodeId, {
        x: layerStartX + index * (NODE_WIDTH + HORIZONTAL_GAP),
        y: CANVAS_PADDING + rank * (NODE_HEIGHT + VERTICAL_GAP),
        rank,
      });
    });
  }
  return { positions, width, height };
}

function portOffset(index: number, count: number): number {
  return (index - (count - 1) / 2) * EDGE_PORT_GAP;
}

function createEdgeRoute(
  edge: ControlFlowGraphEdgeViewModel,
  source: CfgDiagramNode,
  target: CfgDiagramNode,
  edgeIndex: number,
  outgoingIndex: number,
  outgoingTotal: number,
  incomingIndex: number,
  incomingTotal: number,
  canvasWidth: number,
): Readonly<{
  path: string;
  labelX: number;
  labelY: number;
  route: CfgEdgeRoute;
}> {
  if (edge.source === edge.target) {
    const sourceX = source.x + NODE_WIDTH;
    const sourceY = source.y + NODE_HEIGHT / 2;
    const loopX = sourceX + 62;
    return {
      path: `M ${sourceX} ${sourceY - 12} C ${loopX} ${sourceY - 46}, ${loopX} ${sourceY + 46}, ${sourceX} ${sourceY + 12}`,
      labelX: loopX,
      labelY: sourceY,
      route: "self",
    };
  }

  const sourceX =
    source.x + NODE_WIDTH / 2 + portOffset(outgoingIndex, outgoingTotal);
  const sourceY = source.y + NODE_HEIGHT;
  const targetX =
    target.x + NODE_WIDTH / 2 + portOffset(incomingIndex, incomingTotal);
  const targetY = target.y;
  const rankDelta = target.rank - source.rank;
  if (rankDelta === 1) {
    const middleY = (sourceY + targetY) / 2;
    return {
      path: `M ${sourceX} ${sourceY} C ${sourceX} ${middleY}, ${targetX} ${middleY}, ${targetX} ${targetY}`,
      labelX: (sourceX + targetX) / 2,
      labelY: middleY - 7,
      route: "forward",
    };
  }

  const sourceCenterX = source.x + NODE_WIDTH / 2;
  const targetCenterX = target.x + NODE_WIDTH / 2;
  const useRightLane = sourceCenterX + targetCenterX >= canvasWidth;
  const laneOffset = ROUTE_LANE_GAP * (1 + (edgeIndex % 4));
  const laneX = useRightLane
    ? canvasWidth - CANVAS_PADDING - ROUTE_GUTTER + laneOffset
    : CANVAS_PADDING + ROUTE_GUTTER - laneOffset;
  const startX = useRightLane ? source.x + NODE_WIDTH : source.x;
  const startY = source.y + NODE_HEIGHT / 2;
  const endX = useRightLane ? target.x + NODE_WIDTH : target.x;
  const endY = target.y + NODE_HEIGHT / 2;
  return {
    path: `M ${startX} ${startY} C ${laneX} ${startY}, ${laneX} ${endY}, ${endX} ${endY}`,
    labelX: laneX + (useRightLane ? -12 : 12),
    labelY: (startY + endY) / 2,
    route: rankDelta <= 0 ? "back" : "long",
  };
}

function createDiagram(
  snapshot: ControlFlowGraphSnapshotViewModel,
  comparison: ControlFlowGraphSnapshotViewModel,
  side: "before" | "after",
  sharedLayout: ReturnType<typeof createSharedPositions>,
): CfgDiagram {
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

  const nodes = snapshot.nodes.map((node): CfgDiagramNode => {
    const position = sharedLayout.positions.get(node.id) ?? {
      x: CANVAS_PADDING + ROUTE_GUTTER,
      y: CANVAS_PADDING,
      rank: 0,
    };
    return {
      ...node,
      ...position,
      change: classifyNode(node, comparisonNodes, side),
      role: classifyRole(node.id, incomingCount, outgoingCount),
    };
  });
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const outgoingSeen = new Map<string, number>();
  const incomingSeen = new Map<string, number>();
  const edges = snapshot.edges.map((edge, index): CfgDiagramEdge => {
    const source = nodesById.get(edge.source)!;
    const target = nodesById.get(edge.target)!;
    const outgoingIndex = outgoingSeen.get(edge.source) ?? 0;
    const incomingIndex = incomingSeen.get(edge.target) ?? 0;
    outgoingSeen.set(edge.source, outgoingIndex + 1);
    incomingSeen.set(edge.target, incomingIndex + 1);
    const route = createEdgeRoute(
      edge,
      source,
      target,
      index,
      outgoingIndex,
      outgoingCount.get(edge.source) ?? 1,
      incomingIndex,
      incomingCount.get(edge.target) ?? 1,
      sharedLayout.width,
    );
    return {
      ...edge,
      ...route,
      id: `${edgeSignature(edge)}\u0000${index}`,
      change: comparisonEdges.has(edgeSignature(edge))
        ? "unchanged"
        : side === "before"
          ? "removed"
          : "added",
    };
  });
  return {
    status: "diagram",
    width: sharedLayout.width,
    height: sharedLayout.height,
    nodes,
    edges,
  };
}

/** Build topology-aware Before/After diagrams on one shared coordinate system. */
export function createCfgComparisonDisplayModels(
  before: ControlFlowGraphSnapshotViewModel,
  after: ControlFlowGraphSnapshotViewModel,
): CfgComparisonDisplayModels {
  const beforeFallback = validateSnapshot(before);
  const afterFallback = validateSnapshot(after);
  const sharedLayout = createSharedPositions(before, after);
  return {
    before:
      beforeFallback ?? createDiagram(before, after, "before", sharedLayout),
    after: afterFallback ?? createDiagram(after, before, "after", sharedLayout),
  };
}

/** Build one side while preserving coordinates shared with its comparison. */
export function createCfgDisplayModel(
  snapshot: ControlFlowGraphSnapshotViewModel,
  comparison: ControlFlowGraphSnapshotViewModel,
  side: "before" | "after",
): CfgDisplayModel {
  const models =
    side === "before"
      ? createCfgComparisonDisplayModels(snapshot, comparison)
      : createCfgComparisonDisplayModels(comparison, snapshot);
  return models[side];
}

export const CFG_NODE_DIMENSIONS = {
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
} as const;
