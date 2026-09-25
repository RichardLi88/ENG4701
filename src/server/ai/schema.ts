import { z } from "zod";

export const AI_RELEASE = "research-explanations-v2";
export const AI_MODEL = "gpt-6-luna";
export const AI_REASONING = "medium";
export const metricSchema = z
  .object({
    key: z.string().min(1).max(100),
    before: z.number().finite(),
    after: z.number().finite(),
    delta: z.number().finite(),
    estimated: z.boolean(),
  })
  .strict()
  .refine(
    (m) => Math.abs(m.after - m.before - m.delta) < 1e-8,
    "Inconsistent metric delta",
  );
const shortText = z.string().max(2000);
export const explainInputSchema = z
  .object({
    domain: z.enum(["compiler-optimisation", "program-reduction"]),
    traceVersion: shortText,
    toolVersion: shortText.nullable(),
    sourceFile: shortText.nullable(),
    subject: z
      .object({ id: shortText, name: shortText, scope: shortText })
      .strict(),
    before: z.string().max(100_000),
    after: z.string().max(100_000).nullable(),
    patch: z.string().max(100_000).nullable(),
    metrics: z.array(metricSchema).max(20),
    llvm: z
      .object({
        type: z.enum(["transform", "analysis", "unknown"]),
        changed: z.boolean(),
        optimisationLevel: shortText,
        analysisActivity: z
          .object({
            computed: z.array(shortText).max(200),
            preservation: z.enum(["all", "not-all"]),
          })
          .strict()
          .nullable(),
      })
      .strict()
      .nullable(),
    reduction: z
      .object({
        status: z.enum([
          "INTERESTING",
          "REJECTED",
          "INVALID",
          "CACHE_HIT",
          "CANCELLED",
          "NOT_TESTED",
          "SYSTEM",
          "UNRECORDED",
        ]),
        accepted: z.boolean(),
        exitCode: z.number().int().nullable(),
        testScript: shortText.nullable(),
        testDescription: z.string().max(5000).nullable(),
        description: shortText,
        reducer: shortText.nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((input, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (JSON.stringify(input).length > 160_000)
      issue("Evidence exceeds the 160,000 character budget");
    if (input.domain === "compiler-optimisation") {
      if (!input.llvm || input.reduction || input.after === null)
        issue("Missing LLVM evidence");
      else {
        if (input.llvm.changed !== (input.before !== input.after))
          issue("Changed flag disagrees with IR");
        if (input.llvm.type === "analysis" && input.llvm.changed)
          issue("Analysis cannot change IR");
      }
    } else {
      if (!input.reduction || input.llvm) issue("Missing reduction evidence");
      if (input.after === null && input.patch === null)
        issue("Missing candidate code or patch");
      if (
        input.reduction?.accepted &&
        (input.after === null ||
          !["INTERESTING", "SYSTEM", "UNRECORDED"].includes(
            input.reduction.status,
          ))
      )
        issue("Inconsistent accepted reduction");
    }
    if (new Set(input.metrics.map((m) => m.key)).size !== input.metrics.length)
      issue("Duplicate metric keys");
  });
export type ExplainInput = z.infer<typeof explainInputSchema>;

const statement = z
  .object({
    text: z.string().min(1).max(4000),
    evidenceIds: z.array(z.string().max(80)).min(1).max(12),
  })
  .strict();
export const explanationSchema = z
  .object({
    generalPurpose: z.array(statement).min(1).max(5),
    observedChanges: z.array(statement).min(1).max(8),
    conclusions: z.array(statement).min(1).max(5),
    limitations: z.array(statement).min(1).max(5),
    metricClaims: z
      .array(
        z
          .object({ metric: z.string(), claimedDelta: z.number().finite() })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type Explanation = z.infer<typeof explanationSchema>;
export type EvidenceItem = { id: string; label: string; text: string };
export type Knowledge = {
  id: string;
  title: string;
  source: string;
  sourceVersion: string;
  scope: string;
  text: string;
};
export type ClaimCheck = {
  metric: string;
  claimedDelta: number;
  actualDelta: number | null;
  status: "match" | "mismatch" | "unsupported";
};
export type ExplanationRecord = {
  recordVersion: string;
  id: string;
  createdAt: string;
  status: "completed" | "blocked" | "failed";
  message: string | null;
  strategy: "D" | "unavailable";
  model: string;
  reasoning: string;
  input: ExplainInput;
  evidence: EvidenceItem[];
  knowledge: Knowledge[];
  evidenceHash: string;
  knowledgeHash: string;
  promptHash: string;
  prompt: { system: string; user: string };
  request: string | null;
  rawResponse: string | null;
  responseId: string | null;
  returnedModel: string | null;
  output: Explanation | null;
  checks: ClaimCheck[];
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
  };
};
