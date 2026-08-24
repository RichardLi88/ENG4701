import type { OptimisationExplainInput } from "~/server/ai/schema/evidence-input";
import type { EvidenceMetric } from "~/server/ai/schema/evidence";

import type {
  OptimisationPassViewModel,
  PassScopeViewModel,
} from "./optimisation-types";

/**
 * Projects a Pass view model into the narrow payload the AI layer accepts.
 * Metrics the trace did not compute are dropped here; they must never reach
 * the model as a fabricated zero.
 */
export function toExplainInput(
  pass: OptimisationPassViewModel,
): OptimisationExplainInput {
  return {
    domain: "compiler-optimisation",
    pass: {
      id: pass.id,
      name: pass.name,
      scope: describeScope(pass.scope),
      changed: pass.changed,
      transformation:
        pass.transformation.status === "available"
          ? {
              category: pass.transformation.data.category,
              summary: pass.transformation.data.summary,
            }
          : null,
      ir: { before: pass.ir.before, after: pass.ir.after },
      metrics: collectMetrics(pass),
    },
  };
}

function collectMetrics(pass: OptimisationPassViewModel): EvidenceMetric[] {
  if (pass.metrics.status !== "available") {
    return [];
  }

  const metrics: EvidenceMetric[] = [];

  for (const [key, value] of Object.entries(pass.metrics.data.values)) {
    if (value?.status !== "available") {
      continue;
    }

    metrics.push({
      key,
      before: value.data.before,
      after: value.data.after,
      delta: value.data.delta,
      estimated: value.data.estimated,
    });
  }

  return metrics;
}

function describeScope(scope: PassScopeViewModel): string {
  switch (scope.level) {
    case "module":
      return "module";
    case "function":
      return `function ${scope.functionName}`;
    case "loop":
      return `loop ${scope.loopId} in function ${scope.functionName}`;
    default:
      return scope.function.status === "available"
        ? `function ${scope.function.data.name}`
        : "unknown scope";
  }
}
