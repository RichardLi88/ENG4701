import { generateObject, type LanguageModel } from "ai";

import type { EvidencePack } from "./schema/evidence.ts";
import { createAiError, type AiError } from "./errors.ts";
import { buildPrompt } from "./prompt.ts";
import {
  explanationOutputSchema,
  verifyMetricClaims,
  type ExplanationOutput,
  type MetricClaimCheck,
} from "./schema/explanation.ts";

export const GENERATION_TIMEOUT_MS = 60_000;

export type ExplanationUsage = Readonly<{
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
}>;

export type ExplanationResult = Readonly<{
  explanation: ExplanationOutput;
  claimChecks: MetricClaimCheck[];
  promptVersion: string;
  usage: ExplanationUsage;
}>;

export type GenerateExplanationResult =
  | Readonly<{ ok: true; data: ExplanationResult }>
  | Readonly<{ ok: false; error: AiError }>;

export async function generateExplanation(params: {
  model: LanguageModel;
  pack: EvidencePack;
}): Promise<GenerateExplanationResult> {
  const prompt = buildPrompt(params.pack);
  const startedAt = Date.now();

  try {
    const generated = await generateObject({
      model: params.model,
      schema: explanationOutputSchema,
      system: prompt.system,
      prompt: prompt.user,
      temperature: 0,
      abortSignal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
    });

    return {
      ok: true,
      data: {
        explanation: generated.object,
        claimChecks: verifyMetricClaims(params.pack, generated.object),
        promptVersion: prompt.version,
        usage: {
          promptTokens: generated.usage.inputTokens ?? 0,
          outputTokens: generated.usage.outputTokens ?? 0,
          latencyMs: Date.now() - startedAt,
        },
      },
    };
  } catch (cause) {
    return { ok: false, error: toAiError(cause) };
  }
}

/**
 * Provider errors can carry request headers, so only a mapped code and a
 * short message escape this boundary.
 */
function toAiError(cause: unknown): AiError {
  const name = cause instanceof Error ? cause.name : "";
  const message = cause instanceof Error ? cause.message : String(cause);

  if (name === "TimeoutError" || name === "AbortError") {
    return createAiError("timeout", "The model did not respond in time.");
  }
  if (/rate limit|quota|429/i.test(message)) {
    return createAiError("rate-limited", "The model rate limit was reached.");
  }
  if (/safety|blocked/i.test(message)) {
    return createAiError("content-blocked", "The provider blocked this input.");
  }
  if (/api key|unauthenticated|401|403/i.test(message)) {
    return createAiError(
      "missing-api-key",
      "The API key is missing or invalid.",
    );
  }
  if (
    name === "AI_TypeValidationError" ||
    name === "AI_NoObjectGeneratedError"
  ) {
    return createAiError(
      "invalid-output",
      "The model did not return a valid explanation.",
    );
  }

  return createAiError(
    "provider-unavailable",
    "The model could not be reached.",
  );
}
