import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AI_MODEL,
  AI_REASONING,
  AI_RELEASE,
  explainInputSchema,
  explanationSchema,
  type ExplainInput,
  type ExplanationRecord,
} from "./schema.ts";
import { buildEvidencePack } from "./evidence-builder.ts";
import { selectKnowledge } from "./knowledge.ts";
import { buildPrompt } from "./prompt.ts";
import { aiMessages } from "./content.ts";

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const statementJson = {
  type: "object",
  properties: {
    text: { type: "string" },
    evidenceIds: { type: "array", items: { type: "string" } },
  },
  required: ["text", "evidenceIds"],
  additionalProperties: false,
};
export const outputJsonSchema = {
  type: "object",
  properties: {
    generalPurpose: { type: "array", items: statementJson },
    observedChanges: { type: "array", items: statementJson },
    conclusions: { type: "array", items: statementJson },
    limitations: { type: "array", items: statementJson },
    metricClaims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          metric: { type: "string" },
          claimedDelta: { type: "number" },
        },
        required: ["metric", "claimedDelta"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "generalPurpose",
    "observedChanges",
    "conclusions",
    "limitations",
    "metricClaims",
  ],
  additionalProperties: false,
};
const responseSchema = z.object({
  id: z.string(),
  model: z.string(),
  status: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional() }))
        .optional(),
    }),
  ),
  usage: z
    .object({ input_tokens: z.number(), output_tokens: z.number() })
    .nullish(),
});

export function prepareRecord(value: ExplainInput): ExplanationRecord {
  const input = explainInputSchema.parse(value);
  const evidence = buildEvidencePack(input);
  const knowledge = selectKnowledge(input);
  const prompt = buildPrompt(evidence, knowledge.items, input.domain);
  return {
    recordVersion: AI_RELEASE,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    status: knowledge.blocked ? "blocked" : "failed",
    message: knowledge.blocked,
    strategy: knowledge.blocked ? "unavailable" : "D",
    model: AI_MODEL,
    reasoning: AI_REASONING,
    input,
    evidence,
    knowledge: knowledge.items,
    evidenceHash: sha256(JSON.stringify(evidence)),
    knowledgeHash: sha256(JSON.stringify(knowledge.items)),
    promptHash: sha256(JSON.stringify(prompt)),
    prompt,
    request: null,
    rawResponse: null,
    responseId: null,
    returnedModel: null,
    output: null,
    checks: [],
    usage: { inputTokens: null, outputTokens: null, latencyMs: 0 },
  };
}

export async function generateExplanation(
  input: ExplainInput,
  options: { apiKey?: string; fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<ExplanationRecord> {
  const record = prepareRecord(input);
  if (record.status === "blocked") return record;
  if (!options.apiKey) return { ...record, message: aiMessages.missingKey };
  const request = {
    model: AI_MODEL,
    reasoning: { effort: AI_REASONING },
    store: false,
    tools: [],
    tool_choice: "none",
    max_output_tokens: 8000,
    input: [
      { role: "system", content: record.prompt.system },
      { role: "user", content: record.prompt.user },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "step_explanation",
        strict: true,
        schema: outputJsonSchema,
      },
    },
  };
  record.request = JSON.stringify(request);
  const start = Date.now();
  try {
    // One attempt only. A retry is an explicit user action with a new record ID.
    const response = await (options.fetcher ?? fetch)(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: record.request,
        redirect: "error",
        signal: AbortSignal.timeout(options.timeoutMs ?? 180_000),
      },
    );
    record.rawResponse = (await response.text()).replaceAll(
      options.apiKey,
      "[REDACTED]",
    );
    if (!response.ok) return { ...record, message: aiMessages.unavailable };
    const body = responseSchema.parse(JSON.parse(record.rawResponse));
    record.responseId = body.id;
    record.returnedModel = body.model;
    record.usage.inputTokens = body.usage?.input_tokens ?? null;
    record.usage.outputTokens = body.usage?.output_tokens ?? null;
    if (body.model !== AI_MODEL)
      return { ...record, message: aiMessages.model };
    const content = body.output
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? []);
    if (
      body.status !== "completed" ||
      content.some((item) => item.type === "refusal")
    )
      return { ...record, message: aiMessages.invalid };
    const output = explanationSchema.parse(
      JSON.parse(
        content
          .filter((item) => item.type === "output_text")
          .map((item) => item.text ?? "")
          .join("\n"),
      ),
    );
    const ids = new Set(
      [...record.evidence, ...record.knowledge].map((item) => item.id),
    );
    if (
      [
        ...output.generalPurpose,
        ...output.observedChanges,
        ...output.conclusions,
        ...output.limitations,
      ].some((item) => item.evidenceIds.some((id) => !ids.has(id)))
    )
      return { ...record, message: aiMessages.citations };
    record.output = output;
    record.checks = output.metricClaims.map((claim) => {
      const metric = input.metrics.find((item) => item.key === claim.metric);
      return {
        ...claim,
        actualDelta: metric?.delta ?? null,
        status: metric
          ? metric.delta === claim.claimedDelta
            ? "match"
            : "mismatch"
          : "unsupported",
      };
    });
    record.status = "completed";
    return record;
  } catch (error) {
    record.message =
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
        ? aiMessages.timeout
        : aiMessages.invalid;
    return record;
  } finally {
    record.usage.latencyMs = Date.now() - start;
  }
}
