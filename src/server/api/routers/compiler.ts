import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { env } from "~/env";

const LLVM_URL = env.LLVM_SERVICE_URL;

export const compilerRouter = createTRPCRouter({

  // Converts a .c source string into LLVM IR using:
  // clang -O0 -Xclang -disable-O0-optnone -S -emit-llvm
  compile: publicProcedure
    .input(
      z.object({
        source: z.string().min(1).max(50_000),
      })
    )
    .mutation(async ({ input }) => {
      let res: Response;

      try {
        res = await fetch(`${LLVM_URL}/compile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: input.source }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Could not reach LLVM service: ${String(err)}`,
        });
      }

      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: body.error ?? "LLVM service returned an error",
        });
      }

      return res.json() as Promise<{ ir: string }>;
    }),
});