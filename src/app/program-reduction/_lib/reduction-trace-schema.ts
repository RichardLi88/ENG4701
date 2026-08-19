import { z } from "zod";

import type { JsonValue } from "~/app/_helpers/json";

export const REDUCTION_TRACE_SCHEMA_VERSION = "2.0.0" as const;

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
const jsonObjectSchema = z.record(z.string(), jsonValueSchema);
const nullableString = z.string().nullable();
const nullableInteger = z.number().int().nullable();
const nonnegativeInteger = z.number().int().nonnegative();
const programRefSchema = z.string().regex(/^p_[0-9a-f]{64}$/);

export const reductionProgramFileSchema = z
  .object({
    path: z.string(),
    content: z.string(),
    lines: nonnegativeInteger,
    chars: nonnegativeInteger,
  })
  .strict();

export const reductionProgramSchema = z
  .object({
    files: z.array(reductionProgramFileSchema),
    tokenCount: nonnegativeInteger,
    tokens: z.array(
      z.object({ index: nonnegativeInteger, text: z.string() }).strict(),
    ),
  })
  .strict();

export const reductionStateSchema = z
  .object({
    stateId: z.string(),
    parentStateId: nullableString,
    createdByCandidateId: nullableString,
    programRef: programRefSchema,
    tokens: nonnegativeInteger,
    kind: z.enum(["INITIAL", "CANDIDATE", "SYSTEM"]),
    acceptedAtSeq: nullableInteger,
    reason: nullableString,
  })
  .strict();

export const reductionStepSchema = z
  .object({
    index: nonnegativeInteger,
    candidateId: nullableString,
    fromStateId: z.string(),
    toStateId: z.string(),
    acceptedAtSeq: nonnegativeInteger,
    tokensBefore: nonnegativeInteger,
    tokensAfter: nonnegativeInteger,
    programRef: programRefSchema,
    baseProgramRef: programRefSchema,
    patches: z.array(jsonObjectSchema),
    transformation: jsonObjectSchema.nullable(),
  })
  .strict();

const transformationSchema = z
  .object({
    kind: z.enum([
      "DELETE",
      "DELTA_DEBUG",
      "LIST_MINIMIZE",
      "TOKEN_SLICE",
      "LINE_SLICE",
      "HOIST",
      "REPLACE",
      "LATRA",
      "LLM",
      "OTHER",
    ]),
    editClass: z.string(),
    description: z.string(),
    reducer: nullableString,
    reducerPass: nonnegativeInteger,
    actions: z.array(jsonObjectSchema),
    targets: z.array(jsonObjectSchema),
  })
  .strict();

const candidatePatchSchema = z
  .object({
    path: z.string(),
    kind: z.enum(["ADD", "DELETE", "MODIFY"]),
    diff: z.string(),
  })
  .strict();

const candidateSchema = z
  .object({
    candidateId: z.string().regex(/^candidate:[0-9]+$/),
    editId: nonnegativeInteger,
    baseStateId: z.string(),
    resultStateId: nullableString,
    status: z.enum([
      "INTERESTING",
      "REJECTED",
      "INVALID",
      "CACHE_HIT",
      "CANCELLED",
      "NOT_TESTED",
    ]),
    becameBest: z.boolean(),
    observedAtSeq: nullableInteger,
    acceptedAtSeq: nullableInteger,
    observedAtMs: nullableInteger,
    acceptedAtMs: nullableInteger,
    tokensAfter: nonnegativeInteger,
    programRef: programRefSchema.nullable(),
    patches: z.array(candidatePatchSchema).nullable(),
    exitCode: nullableInteger,
    elapsedMillis: nullableInteger,
    cancelDurationMillis: nullableInteger,
    transformation: transformationSchema,
  })
  .strict()
  .superRefine((candidate, context) => {
    if ((candidate.programRef === null) === (candidate.patches === null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["programRef"],
        message: "Expected exactly one of programRef or patches",
      });
    }
  });

export const reductionTraceSchema = z
  .object({
    schemaVersion: z.literal(REDUCTION_TRACE_SCHEMA_VERSION),
    domain: z.literal("program-reduction"),
    meta: z
      .object({
        tool: z.literal("perses"),
        status: z.enum(["COMPLETED", "FAILED", "INCOMPLETE"]),
        sourceFile: nullableString.optional(),
        testScript: nullableString.optional(),
        language: nullableString.optional(),
        commandLine: nullableString.optional(),
        startedAtMillis: nullableInteger.optional(),
        finishedAtMillis: nullableInteger.optional(),
        reducerPlan: z.array(z.string()),
      })
      .strict(),
    summary: jsonObjectSchema,
    originalStateId: nullableString,
    finalStateId: nullableString,
    programs: z.record(z.string(), reductionProgramSchema),
    states: z.array(reductionStateSchema),
    steps: z.array(reductionStepSchema),
    candidates: z.array(candidateSchema),
    errors: z.array(jsonObjectSchema),
  })
  .strict()
  .superRefine((trace, context) => {
    const programIds = new Set(Object.keys(trace.programs));
    for (const programId of programIds) {
      if (!/^p_[0-9a-f]{64}$/.test(programId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["programs", programId],
          message: "Invalid program reference key",
        });
      }
    }

    const stateIds = new Set(trace.states.map((state) => state.stateId));
    trace.states.forEach((state, index) => {
      if (!programIds.has(state.programRef)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["states", index, "programRef"],
          message: "Referenced program does not exist",
        });
      }
    });

    trace.steps.forEach((step, index) => {
      if (step.index !== index) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "index"],
          message: `Expected continuous step index ${index}`,
        });
      }
      for (const field of ["programRef", "baseProgramRef"] as const) {
        if (!programIds.has(step[field])) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["steps", index, field],
            message: "Referenced program does not exist",
          });
        }
      }
      for (const field of ["fromStateId", "toStateId"] as const) {
        if (!stateIds.has(step[field])) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["steps", index, field],
            message: "Referenced state does not exist",
          });
        }
      }
    });

    for (const [field, stateId] of [
      ["originalStateId", trace.originalStateId],
      ["finalStateId", trace.finalStateId],
    ] as const) {
      if (stateId !== null && !stateIds.has(stateId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Referenced state does not exist",
        });
      }
    }
  });

export type ReductionTrace = z.infer<typeof reductionTraceSchema>;
export type ReductionStep = z.infer<typeof reductionStepSchema>;
export type ReductionProgramFile = z.infer<typeof reductionProgramFileSchema>;
