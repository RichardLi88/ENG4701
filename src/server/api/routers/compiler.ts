import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { env } from "~/env";

const LLVM_URL = env.LLVM_SERVICE_URL;

// Shared fetch helper - calls the LLVM service and throws a TRPCError on failure
async function callLlvmService<T>(
  endpoint: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${LLVM_URL}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Could not reach LLVM service: ${String(err)}`,
    });
  }

  const responseText = await res.text();
  const contentType = res.headers.get("content-type") ?? "";

  let parsedBody: unknown = responseText;
  if (contentType.includes("application/json") && responseText.length > 0) {
    try {
      parsedBody = JSON.parse(responseText) as unknown;
    } catch {
      parsedBody = responseText;
    }
  }

  if (!res.ok) {
    const errorMessage =
      typeof parsedBody === "object" && parsedBody !== null
        ? ((parsedBody as { error?: string; message?: string }).error ??
          (parsedBody as { error?: string; message?: string }).message)
        : undefined;

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        errorMessage ??
        `LLVM service returned ${res.status} ${res.statusText}${
          responseText ? `: ${responseText.slice(0, 500)}` : ""
        }`,
    });
  }

  if (typeof parsedBody !== "object" || parsedBody === null) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        `LLVM service returned invalid JSON for ${endpoint}${
          responseText ? `: ${responseText.slice(0, 500)}` : ""
        }`,
    });
  }

  return parsedBody as T;
}

export const compilerRouter = createTRPCRouter({
  // compile ------------------------------------------------
  // Converts a .c or .cpp source file into unoptimised LLVM IR using: `clang -O0 -Xclang -disable-O0-optnone -S -emit-llvm filename.c -o filename.ll`
  // Returns: { ir: string }
  compile: publicProcedure
    .input(
      z.object({
        source:   z.string().min(1).max(50_000),
        filename: z.string().regex(/\.(c|cpp)$/).optional(),
      })
    )
    .mutation(async ({ input }) => {
      return callLlvmService<{ ir: string }>(
        "compile",
        { source: input.source, filename: input.filename },
        15_000,
      );
    }),

  // optimise ------------------------------------------------
  // Optimises LLVM IR using the O1 pass pipeline with full before/after logging: `opt -passes="default<O1>" -print-before-all -print-after-all filename.ll`
  // Returns: { optimisedIr: string, beforeAfterLog: string }
  optimise: publicProcedure
    .input(
      z.object({
        ir: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      return callLlvmService<{ optimisedIr: string; beforeAfterLog: string }>(
        "optimise",
        { ir: input.ir },
        35_000, // longer timeout - print-before/after-all produces a lot of output
      );
    }),
});