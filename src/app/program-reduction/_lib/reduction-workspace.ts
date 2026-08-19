import type { CandidateStatus, ReductionCandidate } from "./trace-model";

export type CandidateFilter = CandidateStatus | "all" | "committed";

export function filterCandidates(
  candidates: ReadonlyArray<ReductionCandidate>,
  query: string,
  filter: CandidateFilter,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return candidates.filter((candidate) => {
    if (
      filter !== "all" &&
      (filter === "committed"
        ? !candidate.committed
        : candidate.status !== filter)
    ) {
      return false;
    }
    if (normalizedQuery.length === 0) return true;
    const searchable = [
      candidate.candidateId,
      candidate.edit?.kind,
      candidate.edit?.description,
      ...candidate.changedFiles,
      ...(candidate.edit?.actions.flatMap((action) => [
        action.kind,
        action.description,
      ]) ?? []),
    ];
    return searchable.some((value) =>
      value?.toLocaleLowerCase().includes(normalizedQuery),
    );
  });
}
