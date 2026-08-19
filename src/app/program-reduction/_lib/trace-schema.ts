import { z } from "zod";

const nonNegativeInteger = z.number().int().nonnegative();

const sourceFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const sourceTokenSchema = z.object({
  index: nonNegativeInteger,
  text: z.string(),
});

export const sourceSnapshotSchema = z
  .object({
    files: z.array(sourceFileSchema),
    tokens: z.array(sourceTokenSchema),
    tokenCount: nonNegativeInteger,
  })
  .superRefine((snapshot, context) => {
    if (snapshot.tokens.length !== snapshot.tokenCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Token count ${snapshot.tokenCount} does not match ${snapshot.tokens.length} emitted tokens.`,
        path: ["tokenCount"],
      });
    }
    snapshot.tokens.forEach((token, index) => {
      if (token.index !== index) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Token index ${token.index} does not match its position ${index}.`,
          path: ["tokens", index, "index"],
        });
      }
    });
    const paths = new Set<string>();
    for (const file of snapshot.files) {
      if (paths.has(file.path)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate source path: ${file.path}`,
          path: ["files"],
        });
      }
      paths.add(file.path);
    }
  });

const editActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("DELETE"),
    description: z.string(),
    targetNodeId: z.number().int(),
  }),
  z.object({
    kind: z.literal("REPLACE"),
    description: z.string(),
    targetNodeId: z.number().int(),
    replacementNodeId: z.number().int(),
  }),
]);

const editMetadataSchema = z.object({
  kind: z.enum([
    "NODE_DELETION",
    "DESCENDANT_HOISTING",
    "ANY_NODE_REPLACEMENT",
    "LATRA_GENERAL",
  ]),
  description: z.string(),
  actions: z.array(editActionSchema),
});

const eventBase = {
  schemaVersion: z.literal(1),
  sequence: nonNegativeInteger,
  timestampMillis: nonNegativeInteger,
};

const runStartedSchema = z.object({
  ...eventBase,
  type: z.literal("run_started"),
  initialRevision: z.literal(0),
  snapshot: sourceSnapshotSchema,
});

const candidateTestedSchema = z.object({
  ...eventBase,
  type: z.literal("candidate_tested"),
  candidateId: z.string().min(1),
  baseRevision: nonNegativeInteger,
  result: z.enum(["pass", "fail"]),
  exitCode: z.number().int(),
  elapsedMillis: nonNegativeInteger,
  edit: editMetadataSchema,
  snapshot: sourceSnapshotSchema,
});

const candidateCacheHitSchema = z.object({
  ...eventBase,
  type: z.literal("candidate_cache_hit"),
  candidateId: z.string().min(1),
  baseRevision: nonNegativeInteger,
  result: z.literal("fail"),
  edit: editMetadataSchema,
  snapshot: sourceSnapshotSchema,
});

const candidateCancelledSchema = z.object({
  ...eventBase,
  type: z.literal("candidate_cancelled"),
  candidateId: z.string().min(1),
  baseRevision: nonNegativeInteger,
  cancelDurationMillis: nonNegativeInteger,
  edit: editMetadataSchema,
  snapshot: sourceSnapshotSchema,
});

const candidateCommittedSchema = z.object({
  ...eventBase,
  type: z.literal("candidate_committed"),
  candidateId: z.string().min(1),
  baseRevision: nonNegativeInteger,
  newRevision: nonNegativeInteger,
  beforeTokenCount: nonNegativeInteger,
  afterTokenCount: nonNegativeInteger,
  edit: editMetadataSchema,
  snapshot: sourceSnapshotSchema,
});

const errorSchema = z.object({
  ...eventBase,
  type: z.literal("error"),
  exceptionClass: z.string().min(1),
  message: z.string().nullable(),
  stackTrace: z.string(),
});

const runFinishedSchema = z.object({
  ...eventBase,
  type: z.literal("run_finished"),
  finalRevision: nonNegativeInteger,
  finalTokenCount: nonNegativeInteger,
  testExecutionCount: nonNegativeInteger,
  externalCacheHitCount: nonNegativeInteger,
});

export const traceEventSchema = z.discriminatedUnion("type", [
  runStartedSchema,
  candidateTestedSchema,
  candidateCacheHitSchema,
  candidateCancelledSchema,
  candidateCommittedSchema,
  errorSchema,
  runFinishedSchema,
]);

export type SourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export type EditMetadata = z.infer<typeof editMetadataSchema>;
export type TraceEvent = z.infer<typeof traceEventSchema>;
