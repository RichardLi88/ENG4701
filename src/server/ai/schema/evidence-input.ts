import { z } from "zod";

const MAX_CODE_CHARS = 20_000;

const codeText = z.string().max(MAX_CODE_CHARS);

const evidenceMetricSchema = z
  .object({
    key: z.string().min(1),
    before: z.number(),
    after: z.number(),
    delta: z.number(),
    estimated: z.boolean(),
  })
  .strict();

const evidenceTransformationSchema = z
  .object({ category: z.string(), summary: z.string() })
  .strict();

export const optimisationExplainInputSchema = z
  .object({
    domain: z.literal("compiler-optimisation"),
    pass: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        scope: z.string().min(1),
        changed: z.boolean(),
        transformation: evidenceTransformationSchema.nullable(),
        ir: z.object({ before: codeText, after: codeText }).strict(),
        metrics: z.array(evidenceMetricSchema),
      })
      .strict(),
  })
  .strict();

export const reductionExplainInputSchema = z
  .object({
    domain: z.literal("program-reduction"),
    candidate: z
      .object({
        candidateId: z.string().min(1),
        status: z.string().min(1),
        transformationKind: z.string().min(1),
        description: z.string(),
        reducer: z.string().nullable(),
        tokensBefore: z.number().int().nonnegative(),
        tokensAfter: z.number().int().nonnegative(),
        before: codeText,
        after: codeText.nullable(),
        patch: codeText.nullable(),
      })
      .strict(),
  })
  .strict();

export const explainInputSchema = z.discriminatedUnion("domain", [
  optimisationExplainInputSchema,
  reductionExplainInputSchema,
]);

export type OptimisationExplainInput = z.infer<
  typeof optimisationExplainInputSchema
>;
export type ReductionExplainInput = z.infer<typeof reductionExplainInputSchema>;
export type ExplainInput = z.infer<typeof explainInputSchema>;
