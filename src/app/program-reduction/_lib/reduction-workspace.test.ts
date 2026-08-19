import { describe, expect, test } from "vitest";

import { filterCandidates } from "./reduction-workspace";
import type { ReductionCandidate } from "./trace-model";

const snapshot = {
  files: [],
  filesByPath: new Map(),
  tokens: [],
  tokenCount: 0,
};
const candidates: Array<ReductionCandidate> = [
  {
    candidateId: "alpha",
    sequence: 1,
    baseRevision: 0,
    status: "pass",
    committed: false,
    snapshot,
    changedFiles: ["main.c"],
    edit: {
      kind: "NODE_DELETION",
      description: "Remove node",
      actions: [],
    },
  },
  {
    candidateId: "beta",
    sequence: 2,
    baseRevision: 0,
    status: "fail",
    committed: true,
    snapshot,
    changedFiles: ["other.c"],
  },
];

describe("filterCandidates", () => {
  test("filters status and commit independently", () => {
    expect(
      filterCandidates(candidates, "", "pass").map((item) => item.candidateId),
    ).toEqual(["alpha"]);
    expect(
      filterCandidates(candidates, "", "committed").map(
        (item) => item.candidateId,
      ),
    ).toEqual(["beta"]);
  });

  test("searches edit metadata and file paths", () => {
    expect(filterCandidates(candidates, "remove", "all")).toHaveLength(1);
    expect(filterCandidates(candidates, "OTHER.C", "all")[0]?.candidateId).toBe(
      "beta",
    );
  });
});
