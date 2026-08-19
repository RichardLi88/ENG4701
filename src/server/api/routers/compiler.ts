import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { env } from "~/env";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import realBackendPayload from "~/test-data/compiler-optimisation/real-backend.json";

import type { JsonValue } from "~/app/_helpers/json";
import { optimisationResultSchema } from "~/app/compiler-optimisation/_lib/optimisation-schema";

const LLVM_URL = env.LLVM_SERVICE_URL;
const compilationResponseSchema = z.object({ ir: z.string().min(1) });
const rawOptimisationResponseSchema = z.object({
  optimisedIr: z.string().min(1),
  beforeAfterLog: z.string().min(1),
});

// Shared fetch helper - calls the LLVM service and throws a TRPCError on failure
async function callLlvmService(
  endpoint: string,
  body: JsonValue,
  timeoutMs: number,
): Promise<JsonValue> {
  let res: Response;

  try {
    res = await fetch(`${LLVM_URL}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    console.error(`[LLVM ${endpoint}] request failed`, err);

    if (err instanceof Error && err.name === "TimeoutError") {
      throw new TRPCError({
        code: "TIMEOUT",
        message: "The LLVM service request timed out.",
      });
    }

    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "The LLVM service is currently unavailable.",
    });
  }

  const responseText = await res.text();
  const contentType = res.headers.get("content-type") ?? "";

  let parsedBody: JsonValue = responseText;
  if (contentType.includes("application/json") && responseText.length > 0) {
    try {
      parsedBody = JSON.parse(responseText) as JsonValue;
    } catch {
      parsedBody = responseText;
    }
  }

  if (!res.ok) {
    console.error(
      `[LLVM ${endpoint}] returned ${res.status} ${res.statusText}`,
      responseText.slice(0, 2_000),
    );

    throw new TRPCError({
      code: endpoint === "compile" ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      message:
        endpoint === "compile"
          ? "LLVM could not compile the submitted source."
          : "LLVM could not optimise the compiled program.",
    });
  }

  if (typeof parsedBody !== "object" || parsedBody === null) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "The LLVM service returned an invalid response.",
    });
  }

  return parsedBody;
}

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
      const payload = await callLlvmService(
        "compile",
        {
          source: input.source,
          ...(input.filename === undefined ? {} : { filename: input.filename }),
        },
        15_000,
      );

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
      const payload = await callLlvmService(
        "optimise",
        { ir: input.ir },
        35_000, // longer timeout - print-before/after-all produces a lot of output
      );

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
      const payload = await callLlvmService(
        "optimise-structured",
        { ir: input.ir, filename: input.filename },
        35_000,
      );

      return optimisationResultSchema.parse(payload);
    }),
});
