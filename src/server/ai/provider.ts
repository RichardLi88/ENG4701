import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

import { env } from "~/env";

import type { AiError } from "./errors";
import { selectModelConfig } from "./model-config";

/*
Acts as a gateway between the Application and AI provider SDKs. The Application should never import the SDKs directly,
and the SDKs should never be imported outside this file.

So it basically takes the project's AI configuration, create the correct AI model, and return it through the generic LanguageModel interface.

Example usage:

const google = createGoogleGenerativeAI({
  apiKey: "...",
});

Then do this =>

google("gemini-2.5-flash")
 */
export type ResolveModelResult =
  | Readonly<{ ok: true; model: LanguageModel }>
  | Readonly<{ ok: false; error: AiError }>;

let cachedModel: LanguageModel | null = null;

export function resolveModel(): ResolveModelResult {
  if (cachedModel !== null) {
    return { ok: true, model: cachedModel };
  }

  const config = selectModelConfig({
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    modelId: env.AI_MODEL_ID,
  });

  if (!config.ok) {
    return config;
  }

  const google = createGoogleGenerativeAI({ apiKey: config.data.apiKey });
  cachedModel = google(config.data.modelId);

  return { ok: true, model: cachedModel };
}
