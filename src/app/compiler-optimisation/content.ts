export const compilerWorkflowContent = {
  heading: "Upload C/C++ source",
  description:
    "Choose a local source file to compile and inspect its LLVM optimisation passes.",
  uploadHelp: ".c and .cpp files up to 50,000 characters",
  compactRegionLabel: "Source file actions",
  actions: {
    upload: "Upload C/C++ file",
    uploadAnother: "Upload another file",
    uploading: "Processing file…",
  },
  status: {
    idle: {
      title: "Ready for a source file",
      description: "Choose a .c or .cpp file to begin.",
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
      "Compilation failed. Check the selected file, then choose it again.",
    optimiseFailed:
      "Optimisation failed. Choose the source file again to retry.",
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

export const passDetailContent = {
  metadata: {
    fullName: "Full name",
    globalOrder: "Global",
    functionOrder: "Function",
  },
  analysisContext: {
    heading: "Analysis & pipeline context",
    preservation: "Analysis preservation",
    computed: "Computed on demand",
    allPreserved: "All preserved",
    notAllPreserved: "May invalidate cached analyses",
    noneComputed: "No analyses were recomputed during this Pass.",
    unavailable: "Runtime analysis activity was not recorded.",
    previous: "Previous",
    next: "Next",
    pipelineStart: "Pipeline start",
    pipelineEnd: "Pipeline end",
    more: "more",
  },
} as const;

export const routeErrorContent = {
  eyebrow: "Route error",
  title: "The optimisation workspace could not be loaded",
  description:
    "An unexpected error interrupted this page. Try loading the workspace again, or return home and start a new run.",
  referenceLabel: "Error reference",
  actions: {
    retry: "Try again",
    home: "Return home",
  },
} as const;

export const irDiffContent = {
  viewLabel: "Diff view",
  modes: {
    sideBySide: "Side by side",
    unified: "Unified",
  },
  descriptions: {
    sideBySide: "Line-level comparison · panes scroll independently",
    unified: "Single-stream comparison · before and after line numbers",
  },
} as const;

export const cfgContent = {
  heading: "Control flow graph",
  description: "Topology-aligned basic-block flow before and after this Pass.",
  unavailable: "CFG data was not provided for this Pass.",
  empty: "This CFG snapshot contains no basic blocks.",
  lazy: {
    waiting:
      "CFG loading is deferred until this section approaches the viewport.",
    loading: "Loading control flow graph…",
  },
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
    fit: "Fit to view",
    link: "Link views",
    unlink: "Unlink views",
    fullscreen: "Open fullscreen workspace",
    exitFullscreen: "Exit fullscreen workspace",
    search: "Search CFG nodes",
    searchPlaceholder: "Find a block or instruction",
    split: "Split",
    before: "Before",
    after: "After",
    modesLabel: "CFG view mode",
    toolbarLabel: "CFG workspace controls",
    keyboardHint: "Drag to pan · 0 to fit · +/− to zoom",
  },
  search: {
    noMatches: "No matching blocks",
    resultLabel: "CFG search results",
  },
  pane: {
    before: "Before",
    after: "After",
    canvasHelp: "Drag or use arrow keys to pan the graph",
    nodeCount: "nodes",
    edgeCount: "edges",
    graphList: "CFG list",
    flowsTo: "flows to",
  },
  inspector: {
    heading: "Selected block",
    empty: "Select a block to inspect its IR and control-flow connections.",
    missing: "Not present in this snapshot",
    incoming: "Incoming",
    outgoing: "Outgoing",
    noEdges: "None",
    stableId: "Stable ID",
    before: "Before IR",
    after: "After IR",
  },
  graphData: {
    heading: "Graph data",
    nodes: "Nodes",
    edges: "Directed edges",
    noEdges: "No directed edges reported.",
  },
  legend: {
    added: "Added",
    removed: "Removed",
    changed: "Changed",
    unchanged: "Unchanged",
  },
} as const;
