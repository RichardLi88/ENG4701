import { createAiError, type AiError } from "./errors.ts";

export type ModelConfig = Readonly<{ apiKey: string; modelId: string }>;

export type SelectModelConfigResult =
  | Readonly<{ ok: true; data: ModelConfig }>
  | Readonly<{ ok: false; error: AiError }>;

/**
 * Kept free of `env` so the decision is testable, and so a deployment missing
 * AI configuration still boots: only the explain call fails, with a code the
 * UI can explain, rather than the whole app refusing to start.
 */
export function selectModelConfig(
  source: Readonly<{ apiKey?: string; modelId?: string }>,
): SelectModelConfigResult {
  if (
    source.apiKey === undefined ||
    source.apiKey === "" ||
    source.modelId === undefined ||
    source.modelId === ""
  ) {
    return {
      ok: false,
      error: createAiError(
        "missing-api-key",
        "Set GOOGLE_GENERATIVE_AI_API_KEY and AI_MODEL_ID to enable explanations.",
      ),
    };
  }

  return { ok: true, data: { apiKey: source.apiKey, modelId: source.modelId } };
}
