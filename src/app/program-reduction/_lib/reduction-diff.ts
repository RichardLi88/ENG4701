import { diffArrays } from "diff";

export type DiffKind = "unchanged" | "added" | "removed";

export type LineDiffRow = Readonly<{
  kind: DiffKind;
  content: string;
  beforeLineNumber: number | null;
  afterLineNumber: number | null;
  endsWithNewline: boolean;
}>;

export type FoldedLineDiffRow =
  | LineDiffRow
  | Readonly<{ kind: "fold"; hiddenCount: number; startIndex: number }>;

export type LineDiffResult = Readonly<{
  rows: ReadonlyArray<LineDiffRow>;
  addedLines: number;
  removedLines: number;
  changed: boolean;
}>;

export type TokenDiffRow = Readonly<{
  kind: DiffKind;
  text: string;
  beforeIndex: number | null;
  afterIndex: number | null;
}>;

export type TokenDiffResult = Readonly<{
  rows: ReadonlyArray<TokenDiffRow>;
  addedTokens: number;
  removedTokens: number;
  changed: boolean;
}>;

type LineUnit = Readonly<{ content: string; endsWithNewline: boolean }>;

function splitLines(value: string): Array<LineUnit> {
  if (value.length === 0) return [];
  const lines: Array<LineUnit> = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\n") continue;
    const rawContent = value.slice(start, index);
    lines.push({
      content: rawContent.endsWith("\r") ? rawContent.slice(0, -1) : rawContent,
      endsWithNewline: true,
    });
    start = index + 1;
  }
  if (start < value.length) {
    const rawContent = value.slice(start);
    lines.push({
      content: rawContent.endsWith("\r") ? rawContent.slice(0, -1) : rawContent,
      endsWithNewline: false,
    });
  }
  return lines;
}

export function createLineDiff(
  before: string | undefined,
  after: string | undefined,
): LineDiffResult {
  const beforeLines = splitLines(before ?? "");
  const afterLines = splitLines(after ?? "");
  const changes = diffArrays(beforeLines, afterLines, {
    comparator: (left, right) =>
      left.content === right.content &&
      left.endsWithNewline === right.endsWithNewline,
  });
  const rows: Array<LineDiffRow> = [];
  let beforeLineNumber = 1;
  let afterLineNumber = 1;
  for (const change of changes) {
    const kind = change.added
      ? "added"
      : change.removed
        ? "removed"
        : "unchanged";
    for (const line of change.value) {
      rows.push({
        kind,
        content: line.content,
        beforeLineNumber: kind === "added" ? null : beforeLineNumber,
        afterLineNumber: kind === "removed" ? null : afterLineNumber,
        endsWithNewline: line.endsWithNewline,
      });
      if (kind !== "added") beforeLineNumber += 1;
      if (kind !== "removed") afterLineNumber += 1;
    }
  }
  const addedLines = rows.filter((row) => row.kind === "added").length;
  const removedLines = rows.filter((row) => row.kind === "removed").length;
  return {
    rows,
    addedLines,
    removedLines,
    changed: addedLines > 0 || removedLines > 0,
  };
}

export function foldLineDiff(
  rows: ReadonlyArray<LineDiffRow>,
  expandedStarts: ReadonlySet<number>,
  context = 3,
): Array<FoldedLineDiffRow> {
  const visible = new Set<number>();
  rows.forEach((row, index) => {
    if (row.kind === "unchanged") return;
    for (
      let contextIndex = Math.max(0, index - context);
      contextIndex <= Math.min(rows.length - 1, index + context);
      contextIndex += 1
    ) {
      visible.add(contextIndex);
    }
  });
  if (visible.size === 0) return [...rows];
  const result: Array<FoldedLineDiffRow> = [];
  let index = 0;
  while (index < rows.length) {
    if (visible.has(index)) {
      result.push(rows[index]!);
      index += 1;
      continue;
    }
    const startIndex = index;
    while (index < rows.length && !visible.has(index)) index += 1;
    if (expandedStarts.has(startIndex)) {
      result.push(...rows.slice(startIndex, index));
    } else {
      result.push({
        kind: "fold",
        hiddenCount: index - startIndex,
        startIndex,
      });
    }
  }
  return result;
}

export function createTokenDiff(
  before: ReadonlyArray<{ index: number; text: string }>,
  after: ReadonlyArray<{ index: number; text: string }>,
): TokenDiffResult {
  const changes = diffArrays([...before], [...after], {
    comparator: (
      left: { index: number; text: string },
      right: { index: number; text: string },
    ) => left.text === right.text,
  });
  const rows: Array<TokenDiffRow> = [];
  let beforePosition = 0;
  let afterPosition = 0;
  for (const change of changes) {
    const kind = change.added
      ? "added"
      : change.removed
        ? "removed"
        : "unchanged";
    for (const token of change.value) {
      rows.push({
        kind,
        text: token.text,
        beforeIndex:
          kind === "added" ? null : (before[beforePosition]?.index ?? null),
        afterIndex:
          kind === "removed" ? null : (after[afterPosition]?.index ?? null),
      });
      if (kind !== "added") beforePosition += 1;
      if (kind !== "removed") afterPosition += 1;
    }
  }
  const addedTokens = rows.filter((row) => row.kind === "added").length;
  const removedTokens = rows.filter((row) => row.kind === "removed").length;
  return {
    rows,
    addedTokens,
    removedTokens,
    changed: addedTokens > 0 || removedTokens > 0,
  };
}

export function visibleWhitespace(value: string) {
  return value.replaceAll(" ", "·").replaceAll("\t", "→").replaceAll("\n", "↵");
}
