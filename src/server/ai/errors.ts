/**
 * Typed failure codes for the AI layer, mirroring the explicit-error style of
 * OptimisationDataError rather than surfacing bare strings.
 */
export type AiErrorCode =
  | "missing-api-key"
  | "rate-limited"
  | "timeout"
  | "content-blocked"
  | "invalid-output"
  | "provider-unavailable"
  | "evidence-too-large";

export type AiError = Readonly<{
  category: "ai";
  code: AiErrorCode;
  message: string;
}>;

export function createAiError(code: AiErrorCode, message: string): AiError {
  return { category: "ai", code, message };
}

const AI_ERROR_CODES = new Set<string>([
  "missing-api-key",
  "rate-limited",
  "timeout",
  "content-blocked",
  "invalid-output",
  "provider-unavailable",
  "evidence-too-large",
] satisfies AiErrorCode[]);

/** Narrows a tRPC error cause so the client can key copy off the code if needed (probably not needed). */
export function isAiError(value: unknown): value is AiError {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AiError>;

  return (
    candidate.category === "ai" &&
    typeof candidate.message === "string" &&
    typeof candidate.code === "string" &&
    AI_ERROR_CODES.has(candidate.code)
  );
}
