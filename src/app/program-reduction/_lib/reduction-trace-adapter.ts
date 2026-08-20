import type { JsonValue } from "~/app/_helpers/json";

import {
  reductionTraceSchema,
  type ReductionCandidate,
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

export type ReductionCandidatePatchView = Readonly<{
  path: string;
  kind: "ADD" | "DELETE" | "MODIFY";
  diff: string;
}>;

export type ReductionCandidateView = Readonly<{
  candidateId: string;
  editId: number;
  baseStateId: string;
  status: ReductionCandidate["status"];
  observedAtSeq: number | null;
  tokensBefore: number;
  tokensAfter: number;
  tokensRemoved: number;
  exitCode: number | null;
  elapsedMillis: number | null;
  transformationKind: string;
  description: string;
  reducer: string | null;
  reducerPass: number;
  patches: ReadonlyArray<ReductionCandidatePatchView> | null;
  baseFiles: ReadonlyArray<ReductionProgramFile>;
  resultFiles: ReadonlyArray<ReductionProgramFile> | null;
}>;

export type CandidateComparisonResult =
  | Readonly<{
      ok: true;
      files: ReadonlyArray<ReductionFileComparison>;
      initialFilePath: string | null;
    }>
  | Readonly<{ ok: false; message: string }>;

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
  candidatesByState: Readonly<
    Record<string, ReadonlyArray<ReductionCandidateView>>
  >;
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

function splitLines(value: string): Array<string> {
  if (value.length === 0) {
    return [];
  }
  return value.replace(/\r\n?/g, "\n").split("\n");
}

function applyUnifiedPatch(base: string, patch: string): string | null {
  const baseLines = splitLines(base);
  const patchLines = patch.replace(/\r\n?/g, "\n").split("\n");
  const result: Array<string> = [];
  let baseIndex = 0;
  let patchIndex = 0;
  let foundHunk = false;

  while (patchIndex < patchLines.length) {
    const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(
      patchLines[patchIndex]!,
    );
    if (header === null) {
      patchIndex += 1;
      continue;
    }

    foundHunk = true;
    const oldStart = Number(header[1]);
    const expectedOldCount = Number(header[2] ?? "1");
    const expectedNewCount = Number(header[4] ?? "1");
    const hunkBaseIndex = oldStart === 0 ? 0 : oldStart - 1;
    if (hunkBaseIndex < baseIndex || hunkBaseIndex > baseLines.length) {
      return null;
    }
    result.push(...baseLines.slice(baseIndex, hunkBaseIndex));
    baseIndex = hunkBaseIndex;
    patchIndex += 1;

    let oldCount = 0;
    let newCount = 0;
    while (
      patchIndex < patchLines.length &&
      !patchLines[patchIndex]!.startsWith("@@ ")
    ) {
      const line = patchLines[patchIndex]!;
      const prefix = line[0];
      const content = line.slice(1);

      if (prefix === " ") {
        if (baseLines[baseIndex] !== content) {
          return null;
        }
        result.push(content);
        baseIndex += 1;
        oldCount += 1;
        newCount += 1;
      } else if (prefix === "-") {
        if (baseLines[baseIndex] !== content) {
          return null;
        }
        baseIndex += 1;
        oldCount += 1;
      } else if (prefix === "+") {
        result.push(content);
        newCount += 1;
      } else if (prefix !== "\\" && line.length > 0) {
        return null;
      }
      patchIndex += 1;
    }

    if (oldCount !== expectedOldCount || newCount !== expectedNewCount) {
      return null;
    }
  }

  if (!foundHunk) {
    return null;
  }
  result.push(...baseLines.slice(baseIndex));
  return result.join("\n");
}

export function buildCandidateComparison(
  candidate: ReductionCandidateView,
): CandidateComparisonResult {
  if (candidate.resultFiles !== null) {
    return {
      ok: true,
      ...buildFiles(candidate.baseFiles, candidate.resultFiles, []),
    };
  }
  if (candidate.patches === null) {
    return { ok: false, message: "Candidate source changes are unavailable." };
  }

  const baseByPath = filesByPath(candidate.baseFiles);
  const files: Array<ReductionFileComparison> = [];
  for (const patch of candidate.patches) {
    const before = baseByPath.get(patch.path)?.content ?? "";
    const after = applyUnifiedPatch(before, patch.diff);
    if (after === null) {
      return {
        ok: false,
        message: `Could not reconstruct the candidate change for ${patch.path}.`,
      };
    }
    files.push({ path: patch.path, kind: patch.kind, before, after });
  }

  return {
    ok: true,
    files,
    initialFilePath: files[0]?.path ?? null,
  };
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
  const statesById = new Map(
    trace.states.map((state) => [state.stateId, state] as const),
  );
  const candidatesByState: Record<string, Array<ReductionCandidateView>> = {};

  for (const candidate of trace.candidates) {
    if (candidate.becameBest) {
      continue;
    }
    const baseState = statesById.get(candidate.baseStateId);
    if (baseState === undefined) {
      continue;
    }
    const baseProgram = trace.programs[baseState.programRef];
    if (baseProgram === undefined) {
      continue;
    }
    const resultProgram =
      candidate.programRef === null
        ? null
        : (trace.programs[candidate.programRef] ?? null);
    const view: ReductionCandidateView = {
      candidateId: candidate.candidateId,
      editId: candidate.editId,
      baseStateId: candidate.baseStateId,
      status: candidate.status,
      observedAtSeq: candidate.observedAtSeq,
      tokensBefore: baseState.tokens,
      tokensAfter: candidate.tokensAfter,
      tokensRemoved: baseState.tokens - candidate.tokensAfter,
      exitCode: candidate.exitCode,
      elapsedMillis: candidate.elapsedMillis,
      transformationKind: candidate.transformation.kind,
      description: candidate.transformation.description,
      reducer: candidate.transformation.reducer,
      reducerPass: candidate.transformation.reducerPass,
      patches: candidate.patches,
      baseFiles: baseProgram.files,
      resultFiles: resultProgram?.files ?? null,
    };
    (candidatesByState[candidate.baseStateId] ??= []).push(view);
  }

  for (const candidates of Object.values(candidatesByState)) {
    candidates.sort(
      (left, right) =>
        (left.observedAtSeq ?? Number.MAX_SAFE_INTEGER) -
          (right.observedAtSeq ?? Number.MAX_SAFE_INTEGER) ||
        left.editId - right.editId,
    );
  }

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
    candidatesByState,
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
