const TRANSFORMATION_CATEGORIES = [
  { pattern: /simplify-?cfg|cfg/i, category: "control-flow" },
  { pattern: /inst-?combine/i, category: "instruction-combine" },
  { pattern: /loop/i, category: "loop" },
  { pattern: /inlin/i, category: "inlining" },
  { pattern: /dead|dce/i, category: "dead-code-elimination" },
  { pattern: /sroa|mem2reg|memory/i, category: "memory" },
  { pattern: /gvn|common-?subexpression|cse/i, category: "redundancy" },
];

const DEFAULT_TRANSFORMATION_CATEGORY = "llvm-transform";

const transformationSummary = {
  unchanged: (fullName) =>
    `${fullName} ran without changing the LLVM IR snapshot.`,
  changedWithoutMetrics: (fullName) =>
    `${fullName} changed the LLVM IR snapshot.`,
  changed: (fullName, metrics) =>
    `${fullName} changed the LLVM IR snapshot. Estimated snapshot metrics: ` +
    `instructions ${metrics.instructions.before} → ${metrics.instructions.after}, ` +
    `basic blocks ${metrics.basicBlocks.before} → ${metrics.basicBlocks.after}, ` +
    `branches ${metrics.branches.before} → ${metrics.branches.after}.`,
};

module.exports = {
  DEFAULT_TRANSFORMATION_CATEGORY,
  TRANSFORMATION_CATEGORIES,
  transformationSummary,
};
