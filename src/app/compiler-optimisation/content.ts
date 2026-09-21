export const compilerWorkflowContent = {
  heading: "Upload C/C++ source",
  description:
    "Choose a local source file. The compiler improves your program through a long series of small steps, and this tool shows you what each step changed.",
  uploadHelp: ".c and .cpp files up to 50,000 characters",
  compactRegionLabel: "Source file actions",
  level: {
    label: "Optimisation level",
    selectLabel: "Optimisation pipeline level",
    descriptions: {
      O0: "O0 - No optimisation",
      O1: "O1 - Basic optimisation",
      O2: "O2 - Standard optimisation",
      O3: "O3 - Aggressive optimisation",
      Os: "Os - Optimise for size",
      Oz: "Oz - Aggressively optimise for size",
    },
  },
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
  intro:
    "A compiler improves your program in many small steps, each called a Pass. Pick one below to see the code it was given, the code it produced, and what changed in between.",
  overallIr: {
    heading: "Whole program, before and after",
    description:
      "The IR the pipeline started from, compared with the IR it finished with. Individual Passes are not attributed here.",
    show: "Show comparison",
    hide: "Hide comparison",
    unavailable:
      "This run reported no Passes, so there is no start or end IR to compare.",
    diffHeading: "Initial IR compared with final IR",
    diffDescription:
      "The combined effect of every Pass in the pipeline, in one comparison.",
    summary: {
      passRan: "pass ran",
      passesRan: "passes ran",
      changedProgram: "changed the program",
      line: "line",
      lines: "lines",
      separator: " · ",
      linesArrow: " -> ",
    },
  },
  filters: {
    regionLabel: "Pass filters",
    searchLabel: "Search Passes",
    searchPlaceholder: "Find a Pass by name",
    searchHint: "Filters the timeline by Pass name.",
    clearSearch: "Clear the Pass search",
    typeLegend: "Type",
    changesLegend: "Changes",
    options: {
      all: "All",
      transform: "Transform",
      analysis: "Analysis",
      changed: "Changed",
      unchanged: "Unchanged",
    },
    typeTooltips: {
      all: "Every Pass in this timeline.",
      transform:
        "Transform and Analysis are guessed from the Pass name, not reported by LLVM. A Pass labelled Transform may still have changed nothing.",
      analysis:
        "Transform and Analysis are guessed from the Pass name, not reported by LLVM. A Pass labelled Analysis is one that only inspects the program.",
    },
  },
  scopes: {
    heading: "Functions",
    allName: "All Passes",
    allDescription: "Every Pass in this run, in order",
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
    llvmName: "LLVM name",
    globalOrder: "Global",
    functionOrder: "Function",
  },
  metrics: {
    heading: "Core metrics",
    description:
      "Counted before and after this Pass. Change is after minus before.",
    columns: {
      metric: "Metric",
      before: "Before",
      after: "After",
      change: "Change",
      measurement: "Measurement",
    },
    measured: "Measured",
    estimated: "Estimated",
    /** Plain-English gloss for each row, surfaced as a tooltip on the label. */
    glossary: {
      instructions:
        "One low-level operation, such as a single add or a single load. Roughly the unit of work the processor carries out.",
      memoryOperations:
        "Reads from and writes to memory, as opposed to values held in registers. Memory access is usually slower than arithmetic.",
      basicBlocks:
        "A straight run of instructions with no way in or out except at its start and end. The boxes in the control flow graph are basic blocks.",
      branches:
        "Points where the program can take more than one path, such as an if or the test at the end of a loop.",
      cyclomaticComplexity:
        "A count of the independent paths through the function. Higher means more branching, so more possible routes through the code.",
    },
    unchangedDeltaNote:
      "Every delta is zero because this Pass did not change the IR it ran on.",
  },
  changeBadge: {
    changed: "IR changed",
    unchanged: "IR unchanged",
    /** Participants otherwise read the badge as "nothing happened to my program". */
    tooltip:
      "Unchanged means the IR unit this Pass ran on did not change. A function Pass reports on that function only, not on the whole program.",
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

/**
 * Hand-written, plain-English descriptions for the Passes that actually change
 * something across the study set. Each one describes what the Pass does in
 * general. None of them describes what happened to the program on screen:
 * the reader combines this with the metrics, Diff and CFG to work that out.
 */
export const sourcePanelContent = {
  heading: "Original source",
  description:
    "The file you uploaded, for orientation. Lines are not mapped to the IR.",
  toggle: "Show the uploaded source file",
  regionLabel: "Uploaded source file, read only",
  unavailable: "The uploaded source file is not available for this run.",
} as const;

export const passDescriptionContent = {
  fallbackLabel: "General description",
  categoryLabel: "Category",
  descriptions: {
    InstCombinePass:
      "Rewrites small groups of instructions into cheaper equivalent ones: folding arithmetic on known constants, cancelling operations that undo each other, and replacing costly operations with simpler ones. It works locally, a few instructions at a time, rather than restructuring the program.",
    SimplifyCFGPass:
      "Cleans up the shape of the program's control flow: merges blocks that always run one after another, and removes branches where both paths lead to the same place. It does not change what the program computes, only the route it takes through the code.",
    SROAPass:
      "Local variables start out as slots in memory. This splits them apart and keeps them in registers instead, so later steps can reason about them as plain values. Small structs and arrays are broken into their individual fields where possible.",
    PostOrderFunctionAttrsPass:
      "Works out properties of each function that the rest of the pipeline can rely on, such as whether it reads or writes memory, or whether its result depends only on its arguments. It records these as annotations rather than changing any code. Later Passes use them to justify optimisations they would otherwise have to skip.",
    LCSSAPass:
      "Rewrites a loop so that any value computed inside it and used afterwards passes through a dedicated variable at the loop's exit. This is bookkeeping rather than an optimisation: it gives later loop Passes a single, predictable place to update when they rewrite the loop.",
    GlobalOptPass:
      "Looks at variables and functions shared across the whole file rather than those inside a single function. It can turn a global that is only ever read into a constant, narrow one that never escapes into a local, and delete those nothing refers to.",
    ReassociatePass:
      "Reorders chains of arithmetic that can legally be regrouped, such as a run of additions or multiplications. This does not make the code faster by itself; it arranges operands into a consistent order so later Passes can spot repeated sub-expressions and constants to fold.",
    LoopSimplifyPass:
      "Puts every loop into a standard shape: one entry point, a single place that jumps back to the start, and dedicated blocks for leaving. It inserts those blocks when they are missing. Nothing about the computation changes, but later loop Passes rely on the regular structure.",
    EarlyCSEPass:
      "Spots expressions computed more than once from the same inputs and reuses the first result instead of recomputing it. It is a fast, local version of that clean-up, run early so later Passes see fewer redundant values.",
    LoopRotatePass:
      "Rewrites a loop that tests its condition at the top into one that checks once before entering and then tests at the bottom. This does not change how many times the body runs, but it puts the loop into the form later Passes need in order to unroll or vectorise it.",
    IndVarSimplifyPass:
      "Tidies up the variables that track a loop's progress, such as its counter. Where the compiler can work out a direct formula, it replaces step-by-step updates with plain arithmetic, and it can simplify or remove the test that ends the loop.",
    LoopDeletionPass:
      "Removes a loop entirely when the compiler can prove the program does not need to run it. That happens when nothing afterwards uses the loop's result, or when the value it computes can be worked out with plain arithmetic instead.",
    GVNPass:
      "Finds values that are provably equal even when they are computed in different places or written in different ways, and keeps just one of them. It reasons across branches, so it catches redundancy that the earlier local clean-ups miss.",
    LoopUnrollPass:
      "Repeats a loop body several times per iteration so the loop runs fewer times, or removes the loop altogether by writing out every iteration when the number of iterations is small and known. This trades larger code for less per-iteration overhead.",
    InstSimplifyPass:
      "Replaces instructions whose result is already known with that value, without building any new instructions. Where InstCombine rewrites code into a better form, this Pass only removes work that is provably redundant.",
    CorrelatedValuePropagationPass:
      "Uses facts implied by earlier branches to simplify later code. If reaching a block means a value must sit in a certain range or equal a particular constant, comparisons and branches that depend on it can be settled on the spot.",
    TailCallElimPass:
      "Recognises a call in the last position of a function whose result is returned straight back, and turns that recursion into a loop where it can. This stops the call stack growing with every repetition.",
    JumpThreadingPass:
      "When the outcome of a branch is already decided by the path taken to reach it, this redirects the jump straight to its destination and skips the redundant test. It can duplicate small blocks to expose those shortcuts.",
    LoopVectorizePass:
      "Rewrites a loop so that each iteration works on several elements at once using wide instructions, when it can prove the iterations do not depend on each other. Fewer iterations then cover the same work.",
    LoopLoadEliminationPass:
      "Spots a loop that reads a memory location one iteration after writing it, and carries the value forward in a register instead of loading it again. The repeated memory access disappears while the computation stays the same.",
  },
} as const;

/**
 * Fragments for the computed change line. It is assembled in `_lib` from
 * measured metric deltas and CFG block counts only, so it can never make a
 * claim the payload does not support.
 */
export const passChangeSummaryContent = {
  heading: "What changed",
  removed: "Removed",
  added: "Added",
  addedContinued: "added",
  listSeparator: ", ",
  listConjunction: " and ",
  metricNouns: {
    basicBlocks: { one: "basic block", other: "basic blocks" },
    instructions: { one: "instruction", other: "instructions" },
    memoryOperations: { one: "memory operation", other: "memory operations" },
    branches: { one: "branch", other: "branches" },
  },
  controlFlow: {
    simplified: "Control flow simplified from",
    expanded: "Control flow expanded from",
    to: "to",
    blockNoun: { one: "block", other: "blocks" },
    unchanged: "Control flow unchanged.",
  },
  noMetricMovement: "The IR changed, but none of the tracked metrics moved.",
  unavailable: {
    notProvided:
      "Measured metrics were not reported for this Pass, so there is no change summary.",
    estimated:
      "Some metrics for this Pass are estimated rather than measured, so no change summary is shown.",
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
  heading: "Intermediate representation",
  /** Shown instead of a Diff when a Pass left its IR unit untouched. */
  snapshot: {
    heading: "Intermediate representation",
    description:
      "This Pass left the IR it ran on unchanged, so there is nothing to compare. The IR at this point in the pipeline is shown once.",
    toggle: "IR at this point in the pipeline",
    regionLabel: "IR at this point in the pipeline, read only",
  },
  viewLabel: "Diff view",
  emphasis: {
    label: "IR detail",
    guided: "Guided",
    plain: "Plain",
    description:
      "Guided dims the parts of each line that describe the machine rather than your program. Nothing is hidden: switch to Plain to see every token at the same weight.",
  },
  fold: {
    expand: "Show",
    unchangedLine: "unchanged line",
    unchangedLines: "unchanged lines",
  },
  legend: {
    heading: "How to read this",
    /**
     * Only entries whose notation appears in the IR on screen are shown, so the
     * list stays as short as the program allows. Every entry says what the
     * notation means and never what this program does.
     */
    groups: {
      structure: "Structure",
      controlFlow: "Control flow",
      values: "Working with values",
      memory: "Memory",
      promises: "Promises to the optimiser",
    },
    entries: [
      ["define", "structure", "Starts a function."],
      [
        "%0",
        "structure",
        "A value worked out earlier, or a parameter. These are numbered rather than named.",
      ],
      ["@name", "structure", "A function or a global variable."],
      [
        "label:",
        "structure",
        "Starts a basic block: a straight run of code with no branches inside it.",
      ],
      ["; preds =", "structure", "Lists the blocks that can jump to this one."],
      [
        "br",
        "controlFlow",
        "A branch. With one label it always jumps there; with a condition and two labels it picks one.",
      ],
      ["ret", "controlFlow", "Returns from the function."],
      [
        "phi",
        "controlFlow",
        "Picks a value based on which block control arrived from. This is how a variable that changes each time round a loop is written.",
      ],
      ["call", "controlFlow", "Calls a function."],
      ["add", "values", "Adds two values."],
      ["sub", "values", "Subtracts one value from another."],
      ["mul", "values", "Multiplies two values."],
      [
        "icmp",
        "values",
        "Compares two values: sgt greater than, slt less than, sle less than or equal, ult unsigned less than.",
      ],
      [
        "lshr",
        "values",
        "Shifts the bits right, which halves the value once per step.",
      ],
      ["zext", "values", "Widens a value to more bits, padding with zeros."],
      ["trunc", "values", "Narrows a value to fewer bits."],
      ["alloca", "memory", "Reserves space for a local variable."],
      ["load", "memory", "Reads a value out of memory."],
      ["store", "memory", "Writes a value into memory."],
      [
        "nsw",
        "promises",
        "Promises the arithmetic will not overflow. Dimmed: it does not change what is computed.",
      ],
      [
        "align",
        "promises",
        "States how the value is laid out in memory. Dimmed.",
      ],
      [
        "noundef",
        "promises",
        "Promises the value is always properly defined. Dimmed.",
      ],
      [
        "i32",
        "promises",
        "How many bits a value uses. i33 and similar come from the optimiser widening a calculation to prove it cannot overflow. Dimmed.",
      ],
    ],
  },
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
  unchanged: {
    description:
      "This Pass left the control flow unchanged, so one graph is shown instead of a comparison.",
    toggle: "Control flow graph at this point",
  },
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
