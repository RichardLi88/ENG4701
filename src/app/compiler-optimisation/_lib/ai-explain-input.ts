// Adapted from Steven Kaing's 004113e AI input projection; retain unavailable metrics.
import type { ExplainInput } from "~/server/ai/schema";
import type {
  OptimisationPassViewModel,
  OptimisationViewModel,
} from "./optimisation-types";

export function toExplainInput(
  pass: OptimisationPassViewModel,
  model: OptimisationViewModel,
): ExplainInput {
  return {
    domain: "compiler-optimisation",
    traceVersion: model.schemaVersion,
    toolVersion: model.toolVersion ?? null,
    sourceFile: model.sourceFile,
    subject: {
      id: pass.id,
      name:
        pass.fullName.status === "available" ? pass.fullName.data : pass.name,
      scope: JSON.stringify(pass.scope),
    },
    before: pass.ir.before,
    after: pass.ir.after,
    patch: null,
    metrics:
      pass.metrics.status === "available"
        ? Object.entries(pass.metrics.data.values).flatMap(([key, value]) =>
            value.status === "available" ? [{ key, ...value.data }] : [],
          )
        : [],
    llvm: {
      type: pass.type,
      changed: pass.changed,
      optimisationLevel: model.optimisationLevel,
      analysisActivity:
        pass.analysisActivity.status === "available"
          ? {
              computed: [...pass.analysisActivity.data.computed],
              preservation: pass.analysisActivity.data.preservation,
            }
          : null,
    },
    reduction: null,
  };
}
