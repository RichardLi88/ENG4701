import { z } from "zod";

import { env } from "~/env";
import { callLlvmService } from "~/server/api/llvm-service-client";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import realBackendPayload from "~/test-data/compiler-optimisation/real-backend.json";

import { optimisationResultSchema } from "~/app/compiler-optimisation/_lib/optimisation-schema";

const LLVM_URL = env.LLVM_SERVICE_URL;
const compilationResponseSchema = z.object({ ir: z.string().min(1) });
const rawOptimisationResponseSchema = z.object({
  optimisedIr: z.string().min(1),
  beforeAfterLog: z.string().min(1),
});

export const compilerRouter = createTRPCRouter({
  // Temporary Day 4 integration entry. The saved payload was captured from
  // the real LLVM 14 service, sanitised, and is validated at this boundary.
  getRealOptimisationPayload: publicProcedure.query(() =>
    optimisationResultSchema.parse(realBackendPayload),
  ),

  // compile ------------------------------------------------
  // Converts a .c or .cpp source file into unoptimised LLVM IR using: `clang -O0 -Xclang -disable-O0-optnone -S -emit-llvm filename.c -o filename.ll`
  // Returns: { ir: string }
  compile: publicProcedure
    .input(
      z.object({
        source: z.string().min(1).max(50_000),
        filename: z
          .string()
          .regex(/\.(c|cpp)$/i)
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const payload = await callLlvmService({
        serviceUrl: LLVM_URL,
        endpoint: "compile",
        body: {
          source: input.source,
          ...(input.filename === undefined ? {} : { filename: input.filename }),
        },
        timeoutMs: 15_000,
      });

      return compilationResponseSchema.parse(payload);
    }),

  // optimise ------------------------------------------------
  // Optimises LLVM IR using the O1 pass pipeline with full before/after logging: `opt -passes="default<O1>" -print-before-all -print-after-all filename.ll`
  // Returns: { optimisedIr: string, beforeAfterLog: string }
  optimise: publicProcedure
    .input(
      z.object({
        ir: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const payload = await callLlvmService({
        serviceUrl: LLVM_URL,
        endpoint: "optimise",
        body: { ir: input.ir },
        timeoutMs: 35_000,
      });

      return rawOptimisationResponseSchema.parse(payload);
    }),

  // Structured optimisation boundary used by the end-to-end UI workflow.
  // The LLVM service owns conversion from the raw pass log to this payload;
  // tRPC rejects an incompatible response before it reaches the client.
  optimiseStructured: publicProcedure
    .input(
      z.object({
        ir: z.string().min(1),
        filename: z.string().regex(/\.(c|cpp)$/i),
      }),
    )
    .output(optimisationResultSchema)
    .mutation(async ({ input }) => {
      const payload = await callLlvmService({
        serviceUrl: LLVM_URL,
        endpoint: "optimise-structured",
        body: { ir: input.ir, filename: input.filename },
        timeoutMs: 35_000,
      });

      return optimisationResultSchema.parse(payload);
    }),
});
