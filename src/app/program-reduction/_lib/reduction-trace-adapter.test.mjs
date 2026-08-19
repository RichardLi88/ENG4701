import assert from "node:assert/strict";
import test from "node:test";

import { parseReductionTrace } from "./reduction-trace-adapter.ts";

const BEFORE_REF = `p_${"a".repeat(64)}`;
const AFTER_REF = `p_${"b".repeat(64)}`;

function program(files, tokenCount) {
  return {
    files: files.map(({ path, content }) => ({
      path,
      content,
      lines: content.length === 0 ? 0 : content.split("\n").length - 1,
      chars: content.length,
    })),
    tokenCount,
    tokens: [],
  };
}

function validTrace() {
  return {
    schemaVersion: "2.0.0",
    domain: "program-reduction",
    meta: {
      tool: "perses",
      status: "COMPLETED",
      sourceFile: "main.c",
      startedAtMillis: 1_000,
      finishedAtMillis: 2_500,
      reducerPlan: ["node-reducer"],
    },
    summary: {},
    originalStateId: "initial",
    finalStateId: "state:1",
    programs: {
      [BEFORE_REF]: program(
        [
          { path: "main.c", content: "int main() {\n  return 1;\n}\n" },
          { path: "unchanged.h", content: "#define VALUE 1\n" },
        ],
        9,
      ),
      [AFTER_REF]: program(
        [
          { path: "main.c", content: "int main() {\n}\n" },
          { path: "unchanged.h", content: "#define VALUE 1\n" },
          { path: "added.h", content: "#pragma once\n" },
        ],
        5,
      ),
    },
    states: [
      {
        stateId: "initial",
        parentStateId: null,
        createdByCandidateId: null,
        programRef: BEFORE_REF,
        tokens: 9,
        kind: "INITIAL",
        acceptedAtSeq: null,
        reason: null,
      },
      {
        stateId: "state:1",
        parentStateId: "initial",
        createdByCandidateId: "candidate:1",
        programRef: AFTER_REF,
        tokens: 5,
        kind: "CANDIDATE",
        acceptedAtSeq: 7,
        reason: null,
      },
    ],
    steps: [
      {
        index: 0,
        candidateId: "candidate:1",
        fromStateId: "initial",
        toStateId: "state:1",
        acceptedAtSeq: 7,
        tokensBefore: 9,
        tokensAfter: 5,
        programRef: AFTER_REF,
        baseProgramRef: BEFORE_REF,
        patches: [
          { path: "added.h", kind: "ADD", diff: "" },
          { path: "main.c", kind: "MODIFY", diff: "" },
        ],
        transformation: {
          kind: "DELETE",
          reducer: "node-reducer",
          reducerPass: 2,
          description: "Remove a return statement",
        },
      },
    ],
    candidates: [],
    errors: [],
  };
}

test("adapts a valid multi-file trace into step comparisons", () => {
  const result = parseReductionTrace(validTrace());
  assert.equal(result.ok, true);
  assert.equal(result.data.steps.length, 1);
  assert.equal(result.data.steps[0].tokensRemoved, 4);
  assert.equal(result.data.steps[0].initialFilePath, "added.h");
  assert.equal(result.data.steps[0].files[0].kind, "ADD");
  assert.equal(result.data.steps[0].files[0].before, "");
  assert.equal(result.data.durationMillis, 1_500);
  assert.equal(result.data.reductionPercent, (4 / 9) * 100);
});

test("rejects unsupported versions with a concrete path", () => {
  const input = { ...validTrace(), schemaVersion: "3.0.0" };
  const result = parseReductionTrace(input);
  assert.equal(result.ok, false);
  assert.match(result.message, /^schemaVersion:/);
});

test("rejects missing program references before adaptation", () => {
  const input = validTrace();
  input.steps[0].programRef = `p_${"c".repeat(64)}`;
  const result = parseReductionTrace(input);
  assert.equal(result.ok, false);
  assert.match(result.message, /^steps\.0\.programRef:/);
});

test("supports a valid trace with no accepted steps", () => {
  const input = validTrace();
  input.steps = [];
  const result = parseReductionTrace(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.steps, []);
});
