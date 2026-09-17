// Extends Steven Kaing's 004113e projection to accepted steps and test provenance.
import type { ExplainInput } from "~/server/ai/schema";
import type {
  ReductionCandidateView,
  ReductionStepView,
  ReductionTraceViewModel,
} from "./reduction-trace-adapter";

export function toExplainInput(
  model: ReductionTraceViewModel,
  step: ReductionStepView | undefined,
  candidate: ReductionCandidateView | null,
): ExplainInput | null {
  if (!candidate && !step) return null;
  const accepted = candidate === null;
  const before = candidate
    ? candidate.baseFiles.map((f) => `// ${f.path}\n${f.content}`).join("\n\n")
    : step!.files.map((f) => `// ${f.path}\n${f.before}`).join("\n\n");
  const after = candidate
    ? (candidate.resultFiles
        ?.map((f) => `// ${f.path}\n${f.content}`)
        .join("\n\n") ?? null)
    : step!.files.map((f) => `// ${f.path}\n${f.after}`).join("\n\n");
  const tokensBefore = candidate?.tokensBefore ?? step!.tokensBefore;
  const tokensAfter = candidate?.tokensAfter ?? step!.tokensAfter;
  return {
    domain: "program-reduction",
    traceVersion: model.schemaVersion,
    toolVersion: model.toolVersion ?? null,
    sourceFile: model.sourceFile,
    subject: {
      id:
        candidate?.candidateId ?? step!.candidateId ?? `system:${step!.index}`,
      name:
        candidate?.transformationKind ?? step!.transformationKind ?? "SYSTEM",
      scope: candidate?.baseStateId ?? step!.fromStateId,
    },
    before,
    after,
    patch:
      candidate?.patches
        ?.map((p) => `// ${p.path} (${p.kind})\n${p.diff}`)
        .join("\n\n") ?? null,
    metrics: [
      {
        key: "tokens",
        before: tokensBefore,
        after: tokensAfter,
        delta: tokensAfter - tokensBefore,
        estimated: false,
      },
    ],
    llvm: null,
    reduction: {
      accepted,
      status:
        candidate?.status ??
        step!.testStatus ??
        (step!.candidateId === null ? "SYSTEM" : "UNRECORDED"),
      exitCode:
        candidate?.exitCode ?? (accepted ? (step!.exitCode ?? null) : null),
      testScript: model.testScript ?? null,
      testDescription: model.testDescription ?? null,
      description:
        candidate?.description ?? step!.description ?? step!.systemReason ?? "",
      reducer: candidate?.reducer ?? step?.reducer ?? null,
    },
  };
}
