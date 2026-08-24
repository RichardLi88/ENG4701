import type { ReductionExplainInput } from "~/server/ai/schema/evidence-input";

import type {
  ReductionCandidateView,
  ReductionFileComparison,
} from "./reduction-trace-adapter";

/**
 * Projects a reduction candidate into the narrow payload the AI layer accepts.
 * A candidate that never produced a program state has no "after" text; its
 * patch is supplied instead rather than an invented empty program.
 */
export function toExplainInput(
  candidate: ReductionCandidateView,
): ReductionExplainInput {
  return {
    domain: "program-reduction",
    candidate: {
      candidateId: candidate.candidateId,
      status: candidate.status,
      transformationKind: candidate.transformationKind,
      description: candidate.description,
      reducer: candidate.reducer,
      tokensBefore: candidate.tokensBefore,
      tokensAfter: candidate.tokensAfter,
      before: joinFiles(candidate.baseFiles),
      after:
        candidate.resultFiles === null
          ? null
          : joinFiles(candidate.resultFiles),
      patch: candidate.patches === null ? null : joinPatches(candidate.patches),
    },
  };
}

type ProgramFile = Readonly<{ path: string; content: string }>;

function joinFiles(files: ReadonlyArray<ProgramFile>): string {
  return files.map((file) => `// ${file.path}\n${file.content}`).join("\n\n");
}

function joinPatches(
  patches: ReadonlyArray<
    Readonly<{ path: string; kind: string; diff: string }>
  >,
): string {
  return patches
    .map((patch) => `// ${patch.path} (${patch.kind})\n${patch.diff}`)
    .join("\n\n");
}

export type { ReductionFileComparison };
