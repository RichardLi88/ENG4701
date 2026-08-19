import { TRPCError } from "@trpc/server";

import type { JsonValue } from "~/app/_helpers/json";

type LlvmEndpoint = "compile" | "optimise" | "optimise-structured";

type LlvmServiceRequest = Readonly<{
  serviceUrl: string;
  endpoint: LlvmEndpoint;
  body: JsonValue;
  timeoutMs: number;
}>;

export async function callLlvmService({
  serviceUrl,
  endpoint,
  body,
  timeoutMs,
}: LlvmServiceRequest): Promise<JsonValue> {
  let response: Response;

  try {
    response = await fetch(`${serviceUrl}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.error(`[LLVM ${endpoint}] request failed`, error);

    if (error instanceof Error && error.name === "TimeoutError") {
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

  const responseText = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  let parsedBody: JsonValue = responseText;
  if (contentType.includes("application/json") && responseText.length > 0) {
    try {
      parsedBody = JSON.parse(responseText) as JsonValue;
    } catch {
      parsedBody = responseText;
    }
  }

  if (!response.ok) {
    console.error(
      `[LLVM ${endpoint}] returned ${response.status} ${response.statusText}`,
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
