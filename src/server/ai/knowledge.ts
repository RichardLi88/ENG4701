import type { ExplainInput, Knowledge } from "./schema.ts";
import { aiMessages } from "./content.ts";

const llvmSource = "https://releases.llvm.org/14.0.0/docs/Passes.html";
// Curated paraphrases. These are general mechanisms, never answers to a case.
const passes: Record<string, string> = {
  sroa: "SROA splits aggregate allocations where possible and promotes eligible stack storage into scalar SSA values.",
  instcombine:
    "InstCombine simplifies instruction combinations using local algebraic transformations.",
  simplifycfg:
    "SimplifyCFG simplifies control flow, including unreachable blocks and unnecessary branches.",
  dce: "DCE removes unused instructions whose removal has no relevant side effects.",
  adce: "ADCE works backwards from necessary operations to identify dead computations.",
  mem2reg:
    "Mem2Reg promotes eligible stack allocations into SSA registers, introducing phi nodes when required.",
  gvn: "GVN identifies redundant values and can eliminate redundant computations and loads.",
  sccp: "SCCP combines constant propagation with executable-path information.",
  inline:
    "Inlining replaces eligible call sites with the called function body.",
  loopunroll:
    "Loop unrolling replicates loop bodies; it may increase static code size.",
  licm: "LICM moves eligible loop-invariant computations outside loops.",
  verifier:
    "The verifier checks LLVM IR for structural well-formedness; it is not a runtime performance test.",
};

export function selectKnowledge(input: ExplainInput): {
  items: Knowledge[];
  blocked: string | null;
} {
  if (input.domain === "program-reduction") {
    if (input.traceVersion !== "2.0.0")
      return { items: [], blocked: aiMessages.schema };
    return {
      blocked: null,
      items: [
        {
          id: "K1",
          title: "Perses: syntax-guided reduction",
          source:
            "https://github.com/uw-pluverse/perses/blob/master/doc/publication/2018_perses_icse.pdf",
          sourceVersion: "ICSE 2018",
          scope:
            "General algorithm only; not a claim about a particular Perses build or reducer implementation.",
          text: "Perses is a syntax-guided program reducer. Candidate simplifications are evaluated against an interestingness test. Reduction seeks a smaller input satisfying that test, not general semantic equivalence or improved runtime. A retained candidate supports only the property actually checked by the test. This background does not establish why a specific candidate was accepted or rejected.",
        },
        {
          id: "K2",
          title: "CompileSight reduction trace contract",
          source: "src/app/program-reduction/_lib/reduction-trace-schema.ts",
          sourceVersion: "2.0.0",
          scope:
            "Project trace contract, not external authority on Perses internals.",
          text: "The accepted steps form the retained state sequence. Candidate outcomes include INTERESTING, REJECTED, INVALID, CACHE_HIT, CANCELLED and NOT_TESTED. A candidate outcome and its acceptance into the retained sequence are separate facts. A patch without an after snapshot describes an attempted edit only. A cache outcome alone does not establish a fresh test execution. A system step need not represent a tested candidate. Transformation labels describe edit categories, not a proof of internal decision causes.",
        },
      ],
    };
  }
  if (!/^14\.0\.\d+$/.test(input.toolVersion ?? ""))
    return { items: [], blocked: aiMessages.version };
  const items: Knowledge[] = [
    {
      id: "K1",
      title: "LLVM pass and analysis model",
      source: "https://releases.llvm.org/14.0.0/docs/NewPassManager.html",
      sourceVersion: "14.0.0",
      scope:
        "LLVM 14.0.x family background; patch-level implementation details are not asserted.",
      text: "LLVM passes operate on IR units such as modules, functions and loops. Analysis results can be computed, cached and invalidated. Preserved analyses concern the validity of analysis results, not a proof that all program properties hold. A transform can leave a particular input unchanged. The absence of a newly computed analysis does not exclude use of a cached result.",
    },
  ];
  const key = input.subject.name.toLowerCase().replace(/pass$|[^a-z0-9]/g, "");
  if (key === "earlycse")
    items.push({
      id: "K2",
      title: "EarlyCSE",
      source:
        "https://github.com/llvm/llvm-project/blob/llvmorg-14.0.0/llvm/lib/Transforms/Scalar/EarlyCSE.cpp",
      sourceVersion: "14.0.0",
      scope: "General mechanism; not evidence of this execution.",
      text: "EarlyCSE simplifies instructions and eliminates redundant expressions while traversing the dominator tree. This can remove redundant or trivially dead instructions; the source does not establish which internal path occurred in a particular run.",
    });
  const text = passes[key];
  if (text)
    items.push({
      id: "K2",
      title: input.subject.name,
      source: llvmSource,
      sourceVersion: "14.0.0",
      scope: "General pass mechanism; not evidence of this execution.",
      text,
    });
  else if (items.length === 1)
    items[0]!.scope +=
      " No pass-specific entry is supplied; explain only observed changes and general pass behaviour.";
  return { items, blocked: null };
}
