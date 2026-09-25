import type { ExplainInput, EvidenceItem } from "./schema.ts";

export function buildEvidencePack(input: ExplainInput): EvidenceItem[] {
  return [
    {
      id: "E0",
      label: "Step and provenance",
      text: JSON.stringify({
        domain: input.domain,
        traceVersion: input.traceVersion,
        toolVersion: input.toolVersion,
        sourceFile: input.sourceFile,
        subject: input.subject,
      }),
    },
    { id: "E1", label: "Before snapshot", text: input.before },
    {
      id: "E2",
      label:
        input.reduction && !input.reduction.accepted
          ? input.after !== null
            ? "Candidate snapshot (not retained)"
            : "Attempted patch (not retained; no after snapshot)"
          : "After snapshot",
      text: input.after ?? input.patch ?? "Unavailable",
    },
    {
      id: "E3",
      label: "Recorded static metrics (not runtime measurements)",
      text: JSON.stringify(input.metrics),
    },
    {
      id: "E4",
      label: "Step outcome and evidence limitations",
      text: JSON.stringify(input.llvm ?? input.reduction),
    },
  ];
}
