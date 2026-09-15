import assert from "node:assert/strict";
import test from "node:test";

import { foldUnchangedRuns } from "./diff-folding.ts";

/** "." is unchanged, "x" changed. */
const parse = (pattern) => [...pattern];
const isUnchanged = (item) => item === ".";
const shape = (segments) =>
  segments.map((s) => `${s.kind === "collapsed" ? "F" : "V"}${s.items.length}`);

test("returns nothing for an empty diff", () => {
  assert.deepEqual(foldUnchangedRuns([], isUnchanged), []);
});

test("keeps an all-unchanged diff visible rather than folding it away", () => {
  const segments = foldUnchangedRuns(parse("..........."), isUnchanged);

  assert.deepEqual(shape(segments), ["V11"]);
});

test("folds a long unchanged run between changes", () => {
  const segments = foldUnchangedRuns(
    parse("x..................x"),
    isUnchanged,
  );

  // three rows of context either side, the middle 12 folded away
  assert.deepEqual(shape(segments), ["V4", "F12", "V4"]);
});

test("leaves a short unchanged run alone", () => {
  const segments = foldUnchangedRuns(parse("x......x"), isUnchanged);

  assert.deepEqual(shape(segments), ["V8"]);
});

test("folds a long unchanged head and tail", () => {
  const segments = foldUnchangedRuns(
    parse("....................x...................."),
    isUnchanged,
  );

  assert.deepEqual(shape(segments), ["F17", "V7", "F17"]);
});

test("preserves every row exactly once and in order", () => {
  const items = parse("..x.....................x..........x...");
  const segments = foldUnchangedRuns(items, isUnchanged);

  assert.deepEqual(
    segments.flatMap((segment) => [...segment.items]),
    items,
  );
});

test("honours custom context and minimum run", () => {
  const items = parse("x..........x");

  assert.deepEqual(
    shape(foldUnchangedRuns(items, isUnchanged, { context: 1 })),
    ["V2", "F8", "V2"],
  );
  assert.deepEqual(
    shape(foldUnchangedRuns(items, isUnchanged, { minimumRunToFold: 100 })),
    ["V12"],
    "runs too short to fold merge into one visible segment",
  );
});

test("never folds a run that contains a change", () => {
  const segments = foldUnchangedRuns(
    parse("x.........x.........x"),
    isUnchanged,
  );

  for (const segment of segments) {
    if (segment.kind === "collapsed") {
      assert.ok(segment.items.every(isUnchanged));
    }
  }
});
