import type { JsonValue } from "~/app/_helpers/json";

import {
  reductionTraceSchema,
  type ReductionProgramFile,
  type ReductionTrace,
} from "./reduction-trace-schema.ts";

export type ReductionFileKind = "ADD" | "DELETE" | "MODIFY" | "UNCHANGED";

export type ReductionFileComparison = Readonly<{
  path: string;
  kind: ReductionFileKind;
  before: string;
  after: string;
}>;

export type ReductionStepView = Readonly<{
  index: number;
  tokensBefore: number;
  tokensAfter: number;
  tokensRemoved: number;
  acceptedAtSeq: number;
  reducer: string | null;
  reducerPass: number | null;
  transformationKind: string | null;
  description: string | null;
  files: ReadonlyArray<ReductionFileComparison>;
  initialFilePath: string | null;
}>;

export type ReductionTraceViewModel = Readonly<{
  schemaVersion: string;
  status: ReductionTrace["meta"]["status"];
  sourceFile: string | null;
  language: string | null;
  originalTokens: number | null;
  finalTokens: number | null;
  tokensRemoved: number | null;
  reductionPercent: number | null;
  durationMillis: number | null;
  candidateCount: number;
  steps: ReadonlyArray<ReductionStepView>;
}>;

export type ParseReductionTraceResult =
  | Readonly<{ ok: true; data: ReductionTraceViewModel }>
  | Readonly<{ ok: false; message: string }>;

function stringField(
  object: Record<string, JsonValue> | null,
  field: string,
): string | null {
  const value = object?.[field];
  return typeof value === "string" ? value : null;
}

function numberField(
  object: Record<string, JsonValue> | null,
  field: string,
): number | null {
  const value = object?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function filesByPath(files: ReadonlyArray<ReductionProgramFile>) {
  return new Map(files.map((file) => [file.path, file]));
}

function patchKindByPath(patches: ReadonlyArray<Record<string, JsonValue>>) {
  const kinds = new Map<string, ReductionFileKind>();

  for (const patch of patches) {
    const path = patch.path;
    const kind = patch.kind;
    if (
      typeof path === "string" &&
      (kind === "ADD" || kind === "DELETE" || kind === "MODIFY")
    ) {
      kinds.set(path, kind);
    }
  }

  return kinds;
}

function buildFiles(
  beforeFiles: ReadonlyArray<ReductionProgramFile>,
  afterFiles: ReadonlyArray<ReductionProgramFile>,
  patches: ReadonlyArray<Record<string, JsonValue>>,
) {
  const beforeByPath = filesByPath(beforeFiles);
  const afterByPath = filesByPath(afterFiles);
  const patchKinds = patchKindByPath(patches);
  const paths = [
    ...new Set([
      ...patchKinds.keys(),
      ...beforeByPath.keys(),
      ...afterByPath.keys(),
    ]),
  ];

  const files = paths.map((path): ReductionFileComparison => {
    const before = beforeByPath.get(path)?.content ?? "";
    const after = afterByPath.get(path)?.content ?? "";
    const inferredKind: ReductionFileKind = !beforeByPath.has(path)
      ? "ADD"
      : !afterByPath.has(path)
        ? "DELETE"
        : before === after
          ? "UNCHANGED"
          : "MODIFY";

    return {
      path,
      kind: patchKinds.get(path) ?? inferredKind,
      before,
      after,
    };
  });

  return {
    files,
    initialFilePath:
      paths.find((path) => patchKinds.has(path)) ?? paths[0] ?? null,
  };
}

function stateTokens(trace: ReductionTrace, stateId: string | null) {
  if (stateId === null) {
    return null;
  }
  return (
    trace.states.find((state) => state.stateId === stateId)?.tokens ?? null
  );
}

function adaptTrace(trace: ReductionTrace): ReductionTraceViewModel {
  const originalTokens = stateTokens(trace, trace.originalStateId);
  const finalTokens = stateTokens(trace, trace.finalStateId);
  const tokensRemoved =
    originalTokens === null || finalTokens === null
      ? null
      : originalTokens - finalTokens;
  const startedAt = trace.meta.startedAtMillis ?? null;
  const finishedAt = trace.meta.finishedAtMillis ?? null;

  return {
    schemaVersion: trace.schemaVersion,
    status: trace.meta.status,
    sourceFile: trace.meta.sourceFile ?? null,
    language: trace.meta.language ?? null,
    originalTokens,
    finalTokens,
    tokensRemoved,
    reductionPercent:
      tokensRemoved === null || originalTokens === null || originalTokens === 0
        ? null
        : (tokensRemoved / originalTokens) * 100,
    durationMillis:
      startedAt === null || finishedAt === null
        ? null
        : Math.max(0, finishedAt - startedAt),
    candidateCount: trace.candidates.length,
    steps: trace.steps.map((step) => {
      const beforeProgram = trace.programs[step.baseProgramRef]!;
      const afterProgram = trace.programs[step.programRef]!;
      const { files, initialFilePath } = buildFiles(
        beforeProgram.files,
        afterProgram.files,
        step.patches,
      );

      return {
        index: step.index,
        tokensBefore: step.tokensBefore,
        tokensAfter: step.tokensAfter,
        tokensRemoved: step.tokensBefore - step.tokensAfter,
        acceptedAtSeq: step.acceptedAtSeq,
        reducer: stringField(step.transformation, "reducer"),
        reducerPass: numberField(step.transformation, "reducerPass"),
        transformationKind: stringField(step.transformation, "kind"),
        description: stringField(step.transformation, "description"),
        files,
        initialFilePath,
      };
    }),
  };
}

export function parseReductionTrace(
  input: JsonValue,
): ParseReductionTraceResult {
  const result = reductionTraceSchema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    const issuePath = issue?.path.join(".") ?? "";
    const path = issuePath.length > 0 ? issuePath : "trace";
    return {
      ok: false,
      message: `${path}: ${issue?.message ?? "Invalid reduction trace"}`,
    };
  }

  return { ok: true, data: adaptTrace(result.data) };
}
