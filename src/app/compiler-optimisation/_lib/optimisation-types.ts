import type { z } from "zod";

import type {
  beforeAfterMetricSchema,
  controlFlowGraphEdgeSchema,
  controlFlowGraphNodeSchema,
  controlFlowGraphSnapshotSchema,
  optimisationMetadataSchema,
  optimisationPassSchema,
  optimisationPassScopeSchema,
  optimisationPassTypeSchema,
  optimisationResultSchema,
  optimisationSchemaVersionSchema,
  optimisedFunctionSchema,
  passControlFlowGraphSchema,
  passDependencyRelationSchema,
  passDependencySchema,
  passIrSchema,
  passMetricsSchema,
  passTransformationSchema,
} from "./optimisation-schema";

export {
  CURRENT_OPTIMISATION_SCHEMA_VERSION,
  SUPPORTED_OPTIMISATION_SCHEMA_MAJOR,
} from "./optimisation-schema";

/** External service payload types. Validate unknown input before using them. */
export type OptimisationSchemaVersion = z.infer<
  typeof optimisationSchemaVersionSchema
>;
export type OptimisationResult = z.infer<typeof optimisationResultSchema>;
export type OptimisationMetadata = z.infer<typeof optimisationMetadataSchema>;
export type OptimisedFunction = z.infer<typeof optimisedFunctionSchema>;
export type OptimisationPass = z.infer<typeof optimisationPassSchema>;
export type OptimisationPassType = z.infer<typeof optimisationPassTypeSchema>;
export type OptimisationPassScope = z.infer<typeof optimisationPassScopeSchema>;
export type PassIr = z.infer<typeof passIrSchema>;
export type PassMetrics = z.infer<typeof passMetricsSchema>;
export type BeforeAfterMetric = z.infer<typeof beforeAfterMetricSchema>;
export type PassControlFlowGraph = z.infer<typeof passControlFlowGraphSchema>;
export type ControlFlowGraphSnapshot = z.infer<
  typeof controlFlowGraphSnapshotSchema
>;
export type ControlFlowGraphNode = z.infer<typeof controlFlowGraphNodeSchema>;
export type ControlFlowGraphEdge = z.infer<typeof controlFlowGraphEdgeSchema>;
export type PassTransformation = z.infer<typeof passTransformationSchema>;
export type PassDependency = z.infer<typeof passDependencySchema>;
export type PassDependencyRelation = z.infer<
  typeof passDependencyRelationSchema
>;

/*
 * UI-facing View Model types. Components consume only these types; the raw
 * OptimisationResult payload stops at the adapter boundary.
 */

export type UnavailableData<
  Reason extends "not-provided" | "not-applicable" = "not-provided",
> = Readonly<{
  status: "unavailable";
  reason: Reason;
}>;

export type AvailableData<T> = Readonly<{
  status: "available";
  data: T;
}>;

/**
 * An explicit optional-data state for UI narrowing. Missing payload values are
 * never represented by invented zeroes, empty strings or empty graphs.
 */
export type DataAvailability<
  T,
  Reason extends "not-provided" | "not-applicable" = "not-provided",
> = AvailableData<T> | UnavailableData<Reason>;

export type MetricKey =
  | "instructions"
  | "memoryOperations"
  | "basicBlocks"
  | "branches"
  | "cyclomaticComplexity";

export type MetricValueViewModel = Readonly<{
  before: number;
  after: number;
  delta: number;
  estimated: boolean;
}>;

/** A present metrics block may still omit individual, uncomputed metrics. */
export type PassMetricsViewModel = Readonly<{
  values: Readonly<Record<MetricKey, DataAvailability<MetricValueViewModel>>>;
}>;

export type ControlFlowGraphNodeViewModel = Readonly<{
  id: string;
  label: string;
}>;

export type ControlFlowGraphEdgeViewModel = Readonly<{
  source: string;
  target: string;
  label: DataAvailability<string>;
}>;

export type ControlFlowGraphSnapshotViewModel = Readonly<{
  nodes: ReadonlyArray<ControlFlowGraphNodeViewModel>;
  edges: ReadonlyArray<ControlFlowGraphEdgeViewModel>;
}>;

export type PassControlFlowGraphViewModel = Readonly<{
  before: ControlFlowGraphSnapshotViewModel;
  after: ControlFlowGraphSnapshotViewModel;
}>;

export type PassTransformationViewModel = Readonly<{
  category: string;
  summary: string;
}>;

export type PassDependencyViewModel = Readonly<{
  passId: string;
  relation: "requires" | "enables" | "related" | "unknown";
}>;

export type PassScopeViewModel =
  | Readonly<{ level: "module" }>
  | Readonly<{
      level: "function";
      functionId: string;
      functionName: string;
    }>
  | Readonly<{
      level: "loop";
      functionId: string;
      functionName: string;
      loopId: string;
    }>
  | Readonly<{
      level: "unknown";
      function: DataAvailability<Readonly<{ id: string; name: string }>>;
      loopId: DataAvailability<string>;
    }>;

export type PassPositionViewModel = Readonly<{
  /** Zero-based position in the complete optimisation event stream. */
  global: number;
  /** Zero-based position among Passes associated with the same function. */
  withinFunction: DataAvailability<number, "not-applicable">;
}>;

export type PassIrViewModel = Readonly<{
  before: string;
  after: string;
}>;

export type OptimisationPassViewModel = Readonly<{
  id: string;
  name: string;
  fullName: DataAvailability<string>;
  type: "transform" | "analysis" | "unknown";
  scope: PassScopeViewModel;
  position: PassPositionViewModel;
  changed: boolean;
  ir: PassIrViewModel;
  metrics: DataAvailability<PassMetricsViewModel>;
  cfg: DataAvailability<PassControlFlowGraphViewModel>;
  transformation: DataAvailability<PassTransformationViewModel>;
  /** Available with an empty array means dependencies were computed as none. */
  dependencies: DataAvailability<ReadonlyArray<PassDependencyViewModel>>;
}>;

export type OptimisationFunctionViewModel = Readonly<{
  id: string;
  name: string;
  signature: DataAvailability<string>;
  /** Sorted by each Pass's global position; local positions are 0..n-1. */
  passes: ReadonlyArray<OptimisationPassViewModel>;
}>;

export type OptimisationSummaryViewModel = Readonly<{
  functionCount: number;
  totalPassCount: number;
  changedPassCount: number;
  unchangedPassCount: number;
  transformPassCount: number;
  analysisPassCount: number;
  unknownPassCount: number;
}>;

export type OptimisationViewModel = Readonly<{
  schemaVersion: string;
  sourceFile: string;
  optimisationLevel: string;
  summary: OptimisationSummaryViewModel;
  /** Complete Pass stream, sorted by global position. */
  passes: ReadonlyArray<OptimisationPassViewModel>;
  /** Module Passes and unknown-scope Passes without a function owner. */
  globalPasses: ReadonlyArray<OptimisationPassViewModel>;
  /** Functions retain payload order; each nested Pass list is globally ordered. */
  functions: ReadonlyArray<OptimisationFunctionViewModel>;
  /** Index objects must be created without a prototype by the adapter. */
  functionsById: Readonly<
    Record<string, OptimisationFunctionViewModel | undefined>
  >;
  passesById: Readonly<Record<string, OptimisationPassViewModel | undefined>>;
}>;

export type OptimisationDataIssue = Readonly<{
  code: string;
  path: ReadonlyArray<string | number>;
  message: string;
}>;

export type OptimisationDataError = Readonly<{
  category: "protocol";
  code: "invalid-payload";
  message: string;
  issues: ReadonlyArray<OptimisationDataIssue>;
}>;

export type ParseOptimisationResult =
  | Readonly<{ ok: true; data: OptimisationViewModel }>
  | Readonly<{ ok: false; error: OptimisationDataError }>;

/** Props boundary for the Day 4 workspace and its function/Pass views. */
export type OptimisationWorkspaceProps = Readonly<{
  model: OptimisationViewModel;
}>;

export type OptimisationFunctionViewProps = Readonly<{
  function: OptimisationFunctionViewModel;
}>;

export type OptimisationPassViewProps = Readonly<{
  pass: OptimisationPassViewModel;
}>;
