import { describe, expect, test } from "vitest";

import {
  createLineDiff,
  createTokenDiff,
  foldLineDiff,
} from "./reduction-diff";

describe("createLineDiff", () => {
  test("preserves blank lines and final-newline changes", () => {
    const result = createLineDiff("one\n\ntwo\n", "one\ntwo");

    expect(result.removedLines).toBe(2);
    expect(result.addedLines).toBe(1);
    expect(result.rows.at(-1)?.endsWithNewline).toBe(false);
  });

  test("represents added and deleted files as whole-file changes", () => {
    expect(createLineDiff(undefined, "new\n").addedLines).toBe(1);
    expect(createLineDiff("old\n", undefined).removedLines).toBe(1);
  });

  test("folds distant unchanged context and can expand it", () => {
    const before = Array.from({ length: 12 }, (_, index) => `${index}`).join(
      "\n",
    );
    const result = createLineDiff(before, before.replace("0", "zero"));
    const folded = foldLineDiff(result.rows, new Set(), 1);
    const fold = folded.find((row) => row.kind === "fold");

    expect(fold?.kind).toBe("fold");
    if (fold?.kind === "fold") {
      expect(
        foldLineDiff(result.rows, new Set([fold.startIndex]), 1),
      ).toHaveLength(result.rows.length);
    }
  });
});

describe("createTokenDiff", () => {
  test("keeps stable indices when repeated lexemes are removed", () => {
    const result = createTokenDiff(
      [
        { index: 4, text: "x" },
        { index: 7, text: "x" },
        { index: 9, text: "y" },
      ],
      [
        { index: 1, text: "x" },
        { index: 2, text: "y" },
      ],
    );

    expect(result.removedTokens).toBe(1);
    expect(result.rows.find((row) => row.kind === "removed")?.beforeIndex).toBe(
      7,
    );
    expect(result.rows.at(-1)?.afterIndex).toBe(2);
  });
});
