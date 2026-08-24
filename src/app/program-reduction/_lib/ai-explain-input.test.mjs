import assert from "node:assert/strict";
import test from "node:test";

import { toExplainInput } from "./ai-explain-input.ts";

const file = (path, content) => ({
  path,
  content,
  lines: content.split("\n").length,
  chars: content.length,
});

const candidate = {
  candidateId: "candidate:12",
  editId: 3,
  baseStateId: "s1",
  status: "INTERESTING",
  observedAtSeq: 4,
  tokensBefore: 400,
  tokensAfter: 361,
  tokensRemoved: 39,
  exitCode: 0,
  elapsedMillis: 12,
  transformationKind: "DELETE",
  description: "Removed unused function body",
  reducer: "PersesNodeReducer",
  reducerPass: 1,
  patches: null,
  baseFiles: [file("a.c", "int unused() { return 1; }")],
  resultFiles: [file("a.c", "")],
};

test("carries token counts as the reduction metric", () => {
  const input = toExplainInput(candidate);

  assert.equal(input.candidate.tokensBefore, 400);
  assert.equal(input.candidate.tokensAfter, 361);
});

test("renders the accepted program state as the after text", () => {
  const input = toExplainInput(candidate);

  assert.match(input.candidate.before, /int unused/);
  assert.doesNotMatch(input.candidate.after, /int unused/);
  assert.match(input.candidate.after, /a\.c/);
  assert.equal(input.candidate.patch, null);
});

test("supplies the patch when a candidate has no materialised result state", () => {
  const patchOnly = {
    ...candidate,
    status: "REJECTED",
    resultFiles: null,
    patches: [{ path: "a.c", kind: "DELETE", diff: "-int unused() ..." }],
  };

  const input = toExplainInput(patchOnly);

  assert.equal(input.candidate.after, null);
  assert.match(input.candidate.patch, /-int unused/);
});
