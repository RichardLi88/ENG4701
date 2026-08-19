export const programReductionContent = {
  eyebrow: "Program Reduction",
  heading: "Reduction trace visualiser",
  description:
    "Upload a Perses reduction trace and inspect every accepted change side by side.",
} as const;

export const jsonFileUploadContent = {
  uploadButton: "Upload reduction trace",
  replaceButton: "Load another trace",
  idleMessage: "No file selected.",
  labels: {
    file: "File",
    size: "Size",
  },
  errors: {
    invalidFileType: "Select a JSON file.",
    invalidJson: "The selected file is not valid JSON.",
    invalidTrace: "The selected file is not a valid Perses v2 reduction trace.",
  },
} as const;

export const units = {
  bytes: "bytes",
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
    unavailable: "Not provided",
    files: "Files",
    comparison: "Line-level comparison",
    diffLegendRemoved: "Removed",
    diffLegendAdded: "Added",
    noFiles: "No files are available for this step.",
  },
  empty: {
    heading: "No accepted reduction steps",
    description: "This trace contains no steps to compare.",
  },
} as const;
