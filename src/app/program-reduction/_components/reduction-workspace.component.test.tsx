import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import type {
  ReductionCandidateView,
  ReductionTraceViewModel,
} from "../_lib/reduction-trace-adapter";
import { ReductionWorkspace } from "./reduction-workspace";

const beforeFile = {
  path: "main.c",
  content: "int main() {\n  return 1;\n}\n",
  lines: 3,
  chars: 27,
} as const;

function candidate(
  candidateId: string,
  baseStateId: string,
): ReductionCandidateView {
  return {
    candidateId,
    editId: Number(candidateId.split(":")[1]),
    baseStateId,
    status: "REJECTED",
    observedAtSeq: 1,
    tokensBefore: 9,
    tokensAfter: 8,
    tokensRemoved: 1,
    exitCode: 1,
    elapsedMillis: 20,
    transformationKind: "REPLACE",
    description: "Replace a literal",
    reducer: "token-canonicalizer",
    reducerPass: 1,
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
    baseFiles: [beforeFile],
    resultFiles: null,
  };
}

function model(): ReductionTraceViewModel {
  return {
    schemaVersion: "2.0.0",
    status: "COMPLETED",
    sourceFile: "main.c",
    language: "c",
    originalStateId: "initial",
    originalTokens: 9,
    finalTokens: 5,
    tokensRemoved: 4,
    reductionPercent: 44.4,
    durationMillis: 1_500,
    candidateCount: 3,
    steps: [
      {
        index: 0,
        candidateId: "candidate:1",
        fromStateId: "initial",
        toStateId: "state:1",
        tokensBefore: 9,
        tokensAfter: 5,
        tokensRemoved: 4,
        acceptedAtSeq: 7,
        reducer: "node-reducer",
        reducerPass: 1,
        transformationKind: "DELETE",
        description: "Remove a return statement",
        systemReason: null,
        files: [
          {
            path: "main.c",
            kind: "MODIFY",
            before: beforeFile.content,
            after: "int main() {\n}\n",
          },
        ],
        initialFilePath: "main.c",
      },
    ],
    candidatesByState: {
      initial: [candidate("candidate:2", "initial")],
      "state:1": [candidate("candidate:3", "state:1")],
    },
  };
}

describe("ReductionWorkspace", () => {
  test("defaults to accepted steps and shows transformation kind before reducer", () => {
    render(<ReductionWorkspace model={model()} resultKey="trace" />);

    expect(
      screen.getByRole("button", { name: "Accepted only" }),
    ).toHaveAttribute("aria-pressed", "true");
    const step = screen.getByRole("button", { name: /Step 1/ });
    expect(within(step).getByText("DELETE")).toBeInTheDocument();
    expect(within(step).getByText("node-reducer")).toBeInTheDocument();
    expect(screen.queryByText("Original state")).not.toBeInTheDocument();
  });

  test("expands stage candidates and opens their reconstructed comparison", async () => {
    const user = userEvent.setup();
    render(<ReductionWorkspace model={model()} resultKey="trace" />);

    await user.click(screen.getByRole("button", { name: "All attempts" }));
    expect(screen.getByText("Original state")).toBeInTheDocument();

    const candidateBlocks = screen.getAllByRole("button", {
      name: /1 other candidates/,
    });
    await user.click(candidateBlocks[0]!);
    await user.click(screen.getByRole("button", { name: /REPLACE.*REJECTED/ }));

    expect(
      screen.getByRole("heading", { name: "REPLACE" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Candidate candidate:2")).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Previous code, read only" }),
      ).getByText("return 1;"),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: "Modified code, read only" }),
      ).getByText("return 0;"),
    ).toBeInTheDocument();
  });

  test("keeps only one candidate stage expanded", async () => {
    const user = userEvent.setup();
    render(<ReductionWorkspace model={model()} resultKey="trace" />);
    await user.click(screen.getByRole("button", { name: "All attempts" }));

    const candidateBlocks = screen.getAllByRole("button", {
      name: /1 other candidates/,
    });
    await user.click(candidateBlocks[0]!);
    expect(candidateBlocks[0]!).toHaveAttribute("aria-expanded", "true");
    await user.click(candidateBlocks[1]!);
    expect(candidateBlocks[0]!).toHaveAttribute("aria-expanded", "false");
    expect(candidateBlocks[1]!).toHaveAttribute("aria-expanded", "true");
  });

  test("shows original-state attempts when no candidate was accepted", async () => {
    const user = userEvent.setup();
    const baseModel = model();
    const trace: ReductionTraceViewModel = {
      ...baseModel,
      steps: [],
      finalTokens: baseModel.originalTokens,
      tokensRemoved: 0,
      reductionPercent: 0,
      candidatesByState: {
        initial: [candidate("candidate:2", "initial")],
      },
    };
    render(<ReductionWorkspace model={trace} resultKey="empty-trace" />);

    expect(
      screen.getByRole("heading", { name: "No accepted reduction steps" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All attempts" }));

    expect(screen.getByText("Original state")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /1 other candidates/ }),
    ).toBeInTheDocument();
  });
});
