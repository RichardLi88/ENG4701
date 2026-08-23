export const programReductionContent = {
  eyebrow: "Program Reduction",
  heading: "Reduction trace visualiser",
  description:
    "Upload a Perses reduction trace and inspect accepted changes or every attempted candidate side by side.",
} as const;

export const jsonFileUploadContent = {
  uploadButton: "Upload reduction trace",
  replaceButton: "Load another trace",
  uploadHelp: "Perses v2 reduction trace JSON files",
  compactRegionLabel: "Reduction trace file actions",
  status: {
    errorEyebrow: "Upload error",
    errorTitle: "The reduction trace could not be loaded",
    errorDescription: "Choose another JSON file and try again.",
  },
  errors: {
    invalidFileType: "Select a JSON file.",
    invalidJson: "The selected file is not valid JSON.",
    invalidTrace: "The selected file is not a valid Perses v2 reduction trace.",
  },
} as const;

export const units = {
  tokens: "tokens",
} as const;

export const reductionWorkspaceContent = {
  summary: {
    status: "Status",
    source: "Source",
    reduction: "Total reduction",
    acceptedSteps: "Accepted steps",
    candidates: "Candidates",
    duration: "Duration",
    unavailable: "Not provided",
  },
  timeline: {
    heading: "Accepted steps",
    allAttemptsHeading: "Reduction attempts",
    modeLabel: "Timeline contents",
    acceptedOnly: "Accepted only",
    allAttempts: "All attempts",
    original: "Original state",
    otherCandidates: "other candidates",
    candidate: "Candidate",
    previous: "Previous step",
    next: "Next step",
    step: "Step",
    unknownTransformation: "Transformation unavailable",
  },
  detail: {
    before: "Previous code",
    after: "Modified code",
    tokensBefore: "Tokens before",
    tokensAfter: "Tokens after",
    tokensRemoved: "Tokens removed",
    reducer: "Reducer",
    reducerPass: "Reducer pass",
    transformation: "Transformation",
    acceptedSequence: "Accepted sequence",
    candidateStatus: "Candidate status",
    testDuration: "Test duration",
    exitCode: "Exit code",
    unavailable: "Not provided",
    files: "Files",
    comparison: "Line-level comparison",
    diffLegendRemoved: "Removed",
    diffLegendAdded: "Added",
    noFiles: "No files are available for this step.",
    unavailableComparison: "Candidate comparison unavailable",
  },
  empty: {
    heading: "No accepted reduction steps",
    description: "This trace contains no steps to compare.",
  },
  cumulativeReductionChart: {
    heading: "Cumulative token reduction",
    description:
      "Progress after each accepted candidate, including changes made by intervening system steps.",
    acceptedCandidates: "Accepted candidates",
    startingTokens: "Starting token count",
    latestPlottedTokens: "Latest plotted token count",
    cumulativeReduction: "Cumulative token reduction",
    horizontalAxis: "Accepted candidate order",
    verticalAxis: "Tokens reduced",
    keyboardHelp:
      "Use Left and Right Arrow keys to inspect candidates. Use Home and End to jump to the first or last candidate.",
    point: {
      acceptedCandidate: "Accepted candidate",
      candidateId: "Candidate ID",
      tokensBefore: "Tokens before",
      tokensAfter: "Tokens after",
      cumulativeReduction: "Cumulative reduction",
    },
    empty: {
      heading: "No accepted candidates to graph",
      description:
        "This trace has no accepted steps linked to a reduction candidate.",
    },
    unavailable: {
      heading: "Cumulative reduction unavailable",
      description:
        "The trace does not provide the original token count needed to calculate cumulative progress.",
    },
  },
} as const;
