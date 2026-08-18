import type {
  DataAvailability,
  MetricKey,
  MetricValueViewModel,
  OptimisationPassViewModel,
} from "./optimisation-types";

export const PASS_METRIC_DEFINITIONS = [
  { key: "instructions", label: "Instructions" },
  { key: "memoryOperations", label: "Memory operations" },
  { key: "basicBlocks", label: "Basic blocks" },
  { key: "branches", label: "Branches" },
  { key: "cyclomaticComplexity", label: "Cyclomatic complexity" },
] as const satisfies ReadonlyArray<{ key: MetricKey; label: string }>;

const METRIC_NUMBER_FORMATTER = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 3,
});

export function formatMetricValue(value: number): string {
  return METRIC_NUMBER_FORMATTER.format(value);
}

export function formatMetricDelta(value: number): string {
  if (value === 0) {
    return "0";
  }

  return `${value > 0 ? "+" : ""}${formatMetricValue(value)}`;
}

export function getPassMetric(
  pass: OptimisationPassViewModel,
  key: MetricKey,
): DataAvailability<MetricValueViewModel> {
  return pass.metrics.status === "available"
    ? pass.metrics.data.values[key]
    : pass.metrics;
}

export function describePassScope(pass: OptimisationPassViewModel): string {
  switch (pass.scope.level) {
    case "module":
      return "Module";
    case "function":
      return `Function · ${pass.scope.functionName}`;
    case "loop":
      return `Loop · ${pass.scope.loopId} · ${pass.scope.functionName}`;
    case "unknown": {
      const functionName =
        pass.scope.function.status === "available"
          ? pass.scope.function.data.name
          : undefined;
      const loopId =
        pass.scope.loopId.status === "available"
          ? pass.scope.loopId.data
          : undefined;
      const details = [functionName, loopId].filter(Boolean).join(" · ");

      return details.length > 0 ? `Unknown · ${details}` : "Unknown";
    }
  }
}
