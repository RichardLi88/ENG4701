// Synthetic engineering fixture. Never use this as empirical Perses research data.
import { createHash } from "node:crypto";
const before = "int main() { int unused = 0; return 42; }\n";
const after = "int main() { return 42; }\n";
const rejected = "int main() {}\n";
const ref = (text) => "p_" + createHash("sha256").update(text).digest("hex");
function program(content, count) {
  return {
    files: [
      {
        path: "synthetic-acceptance.c",
        content,
        lines: 1,
        chars: content.length,
      },
    ],
    tokenCount: count,
    tokens: [],
  };
}
const transformation = {
  kind: "DELETE",
  editClass: "fixture",
  description: "Synthetic test: remove unused declaration",
  reducer: "synthetic-fixture",
  reducerPass: 0,
  actions: [],
  targets: [],
};
export function reductionFixture() {
  const candidates = [
    "INTERESTING",
    "REJECTED",
    "INVALID",
    "CACHE_HIT",
    "CANCELLED",
    "NOT_TESTED",
  ].map((status, index) => ({
    candidateId: `candidate:${index + 1}`,
    editId: index + 1,
    baseStateId: "initial",
    resultStateId: index === 0 ? "accepted" : null,
    status,
    becameBest: index === 0,
    observedAtSeq: index + 1,
    acceptedAtSeq: index === 0 ? 7 : null,
    observedAtMs: 10,
    acceptedAtMs: index === 0 ? 20 : null,
    tokensAfter: index === 0 ? 9 : index === 1 ? 6 : 11,
    programRef: index < 2 ? ref(index === 0 ? after : rejected) : null,
    patches:
      index < 2
        ? null
        : [
            {
              path: "synthetic-acceptance.c",
              kind: "MODIFY",
              diff: "-return 42;",
            },
          ],
    exitCode: index === 0 ? 0 : index === 1 ? 1 : null,
    elapsedMillis: 10,
    cancelDurationMillis: null,
    transformation: {
      ...transformation,
      description:
        index === 0
          ? transformation.description
          : index === 1
            ? "Synthetic test: remove the unused declaration and return statement"
            : "Synthetic test: attempt to remove the return statement",
    },
  }));
  return {
    schemaVersion: "2.0.0",
    domain: "program-reduction",
    meta: {
      tool: "perses",
      toolVersion: null,
      status: "COMPLETED",
      sourceFile: "synthetic-acceptance.c",
      testScript: "synthetic-test.sh",
      testDescription:
        "Synthetic engineering fixture only, not an actual Perses run. The stipulated test checks that the program returns 42.",
      reducerPlan: ["synthetic-fixture"],
    },
    summary: {},
    originalStateId: "initial",
    finalStateId: "accepted",
    programs: {
      [ref(before)]: program(before, 14),
      [ref(after)]: program(after, 9),
      [ref(rejected)]: program(rejected, 6),
    },
    states: [
      {
        stateId: "initial",
        parentStateId: null,
        createdByCandidateId: null,
        programRef: ref(before),
        tokens: 14,
        kind: "INITIAL",
        acceptedAtSeq: null,
        reason: null,
      },
      {
        stateId: "accepted",
        parentStateId: "initial",
        createdByCandidateId: "candidate:1",
        programRef: ref(after),
        tokens: 9,
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
        toStateId: "accepted",
        acceptedAtSeq: 7,
        tokensBefore: 14,
        tokensAfter: 9,
        programRef: ref(after),
        baseProgramRef: ref(before),
        patches: [],
        transformation,
      },
    ],
    candidates,
    errors: [],
  };
}
