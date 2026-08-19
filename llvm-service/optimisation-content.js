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

const TRANSFORMATION_DESCRIPTIONS = {
  "control-flow": "Simplified the control-flow structure.",
  "instruction-combine": "Combined or simplified LLVM instructions.",
  loop: "Simplified or prepared loop structures.",
  inlining: "Updated function-call boundaries through inlining.",
  "dead-code-elimination":
    "Removed code that no longer contributes to the result.",
  memory: "Simplified memory access or promoted memory-backed values.",
  redundancy: "Removed redundant computations or reused available values.",
  "llvm-transform": "Applied an LLVM IR transformation.",
};

const transformationSummary = {
  unchanged: "Completed without changing the LLVM IR.",
  changed: (category) => TRANSFORMATION_DESCRIPTIONS[category],
};

module.exports = {
  DEFAULT_TRANSFORMATION_CATEGORY,
  TRANSFORMATION_CATEGORIES,
  transformationSummary,
};
