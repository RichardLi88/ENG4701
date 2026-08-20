import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCandidateComparison,
  parseReductionTrace,
} from "./reduction-trace-adapter.ts";

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

function candidate(overrides = {}) {
  return {
    candidateId: "candidate:2",
    editId: 2,
    baseStateId: "initial",
    resultStateId: null,
    status: "REJECTED",
    becameBest: false,
    observedAtSeq: 2,
    acceptedAtSeq: null,
    observedAtMs: 100,
    acceptedAtMs: null,
    tokensAfter: 8,
    programRef: null,
    patches: [
      {
        path: "main.c",
        kind: "MODIFY",
        diff: [
          "--- a/main.c",
          "+++ b/main.c",
          "@@ -1,3 +1,3 @@",
          " int main() {",
          "-  return 1;",
          "+  return 0;",
          " }",
        ].join("\n"),
      },
    ],
    exitCode: 1,
    elapsedMillis: 20,
    cancelDurationMillis: null,
    transformation: {
      kind: "REPLACE",
      editClass: "AnyNodeReplacementTreeEdit",
      description: "Replace a literal",
      reducer: "token-canonicalizer",
      reducerPass: 1,
      actions: [],
      targets: [],
    },
    ...overrides,
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

test("preserves the reason for a candidate-less system transition", () => {
  const input = validTrace();
  input.states[1] = {
    ...input.states[1],
    createdByCandidateId: null,
    kind: "SYSTEM",
    reason: "Rebuilt parse tree",
  };
  input.steps[0] = {
    ...input.steps[0],
    candidateId: null,
    transformation: {
      kind: "SYSTEM",
      reason: "Rebuilt parse tree",
    },
  };

  const result = parseReductionTrace(input);

  assert.equal(result.ok, true);
  assert.equal(result.data.steps[0].transformationKind, "SYSTEM");
  assert.equal(result.data.steps[0].systemReason, "Rebuilt parse tree");
});

test("groups non-winning candidates by base state in observation order", () => {
  const input = validTrace();
  input.candidates = [
    candidate({ candidateId: "candidate:3", editId: 3, observedAtSeq: 6 }),
    candidate(),
    candidate({
      candidateId: "candidate:1",
      editId: 1,
      resultStateId: "state:1",
      status: "INTERESTING",
      becameBest: true,
      observedAtSeq: 5,
      acceptedAtSeq: 7,
      acceptedAtMs: 250,
      tokensAfter: 5,
      programRef: AFTER_REF,
      patches: null,
    }),
  ];

  const result = parseReductionTrace(input);

  assert.equal(result.ok, true);
  assert.equal(result.data.candidateCount, 3);
  assert.deepEqual(
    result.data.candidatesByState.initial.map((item) => item.candidateId),
    ["candidate:2", "candidate:3"],
  );
  assert.equal(
    result.data.candidatesByState.initial[0].transformationKind,
    "REPLACE",
  );
});

test("reconstructs modified, added and deleted candidate files", () => {
  const input = validTrace();
  input.candidates = [
    candidate({
      patches: [
        ...candidate().patches,
        {
          path: "added.h",
          kind: "ADD",
          diff: [
            "--- /dev/null",
            "+++ b/added.h",
            "@@ -0,0 +1 @@",
            "+#pragma once",
          ].join("\n"),
        },
        {
          path: "unchanged.h",
          kind: "DELETE",
          diff: [
            "--- a/unchanged.h",
            "+++ /dev/null",
            "@@ -1 +0,0 @@",
            "-#define VALUE 1",
          ].join("\n"),
        },
      ],
    }),
  ];
  const parsed = parseReductionTrace(input);
  assert.equal(parsed.ok, true);

  const comparison = buildCandidateComparison(
    parsed.data.candidatesByState.initial[0],
  );

  assert.equal(comparison.ok, true);
  assert.equal(comparison.files[0].after, "int main() {\n  return 0;\n}\n");
  assert.equal(comparison.files[1].after, "#pragma once");
  assert.equal(comparison.files[2].after, "");
});

test("reconstructs candidate patches containing multiple hunks", () => {
  const input = validTrace();
  const before = "one\ntwo\nthree\nfour\nfive\nsix\nseven\n";
  input.programs[BEFORE_REF].files[0].content = before;
  input.candidates = [
    candidate({
      patches: [
        {
          path: "main.c",
          kind: "MODIFY",
          diff: [
            "--- a/main.c",
            "+++ b/main.c",
            "@@ -1,3 +1,3 @@",
            " one",
            "-two",
            "+TWO",
            " three",
            "@@ -5,3 +5,3 @@",
            " five",
            "-six",
            "+SIX",
            " seven",
          ].join("\n"),
        },
      ],
    }),
  ];
  const parsed = parseReductionTrace(input);
  assert.equal(parsed.ok, true);

  const comparison = buildCandidateComparison(
    parsed.data.candidatesByState.initial[0],
  );

  assert.equal(comparison.ok, true);
  assert.equal(
    comparison.files[0].after,
    "one\nTWO\nthree\nfour\nfive\nSIX\nseven\n",
  );
});

test("keeps malformed candidate patches selectable with an unavailable comparison", () => {
  const input = validTrace();
  input.candidates = [
    candidate({
      patches: [
        {
          path: "main.c",
          kind: "MODIFY",
          diff: "not a unified patch",
        },
      ],
    }),
  ];
  const parsed = parseReductionTrace(input);
  assert.equal(parsed.ok, true);

  const comparison = buildCandidateComparison(
    parsed.data.candidatesByState.initial[0],
  );

  assert.deepEqual(comparison, {
    ok: false,
    message: "Could not reconstruct the candidate change for main.c.",
  });
});
