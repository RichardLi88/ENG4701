import { TRPCError } from "@trpc/server";
import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { explainInputSchema } from "~/server/ai/schema";
import { generateExplanation } from "~/server/ai/client";
import { acquireRequest } from "~/server/ai/limit";
import { aiMessages } from "~/server/ai/content";

export const aiRouter = createTRPCRouter({
  explain: publicProcedure
    .input(explainInputSchema)
    .mutation(async ({ input }) => {
      const release = acquireRequest();
      if (!release)
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: aiMessages.busy,
        });
      try {
        return await generateExplanation(input, { apiKey: env.OPENAI_API_KEY });
      } finally {
        release();
      }
    }),
});
