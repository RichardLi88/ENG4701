import { traceEventSchema, type TraceEvent } from "./trace-schema";
import {
  createSnapshotModel,
  type ReductionCandidate,
  type ReductionRun,
  type SnapshotModel,
  type TraceDiagnostic,
  type TraceParseResult,
  type TraceProgress,
} from "./trace-model";

type ParseOptions = Readonly<{
  totalBytes: number;
  signal?: AbortSignal;
  batchSize?: number;
  onProgress?: (progress: TraceProgress) => void;
}>;

type PendingRecord = Readonly<{ lineNumber: number; value: TraceEvent }>;

type MutableRun = {
  id: string;
  startSequence: number;
  candidates: Array<ReductionCandidate>;
  candidatesById: Map<string, ReductionCandidate>;
  revisions: Map<number, SnapshotModel>;
  revisionCandidates: Map<number, string>;
  diagnostics: Array<TraceDiagnostic>;
  statistics?: ReductionRun["statistics"];
  sequences: Set<number>;
  records: Array<PendingRecord>;
};

const SUPPORTED_TYPES = new Set([
  "run_started",
  "candidate_tested",
  "candidate_cache_hit",
  "candidate_cancelled",
  "candidate_committed",
  "error",
  "run_finished",
]);

function diagnostic(
  severity: TraceDiagnostic["severity"],
  lineNumber: number,
  message: string,
): TraceDiagnostic {
  return { severity, lineNumber, message };
}

function affectedPaths(
  baseline: SnapshotModel | undefined,
  candidate: SnapshotModel,
) {
  if (baseline === undefined) return [];
  const paths = new Set([
    ...baseline.filesByPath.keys(),
    ...candidate.filesByPath.keys(),
  ]);
  return [...paths].filter(
    (path) =>
      baseline.filesByPath.get(path) !== candidate.filesByPath.get(path),
  );
}

function snapshotsEqual(left: SnapshotModel, right: SnapshotModel) {
  return (
    left.tokenCount === right.tokenCount &&
    left.files.length === right.files.length &&
    left.tokens.length === right.tokens.length &&
    left.files.every(
      (file, index) =>
        file.path === right.files[index]?.path &&
        file.content === right.files[index]?.content,
    ) &&
    left.tokens.every(
      (token, index) =>
        token.index === right.tokens[index]?.index &&
        token.text === right.tokens[index]?.text,
    )
  );
}

function replaceCandidate(run: MutableRun, candidate: ReductionCandidate) {
  const index = run.candidates.findIndex(
    (entry) => entry.candidateId === candidate.candidateId,
  );
  if (index >= 0) run.candidates[index] = candidate;
  else run.candidates.push(candidate);
  run.candidatesById.set(candidate.candidateId, candidate);
}

function addCandidateEvent(
  run: MutableRun,
  event: Extract<
    TraceEvent,
    { type: "candidate_tested" | "candidate_cache_hit" | "candidate_cancelled" }
  >,
  lineNumber: number,
) {
  if (run.candidatesById.has(event.candidateId)) {
    run.diagnostics.push(
      diagnostic(
        "error",
        lineNumber,
        `Duplicate candidate ID: ${event.candidateId}`,
      ),
    );
    return;
  }
  const snapshot = createSnapshotModel(event.snapshot);
  const baseline = run.revisions.get(event.baseRevision);
  if (baseline === undefined) {
    run.diagnostics.push(
      diagnostic(
        "error",
        lineNumber,
        `Candidate ${event.candidateId} references missing revision ${event.baseRevision}.`,
      ),
    );
  }
  const status =
    event.type === "candidate_tested"
      ? event.result
      : event.type === "candidate_cache_hit"
        ? "cache-rejected"
        : "cancelled";
  const elapsedMillis =
    event.type === "candidate_tested"
      ? event.elapsedMillis
      : event.type === "candidate_cancelled"
        ? event.cancelDurationMillis
        : undefined;
  replaceCandidate(run, {
    candidateId: event.candidateId,
    sequence: event.sequence,
    baseRevision: event.baseRevision,
    status,
    committed: false,
    elapsedMillis,
    edit: event.edit,
    snapshot,
    changedFiles: affectedPaths(baseline, snapshot),
  });
}

function applyRecord(run: MutableRun, record: PendingRecord) {
  const { value: event, lineNumber } = record;
  if (run.sequences.has(event.sequence)) {
    run.diagnostics.push(
      diagnostic("error", lineNumber, `Duplicate sequence: ${event.sequence}`),
    );
    return;
  }
  run.sequences.add(event.sequence);

  if (
    event.type === "candidate_tested" ||
    event.type === "candidate_cache_hit" ||
    event.type === "candidate_cancelled"
  ) {
    addCandidateEvent(run, event, lineNumber);
    return;
  }

  if (event.type === "candidate_committed") {
    const snapshot = createSnapshotModel(event.snapshot);
    const existing = run.candidatesById.get(event.candidateId);
    const baseline = run.revisions.get(event.baseRevision);
    if (baseline === undefined) {
      run.diagnostics.push(
        diagnostic(
          "error",
          lineNumber,
          `Commit ${event.candidateId} references missing revision ${event.baseRevision}.`,
        ),
      );
    } else if (baseline.tokenCount !== event.beforeTokenCount) {
      run.diagnostics.push(
        diagnostic(
          "error",
          lineNumber,
          `Commit ${event.candidateId} reports ${event.beforeTokenCount} baseline tokens but revision ${event.baseRevision} contains ${baseline.tokenCount}.`,
        ),
      );
    }
    if (snapshot.tokenCount !== event.afterTokenCount) {
      run.diagnostics.push(
        diagnostic(
          "error",
          lineNumber,
          `Commit ${event.candidateId} reports ${event.afterTokenCount} tokens but its snapshot contains ${snapshot.tokenCount}.`,
        ),
      );
    }
    if (run.revisions.has(event.newRevision)) {
      run.diagnostics.push(
        diagnostic(
          "error",
          lineNumber,
          `Duplicate revision: ${event.newRevision}`,
        ),
      );
    }
    if (existing?.committed === true) {
      run.diagnostics.push(
        diagnostic(
          "error",
          lineNumber,
          `Candidate ${event.candidateId} was committed more than once.`,
        ),
      );
    }
    if (
      existing !== undefined &&
      !snapshotsEqual(existing.snapshot, snapshot)
    ) {
      run.diagnostics.push(
        diagnostic(
          "error",
          lineNumber,
          `Commit ${event.candidateId} snapshot differs from its candidate snapshot.`,
        ),
      );
    }
    if (
      existing !== undefined &&
      existing.baseRevision !== event.baseRevision
    ) {
      run.diagnostics.push(
        diagnostic(
          "error",
          lineNumber,
          `Commit ${event.candidateId} has a different base revision from its candidate event.`,
        ),
      );
    }
    if (
      existing !== undefined &&
      ["fail", "cache-rejected", "cancelled"].includes(existing.status)
    ) {
      run.diagnostics.push(
        diagnostic(
          "error",
          lineNumber,
          `Commit ${event.candidateId} conflicts with candidate status ${existing.status}.`,
        ),
      );
    }
    const candidate: ReductionCandidate = existing
      ? {
          ...existing,
          committed: true,
          newRevision: event.newRevision,
          edit: event.edit,
        }
      : {
          candidateId: event.candidateId,
          sequence: event.sequence,
          baseRevision: event.baseRevision,
          status: "internal-commit",
          committed: true,
          newRevision: event.newRevision,
          edit: event.edit,
          snapshot,
          changedFiles: affectedPaths(
            run.revisions.get(event.baseRevision),
            snapshot,
          ),
        };
    replaceCandidate(run, candidate);
    run.revisions.set(event.newRevision, snapshot);
    run.revisionCandidates.set(event.newRevision, event.candidateId);
    return;
  }

  if (event.type === "error") {
    const detail = event.message ?? "No message provided.";
    run.diagnostics.push(
      diagnostic(
        "error",
        lineNumber,
        `Perses reported ${event.exceptionClass}: ${detail}`,
      ),
    );
    return;
  }

  if (event.type === "run_finished") {
    run.statistics = {
      finalRevision: event.finalRevision,
      finalTokenCount: event.finalTokenCount,
      testExecutionCount: event.testExecutionCount,
      externalCacheHitCount: event.externalCacheHitCount,
    };
  }
}

function finishRun(run: MutableRun): ReductionRun {
  for (const record of [...run.records].sort(
    (left, right) => left.value.sequence - right.value.sequence,
  )) {
    applyRecord(run, record);
  }
  const candidates = [...run.candidates].sort(
    (left, right) => left.sequence - right.sequence,
  );
  return {
    id: run.id,
    startSequence: run.startSequence,
    candidates,
    candidatesById: new Map(
      candidates.map((candidate) => [candidate.candidateId, candidate]),
    ),
    revisions: run.revisions,
    revisionCandidates: run.revisionCandidates,
    statistics: run.statistics,
    diagnostics: run.diagnostics,
  };
}

function issueMessage(error: { issues: ReadonlyArray<{ message: string }> }) {
  return error.issues.map((issue) => issue.message).join("; ");
}

async function yieldToBrowser() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted === true) {
    throw new DOMException("Aborted", "AbortError");
  }
}

export async function parseReductionTrace(
  stream: ReadableStream<Uint8Array>,
  options: ParseOptions,
): Promise<TraceParseResult> {
  const reader = stream.getReader();
  const handleAbort = () => {
    void reader.cancel();
  };
  options.signal?.addEventListener("abort", handleAbort, { once: true });
  const decoder = new TextDecoder();
  const diagnostics: Array<TraceDiagnostic> = [];
  const runs: Array<ReductionRun> = [];
  let currentRun: MutableRun | undefined;
  let buffer = "";
  let lineNumber = 0;
  let parsedBytes = 0;
  let eventCount = 0;
  let recordsSinceYield = 0;
  let terminalError: string | undefined;
  const batchSize = options.batchSize ?? 250;

  const reportProgress = () =>
    options.onProgress?.({
      parsedBytes,
      totalBytes: options.totalBytes,
      eventCount,
      diagnosticCount:
        diagnostics.length + (currentRun?.diagnostics.length ?? 0),
    });

  const processLine = (rawLine: string) => {
    lineNumber += 1;
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line.trim().length === 0) return;
    let rawValue: object;
    try {
      const parsed: object = JSON.parse(line) as object;
      if (
        parsed === null ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        diagnostics.push(
          diagnostic(
            "error",
            lineNumber,
            "Each JSONL record must be an object.",
          ),
        );
        return;
      }
      rawValue = parsed;
    } catch {
      diagnostics.push(diagnostic("error", lineNumber, "Invalid JSON record."));
      return;
    }
    const version =
      "schemaVersion" in rawValue ? rawValue.schemaVersion : undefined;
    if (version !== undefined && version !== 1) {
      terminalError = `Unsupported schema version on line ${lineNumber}.`;
      diagnostics.push(diagnostic("error", lineNumber, terminalError));
      return;
    }
    const type = "type" in rawValue ? rawValue.type : undefined;
    if (typeof type === "string" && !SUPPORTED_TYPES.has(type)) {
      diagnostics.push(
        diagnostic(
          "warning",
          lineNumber,
          `Ignored unknown event type: ${type}`,
        ),
      );
      return;
    }
    const parsed = traceEventSchema.safeParse(rawValue);
    if (!parsed.success) {
      diagnostics.push(
        diagnostic("error", lineNumber, issueMessage(parsed.error)),
      );
      return;
    }
    eventCount += 1;
    if (parsed.data.type === "run_started") {
      if (currentRun !== undefined) runs.push(finishRun(currentRun));
      const snapshot = createSnapshotModel(parsed.data.snapshot);
      currentRun = {
        id: `run-${runs.length + 1}`,
        startSequence: parsed.data.sequence,
        candidates: [],
        candidatesById: new Map(),
        revisions: new Map([[parsed.data.initialRevision, snapshot]]),
        revisionCandidates: new Map(),
        diagnostics: [],
        sequences: new Set([parsed.data.sequence]),
        records: [],
      };
      return;
    }
    if (currentRun === undefined) {
      diagnostics.push(
        diagnostic("error", lineNumber, "Event occurred before run_started."),
      );
      return;
    }
    currentRun.records.push({ lineNumber, value: parsed.data });
  };

  try {
    while (true) {
      throwIfAborted(options.signal);
      const { value, done } = await reader.read();
      throwIfAborted(options.signal);
      if (done) break;
      parsedBytes += value.byteLength;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line);
        recordsSinceYield += 1;
        if (recordsSinceYield >= batchSize) {
          recordsSinceYield = 0;
          reportProgress();
          await yieldToBrowser();
          throwIfAborted(options.signal);
        }
      }
      reportProgress();
    }
    buffer += decoder.decode();
    if (buffer.length > 0) processLine(buffer);
  } catch (error) {
    if (options.signal?.aborted === true) {
      await reader.cancel();
    }
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", handleAbort);
    reader.releaseLock();
  }

  if (currentRun !== undefined) runs.push(finishRun(currentRun));
  reportProgress();
  const allDiagnostics = [
    ...diagnostics,
    ...runs.flatMap((run) => run.diagnostics),
  ];
  if (terminalError !== undefined) {
    return {
      ok: false,
      message: terminalError,
      diagnostics: allDiagnostics,
      eventCount,
    };
  }
  if (runs.length === 0) {
    return {
      ok: false,
      message: "The file contains no valid reduction runs.",
      diagnostics: allDiagnostics,
      eventCount,
    };
  }
  return { ok: true, runs, diagnostics: allDiagnostics, eventCount };
}
