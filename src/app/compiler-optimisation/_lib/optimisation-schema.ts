import { z } from "zod";

export const CURRENT_OPTIMISATION_SCHEMA_VERSION = "1.1.0" as const;
export const SUPPORTED_OPTIMISATION_SCHEMA_MAJOR = 1 as const;

const MAX_ID_LENGTH = 1_024;
const MAX_LABEL_LENGTH = 1_024;
const MAX_IR_LENGTH = 10_000_000;
const MAX_FUNCTIONS = 10_000;
const MAX_PASSES = 100_000;
const MAX_GRAPH_ITEMS = 100_000;
const MAX_DIFF_LINES = 1_000_000;

const nonBlankString = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.trim().length > 0, "Expected a non-blank string");
const nonEmptyString = nonBlankString(MAX_LABEL_LENGTH);
const opaqueId = z.string().min(1).max(MAX_ID_LENGTH);
const finiteMetricValue = z.number().finite();

export const optimisationSchemaVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Expected a MAJOR.MINOR.PATCH version")
  .refine(
    (version) =>
      Number(version.split(".", 1)[0]) === SUPPORTED_OPTIMISATION_SCHEMA_MAJOR,
    {
      message: `Unsupported schema major version; expected ${SUPPORTED_OPTIMISATION_SCHEMA_MAJOR}.x.x`,
    },
  );

export const optimisationMetadataSchema = z.object({
  sourceFile: nonEmptyString,
  optimisationLevel: nonEmptyString,
  totalPasses: z.number().int().nonnegative().max(MAX_PASSES),
});

export const optimisedFunctionSchema = z.object({
  id: opaqueId,
  name: nonEmptyString,
  signature: nonBlankString(10_000).optional(),
});

export const optimisationPassTypeSchema = z.enum([
  "transform",
  "analysis",
  "unknown",
]);

export const optimisationPassScopeSchema = z.discriminatedUnion("level", [
  z.object({ level: z.literal("module") }),
  z.object({ level: z.literal("function"), functionId: opaqueId }),
  z.object({
    level: z.literal("loop"),
    functionId: opaqueId,
    loopId: opaqueId,
  }),
  z.object({
    level: z.literal("unknown"),
    functionId: opaqueId.optional(),
    loopId: opaqueId.optional(),
  }),
]);

export const irDiffLineKindSchema = z.enum(["unchanged", "added", "removed"]);

export const irDiffLineSchema = z
  .object({
    kind: irDiffLineKindSchema,
    content: z.string().max(MAX_IR_LENGTH),
    beforeLineNumber: z.number().int().positive().nullable(),
    afterLineNumber: z.number().int().positive().nullable(),
    endsWithNewline: z.boolean(),
  })
  .superRefine((line, ctx) => {
    if (line.kind === "added" && line.beforeLineNumber !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["beforeLineNumber"],
        message: "Added lines must not have a before line number",
      });
    }
    if (line.kind !== "added" && line.beforeLineNumber === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["beforeLineNumber"],
        message: "Expected a before line number",
      });
    }
    if (line.kind === "removed" && line.afterLineNumber !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["afterLineNumber"],
        message: "Removed lines must not have an after line number",
      });
    }
    if (line.kind !== "removed" && line.afterLineNumber === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["afterLineNumber"],
        message: "Expected an after line number",
      });
    }
  });

function reconstructIrFromDiff(
  lines: ReadonlyArray<z.infer<typeof irDiffLineSchema>>,
  side: "before" | "after",
): string {
  return lines
    .filter((line) =>
      side === "before" ? line.kind !== "added" : line.kind !== "removed",
    )
    .map((line) => `${line.content}${line.endsWithNewline ? "\n" : ""}`)
    .join("");
}

function normaliseIrLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export const passIrSchema = z
  .object({
    before: z.string().min(1).max(MAX_IR_LENGTH),
    after: z.string().min(1).max(MAX_IR_LENGTH),
    diff: z.array(irDiffLineSchema).min(1).max(MAX_DIFF_LINES).optional(),
  })
  .superRefine((ir, ctx) => {
    let expectedBeforeLineNumber = 1;
    let expectedAfterLineNumber = 1;

    ir.diff?.forEach((line, index) => {
      if (
        line.kind !== "added" &&
        line.beforeLineNumber !== expectedBeforeLineNumber
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["diff", index, "beforeLineNumber"],
          message: `Expected before line ${expectedBeforeLineNumber}`,
        });
      }
      if (
        line.kind !== "removed" &&
        line.afterLineNumber !== expectedAfterLineNumber
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["diff", index, "afterLineNumber"],
          message: `Expected after line ${expectedAfterLineNumber}`,
        });
      }
      if (line.kind !== "added") expectedBeforeLineNumber += 1;
      if (line.kind !== "removed") expectedAfterLineNumber += 1;
    });

    if (
      ir.diff !== undefined &&
      (reconstructIrFromDiff(ir.diff, "before") !==
        normaliseIrLineEndings(ir.before) ||
        reconstructIrFromDiff(ir.diff, "after") !==
          normaliseIrLineEndings(ir.after))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diff"],
        message: "Structured Diff does not reconstruct the IR snapshots",
      });
    }
  });

export const beforeAfterMetricSchema = z.object({
  before: finiteMetricValue,
  after: finiteMetricValue,
  delta: finiteMetricValue,
  estimated: z.boolean().optional(),
});

export const passMetricsSchema = z
  .object({
    instructions: beforeAfterMetricSchema.optional(),
    memoryOperations: beforeAfterMetricSchema.optional(),
    basicBlocks: beforeAfterMetricSchema.optional(),
    branches: beforeAfterMetricSchema.optional(),
    cyclomaticComplexity: beforeAfterMetricSchema.optional(),
  })
  .refine((metrics) => Object.keys(metrics).length > 0, {
    message: "Metrics must contain at least one computed metric",
  });

export const controlFlowGraphNodeSchema = z.object({
  id: opaqueId,
  label: nonEmptyString,
});

export const controlFlowGraphEdgeSchema = z.object({
  source: opaqueId,
  target: opaqueId,
  label: nonEmptyString.optional(),
});

export const controlFlowGraphSnapshotSchema = z.object({
  nodes: z.array(controlFlowGraphNodeSchema).max(MAX_GRAPH_ITEMS),
  edges: z.array(controlFlowGraphEdgeSchema).max(MAX_GRAPH_ITEMS),
});

export const passControlFlowGraphSchema = z.object({
  before: controlFlowGraphSnapshotSchema,
  after: controlFlowGraphSnapshotSchema,
});

export const passTransformationSchema = z.object({
  category: nonEmptyString,
  summary: nonBlankString(10_000),
});

export const passAnalysisActivitySchema = z.object({
  computed: z.array(nonEmptyString).max(1_000),
  preservation: z.enum(["all", "not-all"]),
});

export const passDependencyRelationSchema = z.enum([
  "requires",
  "enables",
  "related",
  "unknown",
]);

export const passDependencySchema = z.object({
  passId: opaqueId,
  relation: passDependencyRelationSchema,
});

export const optimisationPassSchema = z
  .object({
    id: opaqueId,
    order: z
      .number()
      .int()
      .nonnegative()
      .max(MAX_PASSES - 1),
    name: nonEmptyString,
    fullName: nonBlankString(10_000).optional(),
    type: optimisationPassTypeSchema,
    scope: optimisationPassScopeSchema,
    changed: z.boolean(),
    ir: passIrSchema,
    metrics: passMetricsSchema.optional(),
    cfg: passControlFlowGraphSchema.optional(),
    transformation: passTransformationSchema.optional(),
    analysisActivity: passAnalysisActivitySchema.optional(),
    dependencies: z.array(passDependencySchema).max(MAX_PASSES).optional(),
  })
  .superRefine((pass, ctx) => {
    const irChanged = pass.ir.before !== pass.ir.after;

    if (pass.changed !== irChanged) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["changed"],
        message: pass.changed
          ? "changed is true but before and after IR are identical"
          : "changed is false but before and after IR differ",
      });
    }

    if (pass.type === "analysis" && pass.changed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["changed"],
        message: "Analysis passes must have changed set to false",
      });
    }
  });

export const optimisationResultSchema = z
  .object({
    schemaVersion: optimisationSchemaVersionSchema,
    meta: optimisationMetadataSchema,
    functions: z.array(optimisedFunctionSchema).max(MAX_FUNCTIONS),
    passes: z.array(optimisationPassSchema).max(MAX_PASSES),
  })
  .superRefine((result, ctx) => {
    if (result.meta.totalPasses !== result.passes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meta", "totalPasses"],
        message: `Expected ${result.passes.length} to match passes.length`,
      });
    }

    const functionIds = new Set<string>();
    result.functions.forEach((fn, index) => {
      if (functionIds.has(fn.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["functions", index, "id"],
          message: `Duplicate function ID: ${fn.id}`,
        });
      }
      functionIds.add(fn.id);
    });

    const passIds = new Set<string>();
    const orders = new Set<number>();
    result.passes.forEach((pass, index) => {
      if (passIds.has(pass.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passes", index, "id"],
          message: `Duplicate pass ID: ${pass.id}`,
        });
      }
      passIds.add(pass.id);

      if (orders.has(pass.order)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passes", index, "order"],
          message: `Duplicate pass order: ${pass.order}`,
        });
      }
      orders.add(pass.order);

      const { scope } = pass;
      if (
        "functionId" in scope &&
        scope.functionId !== undefined &&
        !functionIds.has(scope.functionId)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passes", index, "scope", "functionId"],
          message: `Unknown function ID: ${scope.functionId}`,
        });
      }
    });

    for (
      let expectedOrder = 0;
      expectedOrder < result.passes.length;
      expectedOrder += 1
    ) {
      if (!orders.has(expectedOrder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["passes"],
          message: `Pass orders must be continuous from 0; missing order ${expectedOrder}`,
        });
      }
    }

    result.passes.forEach((pass, passIndex) => {
      pass.dependencies?.forEach((dependency, dependencyIndex) => {
        if (!passIds.has(dependency.passId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              "passes",
              passIndex,
              "dependencies",
              dependencyIndex,
              "passId",
            ],
            message: `Unknown pass ID: ${dependency.passId}`,
          });
        }
      });
    });

    const [, minorVersion = "0"] = result.schemaVersion.split(".");
    if (Number(minorVersion) >= 1) {
      result.passes.forEach((pass, passIndex) => {
        if (pass.changed && pass.ir.diff === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["passes", passIndex, "ir", "diff"],
            message:
              "Schema 1.1 or later requires a structured Diff for changed passes",
          });
        }
      });
    }
  });

/** Validate untrusted service data at the external payload boundary. */
export function parseOptimisationResult(input: unknown) {
  return optimisationResultSchema.parse(input);
}
