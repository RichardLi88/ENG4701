import type { CandidateStatus } from "./_lib/trace-model";

export const programReductionContent = {
  eyebrow: "Program reduction",
  heading: "Perses reduction visualizer",
  description:
    "Open a local JSONL trace to inspect every candidate against the exact revision from which it was created.",
  privacy: "Trace contents stay in this browser and are never uploaded.",
} as const;

export const fileLoaderContent = {
  choose: "Choose JSONL trace",
  drop: "Drop a Perses .jsonl trace here, or choose a file.",
  accepted: "Only JSONL trace files are accepted.",
  cancel: "Cancel parsing",
  parsing: "Parsing trace",
  invalidType: "Select a file ending in .jsonl.",
  cancelled: "Trace parsing was cancelled.",
} as const;

export const workspaceContent = {
  openAnother: "Open another trace",
  candidates: "Candidates",
  commits: "Commits",
  diagnostics: "Diagnostics",
  searchLabel: "Search candidates",
  searchPlaceholder: "ID, edit, action, or file",
  filterLabel: "Candidate status",
  allStatuses: "All statuses",
  committedOnly: "Committed",
  noCandidates: "This run contains no candidates.",
  noMatches: "No candidates match the current search and filter.",
  missingBaseline:
    "The declared baseline revision is missing, so this diff is unavailable.",
  noChangedFiles: "This candidate has no source-file changes.",
  noDiagnostics: "No diagnostics were reported.",
  lineView: "Lines",
  tokenView: "Tokens",
  previous: "Previous candidate",
  next: "Next candidate",
  edit: "Edit",
  baseRevision: "Base revision",
  newRevision: "New revision",
  elapsed: "Elapsed",
  internalEdit: "Internal commit",
  unchanged: "No changes",
  expand: "Show hidden lines",
  noFinalNewline: "No newline at end of file",
  protocol: "Schema v1 · local only",
  run: "Run",
  tokens: "tokens",
  committedBadge: "Committed",
  changedFiles: "changed files",
  previousCommit: "Previous committed revision",
  nextCommit: "Next committed revision",
  linePrefix: "Line",
  tryAnother: "Try another trace",
  unifiedDiffLabel: "Unified line diff",
  tokenDiffLabel: "Token sequence diff",
  earlierCandidates: "Earlier candidates",
  laterCandidates: "Later candidates",
} as const;

export const candidateStatusLabels = {
  pass: "Passed",
  fail: "Failed",
  "cache-rejected": "Cache rejected",
  cancelled: "Cancelled",
  "internal-commit": "Internal commit",
} as const satisfies Record<CandidateStatus, string>;

export const filterLabels = candidateStatusLabels;

export const units = {
  bytes: "bytes",
  milliseconds: "ms",
  events: "events",
  errors: "diagnostics",
} as const;
