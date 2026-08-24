import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { generateExplanation } from "~/server/ai/client";
import { buildEvidencePack } from "~/server/ai/evidence-builder";
import { explainInputSchema } from "~/server/ai/schema/evidence-input";
import type { AiError } from "~/server/ai/errors";
import { resolveModel } from "~/server/ai/provider";
import {
  explanationOutputSchema,
  metricClaimCheckSchema,
} from "~/server/ai/schema/explanation";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const explanationResultSchema = z.object({
  explanation: explanationOutputSchema,
  claimChecks: z.array(metricClaimCheckSchema),
  promptVersion: z.string(),
  usage: z.object({
    promptTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    latencyMs: z.number().int().nonnegative(),
  }),
});

export const aiRouter = createTRPCRouter({
  // Generates a structured, evidence-grounded explanation of one optimisation pass or reduction candidate.
  // EvidencePack is always built here so its shape and budget stay server-owned.
  explain: publicProcedure
    .input(explainInputSchema)
    .output(explanationResultSchema)
    .mutation(async ({ input }) => {
      const pack = buildEvidencePack(input);

      if (!pack.ok) {
        throw toTrpcError(pack.error, "BAD_REQUEST");
      }

      const model = resolveModel();

      if (!model.ok) {
        throw toTrpcError(model.error, "INTERNAL_SERVER_ERROR");
      }

      const result = await generateExplanation({
        model: model.model,
        pack: pack.data,
      });

      if (!result.ok) {
        throw toTrpcError(result.error, "INTERNAL_SERVER_ERROR");
      }

      return result.data;
    }),
});

function toTrpcError(
  error: AiError,
  fallback: "BAD_REQUEST" | "INTERNAL_SERVER_ERROR",
): TRPCError {
  const code =
    error.code === "timeout"
      ? "TIMEOUT"
      : error.code === "rate-limited"
        ? "TOO_MANY_REQUESTS"
        : error.code === "evidence-too-large"
          ? "PAYLOAD_TOO_LARGE"
          : fallback;

  return new TRPCError({ code, message: error.message, cause: error });
}
