import { optimisationResultSchema } from "./optimisation-schema.ts";
import type {
  ControlFlowGraphSnapshot,
  ControlFlowGraphSnapshotViewModel,
  DataAvailability,
  MetricKey,
  MetricValueViewModel,
  OptimisationDataError,
  OptimisationFunctionViewModel,
  OptimisationPass,
  OptimisationPassScope,
  OptimisationPassViewModel,
  OptimisationResult,
  ParseOptimisationResult,
  PassMetrics,
  PassMetricsViewModel,
  PassScopeViewModel,
} from "./optimisation-types";

const METRIC_KEYS = [
  "instructions",
  "memoryOperations",
  "basicBlocks",
  "branches",
  "cyclomaticComplexity",
] as const satisfies ReadonlyArray<MetricKey>;

const notProvided = <T>(): DataAvailability<T> => ({
  status: "unavailable",
  reason: "not-provided",
});

const notApplicable = <T>(): DataAvailability<T, "not-applicable"> => ({
  status: "unavailable",
  reason: "not-applicable",
});

const available = <T>(data: T): DataAvailability<T> => ({
  status: "available",
  data,
});

function createProtocolError(
  issues: ReadonlyArray<{
    code: string;
    path: ReadonlyArray<string | number>;
    message: string;
  }>,
): OptimisationDataError {
  return {
    category: "protocol",
    code: "invalid-payload",
    message: "The optimisation result does not match the supported protocol.",
    issues: issues.map((issue) => ({
      code: issue.code,
      path: [...issue.path],
      message: issue.message,
    })),
  };
}

function createIndex<T extends { id: string }>(
  items: ReadonlyArray<T>,
): Readonly<Record<string, T | undefined>> {
  const index = Object.create(null) as Record<string, T | undefined>;

  for (const item of items) {
    index[item.id] = item;
  }

  return Object.freeze(index);
}

function adaptMetric(
  metric: PassMetrics[MetricKey],
): DataAvailability<MetricValueViewModel> {
  if (metric === undefined) {
    return notProvided();
  }

  return available({
    before: metric.before,
    after: metric.after,
    delta: metric.delta,
    estimated: metric.estimated ?? false,
  });
}

function adaptMetrics(metrics: PassMetrics): PassMetricsViewModel {
  const values = Object.create(null) as Record<
    MetricKey,
    DataAvailability<MetricValueViewModel>
  >;

  for (const key of METRIC_KEYS) {
    values[key] = adaptMetric(metrics[key]);
  }

  return { values: Object.freeze(values) };
}

function adaptGraphSnapshot(
  snapshot: ControlFlowGraphSnapshot,
): ControlFlowGraphSnapshotViewModel {
  return {
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      label: node.label,
    })),
    edges: snapshot.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      label: edge.label === undefined ? notProvided() : available(edge.label),
    })),
  };
}

function scopeFunctionId(scope: OptimisationPassScope): string | undefined {
  return "functionId" in scope ? scope.functionId : undefined;
}

function adaptScope(
  scope: OptimisationPassScope,
  functionsById: ReadonlyMap<string, OptimisationResult["functions"][number]>,
): PassScopeViewModel {
  if (scope.level === "module") {
    return { level: "module" };
  }

  if (scope.level === "function" || scope.level === "loop") {
    // Schema validation guarantees that scoped function IDs exist.
    const fn = functionsById.get(scope.functionId)!;

    return scope.level === "function"
      ? {
          level: "function",
          functionId: fn.id,
          functionName: fn.name,
        }
      : {
          level: "loop",
          functionId: fn.id,
          functionName: fn.name,
          loopId: scope.loopId,
        };
  }

  const fn =
    scope.functionId === undefined
      ? undefined
      : functionsById.get(scope.functionId);

  return {
    level: "unknown",
    function:
      fn === undefined
        ? notProvided()
        : available({ id: fn.id, name: fn.name }),
    loopId:
      scope.loopId === undefined ? notProvided() : available(scope.loopId),
  };
}

function adaptPass(
  pass: OptimisationPass,
  functionsById: ReadonlyMap<string, OptimisationResult["functions"][number]>,
  functionPosition: number | undefined,
): OptimisationPassViewModel {
  return {
    id: pass.id,
    name: pass.name,
    fullName:
      pass.fullName === undefined ? notProvided() : available(pass.fullName),
    type: pass.type,
    scope: adaptScope(pass.scope, functionsById),
    position: {
      global: pass.order,
      withinFunction:
        functionPosition === undefined
          ? notApplicable()
          : { status: "available", data: functionPosition },
    },
    changed: pass.changed,
    ir: {
      before: pass.ir.before,
      after: pass.ir.after,
      diff:
        pass.ir.diff === undefined
          ? notProvided()
          : available(pass.ir.diff.map((line) => ({ ...line }))),
    },
    metrics:
      pass.metrics === undefined
        ? notProvided()
        : available(adaptMetrics(pass.metrics)),
    cfg:
      pass.cfg === undefined
        ? notProvided()
        : available({
            before: adaptGraphSnapshot(pass.cfg.before),
            after: adaptGraphSnapshot(pass.cfg.after),
          }),
    transformation:
      pass.transformation === undefined
        ? notProvided()
        : available({
            category: pass.transformation.category,
            summary: pass.transformation.summary,
          }),
    dependencies:
      pass.dependencies === undefined
        ? notProvided()
        : available(
            pass.dependencies.map((dependency) => ({
              passId: dependency.passId,
              relation: dependency.relation,
            })),
          ),
  };
}

function adaptValidatedResult(
  payload: OptimisationResult,
): ParseOptimisationResult {
  const rawFunctionsById = new Map(
    payload.functions.map((fn) => [fn.id, fn] as const),
  );
  const stablePasses = payload.passes
    .map((pass, inputPosition) => ({ pass, inputPosition }))
    .sort(
      (left, right) =>
        left.pass.order - right.pass.order ||
        left.inputPosition - right.inputPosition,
    )
    .map(({ pass }) => pass);
  const functionPassCounts = new Map<string, number>();
  const passes = stablePasses.map((pass) => {
    const functionId = scopeFunctionId(pass.scope);
    let functionPosition: number | undefined;

    if (functionId !== undefined) {
      functionPosition = functionPassCounts.get(functionId) ?? 0;
      functionPassCounts.set(functionId, functionPosition + 1);
    }

    return adaptPass(pass, rawFunctionsById, functionPosition);
  });
  const passesByFunctionId = new Map<string, OptimisationPassViewModel[]>();

  for (const pass of passes) {
    const functionId =
      pass.scope.level === "function" || pass.scope.level === "loop"
        ? pass.scope.functionId
        : pass.scope.level === "unknown" &&
            pass.scope.function.status === "available"
          ? pass.scope.function.data.id
          : undefined;

    if (functionId !== undefined) {
      const functionPasses = passesByFunctionId.get(functionId) ?? [];
      functionPasses.push(pass);
      passesByFunctionId.set(functionId, functionPasses);
    }
  }

  const functions: OptimisationFunctionViewModel[] = payload.functions.map(
    (fn) => ({
      id: fn.id,
      name: fn.name,
      signature:
        fn.signature === undefined ? notProvided() : available(fn.signature),
      passes: passesByFunctionId.get(fn.id) ?? [],
    }),
  );
  const globalPasses = passes.filter(
    (pass) =>
      pass.scope.level === "module" ||
      (pass.scope.level === "unknown" &&
        pass.scope.function.status === "unavailable"),
  );
  const changedPassCount = passes.filter((pass) => pass.changed).length;

  return {
    ok: true,
    data: {
      schemaVersion: payload.schemaVersion,
      sourceFile: payload.meta.sourceFile,
      optimisationLevel: payload.meta.optimisationLevel,
      summary: {
        functionCount: functions.length,
        totalPassCount: passes.length,
        changedPassCount,
        unchangedPassCount: passes.length - changedPassCount,
        transformPassCount: passes.filter((pass) => pass.type === "transform")
          .length,
        analysisPassCount: passes.filter((pass) => pass.type === "analysis")
          .length,
        unknownPassCount: passes.filter((pass) => pass.type === "unknown")
          .length,
      },
      passes,
      globalPasses,
      functions,
      functionsById: createIndex(functions),
      passesById: createIndex(passes),
    },
  };
}

/** Validate an untrusted payload and return a complete UI model or one error. */
export function parseOptimisationResult(
  input: unknown,
): ParseOptimisationResult {
  const validation = optimisationResultSchema.safeParse(input);

  if (!validation.success) {
    return {
      ok: false,
      error: createProtocolError(validation.error.issues),
    };
  }

  return adaptValidatedResult(validation.data);
}
