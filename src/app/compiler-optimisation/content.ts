export const compilerWorkflowContent = {
  eyebrow: "Run a program",
  heading: "Compile and optimise C/C++ source",
  description:
    "Enter source code or choose a local file, then send it through the LLVM compile and structured optimisation workflow.",
  labels: {
    filename: "Filename",
    source: "Source code",
    file: "Choose C/C++ file",
  },
  actions: {
    submit: "Compile and optimise",
    submitting: "Running workflow…",
  },
  status: {
    idle: {
      title: "Ready for source code",
      description: "Choose a .c or .cpp filename and enter code to begin.",
    },
    validating: {
      title: "Validating input",
      description: "Checking the filename and source code before submission.",
    },
    compiling: {
      title: "Compiling source",
      description: "LLVM is converting the source code to unoptimised IR.",
    },
    optimising: {
      title: "Optimising LLVM IR",
      description: "LLVM is running the optimisation pipeline.",
    },
    processing: {
      title: "Processing response",
      description: "The structured optimisation response has been received.",
    },
    success: {
      title: "Workflow complete",
      description:
        "Compilation and structured optimisation completed successfully.",
    },
  },
  errors: {
    unsupportedExtension: "Use a filename ending in .c or .cpp.",
    emptySource: "Enter source code before submitting.",
    sourceTooLarge: "Source code must not exceed 50,000 characters.",
    fileReadFailed: "The selected file could not be read. Choose it again.",
    compileFailed:
      "Compilation failed. Check the source code, then edit it and try again.",
    optimiseFailed:
      "Optimisation failed. Your source code is still available so you can try again.",
    serviceUnavailable:
      "The LLVM service is unavailable. Check the local service, then try again.",
    requestTimedOut:
      "The LLVM service did not finish in time. Try a smaller program.",
    schemaInvalid:
      "The optimisation response does not match the supported data protocol.",
  },
} as const;

export const compilerWorkspaceContent = {
  scopes: {
    heading: "Pass scopes",
    globalName: "Global Passes",
    globalDescription: "Module and unassigned Passes",
  },
  empty: {
    noScopesTitle: "There are no Passes to inspect",
    noScopesDescription:
      "This optimisation result did not include function, module, or unassigned Pass entries.",
    globalNoPassesTitle: "There are no global Passes",
    globalNoPassesDescription:
      "No module-level or unassigned Pass was reported for this run.",
  },
} as const;

export const cfgContent = {
  heading: "Control flow graph",
  description:
    "Directed basic-block flow before and after this Pass. Scroll the canvas to pan.",
  unavailable: "CFG data was not provided for this Pass.",
  empty: "This CFG snapshot contains no basic blocks.",
  fallback: {
    title: "Diagram unavailable",
    duplicateNode:
      "The graph contains duplicate node IDs, so it is shown as a readable list.",
    danglingEdge:
      "The graph contains an edge whose endpoint is missing, so it is shown as a readable list.",
  },
  controls: {
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    reset: "Reset zoom",
  },
  legend: {
    added: "Added",
    removed: "Removed",
    changed: "Changed",
    unchanged: "Unchanged",
  },
} as const;
