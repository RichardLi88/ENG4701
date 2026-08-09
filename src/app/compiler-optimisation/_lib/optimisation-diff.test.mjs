import assert from "node:assert/strict";
import test from "node:test";

import { createIrDiff } from "./optimisation-diff.ts";

const compact = (result) =>
  result.lines.map((line) => [
    line.kind,
    line.content,
    line.beforeLineNumber,
    line.afterLineNumber,
    line.endsWithNewline,
  ]);

test("identical IR takes the identity path and numbers every line", () => {
  const result = createIrDiff({ before: "a\n\nb", after: "a\n\nb" });

  assert.equal(result.status, "unchanged");
  assert.equal(result.source, "identity");
  assert.deepEqual(compact(result), [
    ["unchanged", "a", 1, 1, true],
    ["unchanged", "", 2, 2, true],
    ["unchanged", "b", 3, 3, false],
  ]);
});

test("normalises CRLF and bare CR without changing displayed content", () => {
  const result = createIrDiff({ before: "a\r\nb\r", after: "a\nb\n" });

  assert.equal(result.status, "unchanged");
  assert.equal(result.source, "computed");
  assert.deepEqual(compact(result), [
    ["unchanged", "a", 1, 1, true],
    ["unchanged", "b", 2, 2, true],
  ]);
});

test("represents an addition with only an after line number", () => {
  const result = createIrDiff({ before: "a\nc", after: "a\nb\nc" });

  assert.equal(result.status, "changed");
  assert.deepEqual(compact(result), [
    ["unchanged", "a", 1, 1, true],
    ["added", "b", null, 2, true],
    ["unchanged", "c", 2, 3, false],
  ]);
});

test("represents a deletion with only a before line number", () => {
  const result = createIrDiff({ before: "a\nb\nc", after: "a\nc" });

  assert.equal(result.status, "changed");
  assert.deepEqual(compact(result), [
    ["unchanged", "a", 1, 1, true],
    ["removed", "b", 2, null, true],
    ["unchanged", "c", 3, 2, false],
  ]);
});

test("handles changes at the start and end without reversing snapshots", () => {
  const result = createIrDiff({
    before: "old-start\nkeep\nold-end",
    after: "new-start\nkeep\nnew-end",
  });

  assert.deepEqual(compact(result), [
    ["removed", "old-start", 1, null, true],
    ["added", "new-start", null, 1, true],
    ["unchanged", "keep", 2, 2, true],
    ["removed", "old-end", 3, null, false],
    ["added", "new-end", null, 3, false],
  ]);
});

test("preserves blank-line edits", () => {
  const result = createIrDiff({ before: "a\n\nb", after: "a\nb" });

  assert.deepEqual(compact(result), [
    ["unchanged", "a", 1, 1, true],
    ["removed", "", 2, null, true],
    ["unchanged", "b", 3, 2, false],
  ]);
});

test("distinguishes a terminal newline from an unterminated final line", () => {
  const result = createIrDiff({ before: "ret void\n", after: "ret void" });

  assert.equal(result.status, "changed");
  assert.deepEqual(compact(result), [
    ["removed", "ret void", 1, null, true],
    ["added", "ret void", null, 1, false],
  ]);
});

test("supports either side being empty", () => {
  assert.deepEqual(compact(createIrDiff({ before: "", after: "x" })), [
    ["added", "x", null, 1, false],
  ]);
  assert.deepEqual(compact(createIrDiff({ before: "x", after: "" })), [
    ["removed", "x", 1, null, false],
  ]);
  assert.equal(createIrDiff({ before: "", after: "" }).status, "unchanged");
});

test("does not truncate very long LLVM instructions", () => {
  const longInstruction = `  %result = call i64 @f(${"i64 1, ".repeat(20_000)}i64 1)`;
  const result = createIrDiff({
    before: longInstruction,
    after: `${longInstruction} #0`,
  });

  assert.equal(result.status, "changed");
  assert.equal(result.lines[0].content, longInstruction);
  assert.equal(result.lines[1].content, `${longInstruction} #0`);
});

test("handles large IR while preserving the complete line sequence", () => {
  const beforeLines = Array.from(
    { length: 4_000 },
    (_, index) => `  %value${index} = add i32 %input, ${index}`,
  );
  const afterLines = [...beforeLines];
  afterLines[2_000] = "  %value2000 = add nuw i32 %input, 2000";

  const result = createIrDiff({
    before: beforeLines.join("\n"),
    after: afterLines.join("\n"),
  });

  assert.equal(result.status, "changed");
  assert.equal(result.lines.length, 4_001);
  assert.equal(
    result.lines.filter((line) => line.kind === "unchanged").length,
    3_999,
  );
  assert.deepEqual(
    result.lines
      .filter((line) => line.kind !== "unchanged")
      .map((line) => [line.kind, line.beforeLineNumber, line.afterLineNumber]),
    [
      ["removed", 2_001, null],
      ["added", null, 2_001],
    ],
  );
});

test("missing IR is unavailable rather than an empty Diff", () => {
  assert.deepEqual(createIrDiff({ before: undefined, after: "" }), {
    status: "unavailable",
    reason: "missing-before",
    lines: [],
  });
  assert.deepEqual(createIrDiff({ before: "", after: null }), {
    status: "unavailable",
    reason: "missing-after",
    lines: [],
  });
  assert.deepEqual(createIrDiff({}), {
    status: "unavailable",
    reason: "missing-both",
    lines: [],
  });
});

test("uses a valid backend structured Diff and returns a defensive copy", () => {
  const structuredDiff = [
    {
      kind: "removed",
      content: "old",
      beforeLineNumber: 1,
      afterLineNumber: null,
      endsWithNewline: false,
    },
    {
      kind: "added",
      content: "new",
      beforeLineNumber: null,
      afterLineNumber: 1,
      endsWithNewline: false,
    },
  ];
  const result = createIrDiff({ before: "old", after: "new", structuredDiff });

  assert.equal(result.source, "structured");
  assert.deepEqual(result.lines, structuredDiff);
  assert.notEqual(result.lines, structuredDiff);
  assert.notEqual(result.lines[0], structuredDiff[0]);
});

test("rejects invalid structured Diff and falls back to local computation", () => {
  const result = createIrDiff({
    before: "old",
    after: "new",
    structuredDiff: [
      {
        kind: "added",
        content: "wrong",
        beforeLineNumber: null,
        afterLineNumber: 7,
        endsWithNewline: false,
      },
    ],
  });

  assert.equal(result.source, "computed");
  assert.deepEqual(compact(result), [
    ["removed", "old", 1, null, false],
    ["added", "new", null, 1, false],
  ]);
});

test("does not mutate inputs and is deterministic", () => {
  const input = { before: "a\nb", after: "a\nc" };
  const snapshot = structuredClone(input);

  assert.deepEqual(createIrDiff(input), createIrDiff(input));
  assert.deepEqual(input, snapshot);
});
