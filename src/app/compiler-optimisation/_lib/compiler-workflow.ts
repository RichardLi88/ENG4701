export const MAX_SOURCE_LENGTH = 50_000;

export const compilerWorkflowStatuses = [
  "idle",
  "validating",
  "compiling",
  "optimising",
  "processing",
  "success",
  "failure",
] as const;

export type CompilerWorkflowStatus = (typeof compilerWorkflowStatuses)[number];

export type CompilerWorkflowFailureCode =
  | "unsupportedExtension"
  | "emptySource"
  | "sourceTooLarge"
  | "fileReadFailed"
  | "compileFailed"
  | "optimiseFailed"
  | "serviceUnavailable"
  | "requestTimedOut"
  | "schemaInvalid";

export type CompilerWorkflowRemoteStage = "compile" | "optimise";

export type CompilerWorkflowRemoteError = Readonly<{
  code?: string;
  hasSchemaIssues: boolean;
}>;

export type CompilerWorkflowState =
  | Readonly<{
      status: Exclude<CompilerWorkflowStatus, "failure">;
    }>
  | Readonly<{
      status: "failure";
      code: CompilerWorkflowFailureCode;
    }>;

export type CompilerInputValidation =
  | Readonly<{ ok: true; filename: string; source: string }>
  | Readonly<{
      ok: false;
      code: Extract<
        CompilerWorkflowFailureCode,
        "unsupportedExtension" | "emptySource" | "sourceTooLarge"
      >;
    }>;

export function validateCompilerInput(
  filename: string,
  source: string,
): CompilerInputValidation {
  const trimmedFilename = filename.trim();

  if (!/\.(c|cpp)$/i.test(trimmedFilename)) {
    return { ok: false, code: "unsupportedExtension" };
  }

  if (source.trim().length === 0) {
    return { ok: false, code: "emptySource" };
  }

  if (source.length > MAX_SOURCE_LENGTH) {
    return { ok: false, code: "sourceTooLarge" };
  }

  return { ok: true, filename: trimmedFilename, source };
}

export function isCompilerWorkflowPending(
  status: CompilerWorkflowStatus,
): boolean {
  return (
    status === "validating" ||
    status === "compiling" ||
    status === "optimising" ||
    status === "processing"
  );
}

export function classifyCompilerWorkflowFailure(
  stage: CompilerWorkflowRemoteStage,
  error: CompilerWorkflowRemoteError,
): CompilerWorkflowFailureCode {
  if (error.hasSchemaIssues) {
    return "schemaInvalid";
  }

  if (error.code === "TIMEOUT") {
    return "requestTimedOut";
  }

  if (error.code === "SERVICE_UNAVAILABLE") {
    return "serviceUnavailable";
  }

  return stage === "compile" ? "compileFailed" : "optimiseFailed";
}
