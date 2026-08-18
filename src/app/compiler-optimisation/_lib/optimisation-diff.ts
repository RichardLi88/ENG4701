export type IrDiffLineKind = "unchanged" | "added" | "removed";

/**
 * A display-ready line in a unified edit script. `endsWithNewline` keeps a
 * terminal newline distinct from a final unterminated line without inventing
 * a phantom empty line.
 */
export type IrDiffLine = Readonly<{
  kind: IrDiffLineKind;
  content: string;
  beforeLineNumber: number | null;
  afterLineNumber: number | null;
  endsWithNewline: boolean;
}>;

export type IrDiffUnavailableReason =
  | "missing-before"
  | "missing-after"
  | "missing-both";

export type IrDiffResult =
  | Readonly<{
      status: "unavailable";
      reason: IrDiffUnavailableReason;
      lines: readonly [];
    }>
  | Readonly<{
      status: "unchanged";
      source: "identity" | "structured" | "computed";
      lines: ReadonlyArray<IrDiffLine>;
    }>
  | Readonly<{
      status: "changed";
      source: "structured" | "computed";
      lines: ReadonlyArray<IrDiffLine>;
    }>;

export type CreateIrDiffInput = Readonly<{
  before?: string | null;
  after?: string | null;
  /**
   * Optional backend edit script. It wins only when its rows, line numbers and
   * reconstructed content agree exactly with the supplied IR snapshots.
   */
  structuredDiff?: ReadonlyArray<IrDiffLine> | null;
}>;

type TextLine = Readonly<{
  content: string;
  endsWithNewline: boolean;
}>;

type Edit = Readonly<{
  kind: IrDiffLineKind;
  line: TextLine;
}>;

const EMPTY_LINES = [] as const;

function normaliseLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function splitLines(value: string): Array<TextLine> {
  const normalised = normaliseLineEndings(value);

  if (normalised.length === 0) {
    return [];
  }

  const lines: Array<TextLine> = [];
  let start = 0;

  for (let index = 0; index < normalised.length; index += 1) {
    if (normalised[index] !== "\n") {
      continue;
    }

    lines.push({
      content: normalised.slice(start, index),
      endsWithNewline: true,
    });
    start = index + 1;
  }

  if (start < normalised.length) {
    lines.push({
      content: normalised.slice(start),
      endsWithNewline: false,
    });
  }

  return lines;
}

function linesEqual(left: TextLine | undefined, right: TextLine | undefined) {
  if (left === undefined || right === undefined) {
    return false;
  }

  return (
    left.content === right.content &&
    left.endsWithNewline === right.endsWithNewline
  );
}

/** Compute a shortest line-level edit script with Myers' diff algorithm. */
function computeEdits(before: Array<TextLine>, after: Array<TextLine>) {
  const maximumDistance = before.length + after.length;
  const trace: Array<Map<number, number>> = [];
  const furthestX = new Map<number, number>([[1, 0]]);

  for (let distance = 0; distance <= maximumDistance; distance += 1) {
    trace.push(new Map(furthestX));

    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const moveDown =
        diagonal === -distance ||
        (diagonal !== distance &&
          (furthestX.get(diagonal - 1) ?? -1) <
            (furthestX.get(diagonal + 1) ?? -1));
      let x = moveDown
        ? (furthestX.get(diagonal + 1) ?? 0)
        : (furthestX.get(diagonal - 1) ?? 0) + 1;
      let y = x - diagonal;

      while (x < before.length && y < after.length) {
        if (!linesEqual(before[x], after[y])) {
          break;
        }
        x += 1;
        y += 1;
      }

      furthestX.set(diagonal, x);

      if (x >= before.length && y >= after.length) {
        return backtrackEdits(trace, before, after);
      }
    }
  }

  return [];
}

function backtrackEdits(
  trace: Array<Map<number, number>>,
  before: Array<TextLine>,
  after: Array<TextLine>,
) {
  const reversed: Array<Edit> = [];
  let x = before.length;
  let y = after.length;

  for (let distance = trace.length - 1; distance >= 0; distance -= 1) {
    const furthestX = trace[distance]!;
    const diagonal = x - y;
    const moveDown =
      diagonal === -distance ||
      (diagonal !== distance &&
        (furthestX.get(diagonal - 1) ?? -1) <
          (furthestX.get(diagonal + 1) ?? -1));
    const previousDiagonal = moveDown ? diagonal + 1 : diagonal - 1;
    const previousX = furthestX.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;

    while (x > previousX && y > previousY) {
      reversed.push({ kind: "unchanged", line: before[x - 1]! });
      x -= 1;
      y -= 1;
    }

    if (distance === 0) {
      break;
    }

    if (x === previousX) {
      reversed.push({ kind: "added", line: after[y - 1]! });
      y -= 1;
    } else {
      reversed.push({ kind: "removed", line: before[x - 1]! });
      x -= 1;
    }
  }

  return reversed.reverse();
}

function numberEdits(edits: ReadonlyArray<Edit>): Array<IrDiffLine> {
  let beforeLineNumber = 1;
  let afterLineNumber = 1;

  return edits.map(({ kind, line }) => {
    const numberedLine: IrDiffLine = {
      kind,
      content: line.content,
      beforeLineNumber: kind === "added" ? null : beforeLineNumber,
      afterLineNumber: kind === "removed" ? null : afterLineNumber,
      endsWithNewline: line.endsWithNewline,
    };

    if (kind !== "added") {
      beforeLineNumber += 1;
    }
    if (kind !== "removed") {
      afterLineNumber += 1;
    }

    return numberedLine;
  });
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isValidStructuredDiff(
  candidate: ReadonlyArray<IrDiffLine>,
  before: Array<TextLine>,
  after: Array<TextLine>,
): boolean {
  const reconstructedBefore: Array<TextLine> = [];
  const reconstructedAfter: Array<TextLine> = [];
  let expectedBeforeLine = 1;
  let expectedAfterLine = 1;

  for (const line of candidate) {
    if (
      line === null ||
      typeof line !== "object" ||
      !["unchanged", "added", "removed"].includes(line.kind) ||
      typeof line.content !== "string" ||
      typeof line.endsWithNewline !== "boolean"
    ) {
      return false;
    }

    const belongsToBefore = line.kind !== "added";
    const belongsToAfter = line.kind !== "removed";

    if (
      (belongsToBefore &&
        (!isPositiveInteger(line.beforeLineNumber) ||
          line.beforeLineNumber !== expectedBeforeLine)) ||
      (!belongsToBefore && line.beforeLineNumber !== null) ||
      (belongsToAfter &&
        (!isPositiveInteger(line.afterLineNumber) ||
          line.afterLineNumber !== expectedAfterLine)) ||
      (!belongsToAfter && line.afterLineNumber !== null)
    ) {
      return false;
    }

    const textLine = {
      content: line.content,
      endsWithNewline: line.endsWithNewline,
    };

    if (belongsToBefore) {
      reconstructedBefore.push(textLine);
      expectedBeforeLine += 1;
    }
    if (belongsToAfter) {
      reconstructedAfter.push(textLine);
      expectedAfterLine += 1;
    }
  }

  return (
    reconstructedBefore.length === before.length &&
    reconstructedAfter.length === after.length &&
    reconstructedBefore.every((line, index) =>
      linesEqual(line, before[index]),
    ) &&
    reconstructedAfter.every((line, index) => linesEqual(line, after[index]))
  );
}

function copyStructuredDiff(lines: ReadonlyArray<IrDiffLine>) {
  return lines.map((line) => ({ ...line }));
}

function resultStatus(lines: ReadonlyArray<IrDiffLine>) {
  return lines.some((line) => line.kind !== "unchanged")
    ? ("changed" as const)
    : ("unchanged" as const);
}

/**
 * Builds the Diff data for one selected Pass. Missing snapshots are an error
 * state; callers must not coerce them to empty strings before calling.
 */
export function createIrDiff(input: CreateIrDiffInput): IrDiffResult {
  const beforeMissing = input.before === undefined || input.before === null;
  const afterMissing = input.after === undefined || input.after === null;

  if (beforeMissing || afterMissing) {
    return {
      status: "unavailable",
      reason:
        beforeMissing && afterMissing
          ? "missing-both"
          : beforeMissing
            ? "missing-before"
            : "missing-after",
      lines: EMPTY_LINES,
    };
  }

  const beforeText = input.before;
  const afterText = input.after;
  const beforeLines = splitLines(beforeText);
  const afterLines = splitLines(afterText);

  if (beforeText === afterText) {
    return {
      status: "unchanged",
      source: "identity",
      lines: numberEdits(
        beforeLines.map((line) => ({ kind: "unchanged", line })),
      ),
    };
  }

  if (
    input.structuredDiff !== undefined &&
    input.structuredDiff !== null &&
    isValidStructuredDiff(input.structuredDiff, beforeLines, afterLines)
  ) {
    const lines = copyStructuredDiff(input.structuredDiff);
    const status = resultStatus(lines);
    return { status, source: "structured", lines };
  }

  const lines = numberEdits(computeEdits(beforeLines, afterLines));
  const status = resultStatus(lines);
  return { status, source: "computed", lines };
}
