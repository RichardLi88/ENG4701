import type { EditMetadata, SourceSnapshot } from "./trace-schema";

export type DiagnosticSeverity = "warning" | "error";

export type TraceDiagnostic = Readonly<{
  severity: DiagnosticSeverity;
  lineNumber: number;
  message: string;
}>;

export type CandidateStatus =
  | "pass"
  | "fail"
  | "cache-rejected"
  | "cancelled"
  | "internal-commit";

export type SnapshotModel = Readonly<{
  files: ReadonlyArray<{ path: string; content: string }>;
  filesByPath: ReadonlyMap<string, string>;
  tokens: ReadonlyArray<{ index: number; text: string }>;
  tokenCount: number;
}>;

export type ReductionCandidate = Readonly<{
  candidateId: string;
  sequence: number;
  baseRevision: number;
  status: CandidateStatus;
  committed: boolean;
  newRevision?: number;
  elapsedMillis?: number;
  edit?: EditMetadata;
  snapshot: SnapshotModel;
  changedFiles: ReadonlyArray<string>;
}>;

export type RunStatistics = Readonly<{
  finalRevision: number;
  finalTokenCount: number;
  testExecutionCount: number;
  externalCacheHitCount: number;
}>;

export type ReductionRun = Readonly<{
  id: string;
  startSequence: number;
  candidates: ReadonlyArray<ReductionCandidate>;
  candidatesById: ReadonlyMap<string, ReductionCandidate>;
  revisions: ReadonlyMap<number, SnapshotModel>;
  revisionCandidates: ReadonlyMap<number, string>;
  statistics?: RunStatistics;
  diagnostics: ReadonlyArray<TraceDiagnostic>;
}>;

export type TraceParseResult =
  | Readonly<{
      ok: true;
      runs: ReadonlyArray<ReductionRun>;
      diagnostics: ReadonlyArray<TraceDiagnostic>;
      eventCount: number;
    }>
  | Readonly<{
      ok: false;
      message: string;
      diagnostics: ReadonlyArray<TraceDiagnostic>;
      eventCount: number;
    }>;

export type TraceProgress = Readonly<{
  parsedBytes: number;
  totalBytes: number;
  eventCount: number;
  diagnosticCount: number;
}>;

export function createSnapshotModel(snapshot: SourceSnapshot): SnapshotModel {
  return {
    files: snapshot.files,
    filesByPath: new Map(
      snapshot.files.map((file) => [file.path, file.content]),
    ),
    tokens: snapshot.tokens,
    tokenCount: snapshot.tokenCount,
  };
}
