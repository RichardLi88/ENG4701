#include "llvm/ADT/Any.h"
#include "llvm/ADT/DenseMap.h"
#include "llvm/Analysis/AliasAnalysis.h"
#include "llvm/Analysis/LazyCallGraph.h"
#include "llvm/Analysis/LoopInfo.h"
#include "llvm/IR/CFG.h"
#include "llvm/IR/Function.h"
#include "llvm/IR/Instruction.h"
#include "llvm/IR/LLVMContext.h"
#include "llvm/IR/Module.h"
#include "llvm/IR/PassInstrumentation.h"
#include "llvm/IR/PassManager.h"
#include "llvm/IR/ValueHandle.h"
#include "llvm/IRReader/IRReader.h"
#include "llvm/Passes/PassBuilder.h"
#include "llvm/Support/SourceMgr.h"
#include "llvm/Support/raw_ostream.h"

#include <algorithm>
#include <cstdint>
#include <numeric>
#include <optional>
#include <string>
#include <vector>

using namespace llvm;

namespace {

struct Metrics {
  uint64_t Instructions = 0;
  uint64_t MemoryOperations = 0;
  uint64_t BasicBlocks = 0;
  uint64_t Branches = 0;
  uint64_t CyclomaticComplexity = 0;
};

struct CfgNode {
  std::string Id;
  std::string Label;
};

struct CfgEdge {
  std::string Source;
  std::string Target;
};

struct FunctionCfg {
  std::string FunctionName;
  std::vector<CfgNode> Nodes;
  std::vector<CfgEdge> Edges;
};

struct TrackedBlock {
  WeakTrackingVH Handle;
  std::string Id;
};

struct PassCfgFrame {
  std::string PassId;
  std::vector<TrackedBlock> Blocks;
  uint64_t NextBlockId = 0;
};

class DisjointSet {
public:
  explicit DisjointSet(size_t Size) : Parent(Size), Rank(Size, 0) {
    std::iota(Parent.begin(), Parent.end(), 0);
  }

  size_t find(size_t Item) {
    if (Parent[Item] != Item)
      Parent[Item] = find(Parent[Item]);
    return Parent[Item];
  }

  void unite(size_t Left, size_t Right) {
    Left = find(Left);
    Right = find(Right);
    if (Left == Right)
      return;
    if (Rank[Left] < Rank[Right])
      std::swap(Left, Right);
    Parent[Right] = Left;
    if (Rank[Left] == Rank[Right])
      ++Rank[Left];
  }

private:
  std::vector<size_t> Parent;
  std::vector<unsigned> Rank;
};

Metrics measureBlocks(const std::vector<const BasicBlock *> &Blocks) {
  Metrics Result;
  if (Blocks.empty())
    return Result;

  DenseMap<const BasicBlock *, size_t> BlockIndexes;
  for (size_t Index = 0; Index < Blocks.size(); ++Index)
    BlockIndexes[Blocks[Index]] = Index;

  DisjointSet Components(Blocks.size());
  uint64_t Edges = 0;

  for (const BasicBlock *Block : Blocks) {
    Result.Instructions += Block->size();
    ++Result.BasicBlocks;

    for (const Instruction &Instruction : *Block) {
      if (Instruction.mayReadOrWriteMemory())
        ++Result.MemoryOperations;
    }

    if (Block->getTerminator() == nullptr)
      continue;
    if (succ_begin(Block) != succ_end(Block))
      ++Result.Branches;

    const size_t Source = BlockIndexes.lookup(Block);
    for (const BasicBlock *Successor : successors(Block)) {
      const auto SuccessorIndex = BlockIndexes.find(Successor);
      if (SuccessorIndex == BlockIndexes.end())
        continue;
      ++Edges;
      Components.unite(Source, SuccessorIndex->second);
    }
  }

  uint64_t ComponentCount = 0;
  for (size_t Index = 0; Index < Blocks.size(); ++Index) {
    if (Components.find(Index) == Index)
      ++ComponentCount;
  }

  const int64_t Complexity = static_cast<int64_t>(Edges) -
                             static_cast<int64_t>(Blocks.size()) +
                             static_cast<int64_t>(2 * ComponentCount);
  Result.CyclomaticComplexity =
      static_cast<uint64_t>(std::max<int64_t>(Complexity, 1));
  return Result;
}

Metrics measureFunctions(const std::vector<const Function *> &Functions) {
  Metrics Result;
  for (const Function *Function : Functions) {
    if (Function == nullptr || Function->isDeclaration())
      continue;
    std::vector<const BasicBlock *> Blocks;
    Blocks.reserve(Function->size());
    for (const BasicBlock &Block : *Function)
      Blocks.push_back(&Block);
    const Metrics FunctionMetrics = measureBlocks(Blocks);
    Result.Instructions += FunctionMetrics.Instructions;
    Result.MemoryOperations += FunctionMetrics.MemoryOperations;
    Result.BasicBlocks += FunctionMetrics.BasicBlocks;
    Result.Branches += FunctionMetrics.Branches;
    Result.CyclomaticComplexity += FunctionMetrics.CyclomaticComplexity;
  }
  return Result;
}

std::optional<Metrics> measureIrUnit(Any IrUnit) {
  if (any_isa<const Module *>(IrUnit)) {
    const Module *ModulePointer = any_cast<const Module *>(IrUnit);
    std::vector<const Function *> Functions;
    for (const Function &Function : *ModulePointer)
      Functions.push_back(&Function);
    return measureFunctions(Functions);
  }

  if (any_isa<const Function *>(IrUnit))
    return measureFunctions({any_cast<const Function *>(IrUnit)});

  if (any_isa<const Loop *>(IrUnit)) {
    const Loop *LoopPointer = any_cast<const Loop *>(IrUnit);
    std::vector<const BasicBlock *> Blocks;
    for (const BasicBlock *Block : LoopPointer->blocks())
      Blocks.push_back(Block);
    return measureBlocks(Blocks);
  }

  if (any_isa<const LazyCallGraph::SCC *>(IrUnit)) {
    const LazyCallGraph::SCC *SccPointer =
        any_cast<const LazyCallGraph::SCC *>(IrUnit);
    std::vector<const Function *> Functions;
    for (const LazyCallGraph::Node &Node : *SccPointer)
      Functions.push_back(&Node.getFunction());
    return measureFunctions(Functions);
  }

  return std::nullopt;
}

std::vector<const Function *> functionsForIrUnit(Any IrUnit) {
  std::vector<const Function *> Functions;

  if (any_isa<const Module *>(IrUnit)) {
    const Module *ModulePointer = any_cast<const Module *>(IrUnit);
    for (const Function &Function : *ModulePointer) {
      if (!Function.isDeclaration())
        Functions.push_back(&Function);
    }
    return Functions;
  }

  if (any_isa<const Function *>(IrUnit)) {
    const Function *FunctionPointer = any_cast<const Function *>(IrUnit);
    if (!FunctionPointer->isDeclaration())
      Functions.push_back(FunctionPointer);
    return Functions;
  }

  if (any_isa<const Loop *>(IrUnit)) {
    const Loop *LoopPointer = any_cast<const Loop *>(IrUnit);
    const BasicBlock *Header = LoopPointer->getHeader();
    if (Header != nullptr && Header->getParent() != nullptr)
      Functions.push_back(Header->getParent());
    return Functions;
  }

  if (any_isa<const LazyCallGraph::SCC *>(IrUnit)) {
    const LazyCallGraph::SCC *SccPointer =
        any_cast<const LazyCallGraph::SCC *>(IrUnit);
    for (const LazyCallGraph::Node &Node : *SccPointer) {
      const Function &Function = Node.getFunction();
      if (!Function.isDeclaration())
        Functions.push_back(&Function);
    }
  }

  return Functions;
}

std::string blockDisplayName(const BasicBlock &Block) {
  if (Block.hasName())
    return Block.getName().str();
  if (&Block == &Block.getParent()->getEntryBlock())
    return "entry";

  std::string Operand;
  raw_string_ostream Stream(Operand);
  Block.printAsOperand(Stream, false, Block.getParent()->getParent());
  Stream.flush();
  if (!Operand.empty() && Operand.front() == '%')
    Operand.erase(Operand.begin());
  return Operand;
}

std::string stableBlockId(PassCfgFrame &Frame, const BasicBlock &Block) {
  for (const TrackedBlock &Tracked : Frame.Blocks) {
    if (Tracked.Handle == &Block)
      return Tracked.Id;
  }

  std::string Id = "block-" + std::to_string(Frame.NextBlockId++);
  Frame.Blocks.push_back(
      {WeakTrackingVH(const_cast<BasicBlock *>(&Block)), Id});
  return Id;
}

std::string blockLabel(const BasicBlock &Block, StringRef Name) {
  std::string Label = Name.str();
  size_t PreviewCount = 0;

  for (const Instruction &Instruction : Block) {
    if (PreviewCount == 4)
      break;
    std::string Printed;
    raw_string_ostream Stream(Printed);
    Instruction.print(Stream);
    Stream.flush();
    Label.push_back('\n');
    Label.append(StringRef(Printed).trim().str());
    ++PreviewCount;
  }

  if (Label.size() > 1024)
    Label.resize(1024);
  return Label;
}

FunctionCfg captureCfg(const Function &Function, PassCfgFrame &Frame) {
  FunctionCfg Result;
  Result.FunctionName = Function.getName().str();

  DenseMap<const BasicBlock *, std::string> BlockIds;
  for (const BasicBlock &Block : Function)
    BlockIds[&Block] = stableBlockId(Frame, Block);

  Result.Nodes.reserve(Function.size());
  for (const BasicBlock &Block : Function) {
    const std::string Id = BlockIds.lookup(&Block);
    const std::string DisplayName = blockDisplayName(Block);
    Result.Nodes.push_back({Id, blockLabel(Block, DisplayName)});

    if (Block.getTerminator() == nullptr)
      continue;
    for (const BasicBlock *Successor : successors(&Block))
      Result.Edges.push_back({Id, BlockIds.lookup(Successor)});
  }

  return Result;
}

std::string hexEncode(StringRef Value) {
  static constexpr char Digits[] = "0123456789abcdef";
  std::string Encoded;
  Encoded.reserve(Value.size() * 2);
  for (const char Character : Value) {
    const auto Byte = static_cast<unsigned char>(Character);
    Encoded.push_back(Digits[Byte >> 4]);
    Encoded.push_back(Digits[Byte & 0x0f]);
  }
  return Encoded;
}

void printCfg(char Phase, StringRef PassId, Any IrUnit, PassCfgFrame &Frame) {
  for (const Function *Function : functionsForIrUnit(IrUnit)) {
    const FunctionCfg Graph = captureCfg(*Function, Frame);
    outs() << "C\t" << Phase << '\t' << hexEncode(PassId) << '\t'
           << hexEncode(Graph.FunctionName) << '\n';
    for (const CfgNode &Node : Graph.Nodes)
      outs() << "N\t" << hexEncode(Node.Id) << '\t'
             << hexEncode(Node.Label) << '\n';
    for (const CfgEdge &Edge : Graph.Edges)
      outs() << "E\t" << hexEncode(Edge.Source) << '\t'
             << hexEncode(Edge.Target) << '\n';
    outs() << "Z\n";
  }
}

void printMetrics(char Phase, StringRef PassId, Any IrUnit) {
  const std::optional<Metrics> Value = measureIrUnit(IrUnit);
  if (!Value)
    return;

  outs() << Phase << '\t' << PassId << '\t' << Value->Instructions << '\t'
         << Value->MemoryOperations << '\t' << Value->BasicBlocks << '\t'
         << Value->Branches << '\t' << Value->CyclomaticComplexity << '\n';
}

void printModuleMetrics(char Phase, StringRef PassId, const Module &Module) {
  std::vector<const Function *> Functions;
  for (const Function &Function : Module)
    Functions.push_back(&Function);
  const Metrics Value = measureFunctions(Functions);
  outs() << Phase << '\t' << PassId << '\t' << Value.Instructions << '\t'
         << Value.MemoryOperations << '\t' << Value.BasicBlocks << '\t'
         << Value.Branches << '\t' << Value.CyclomaticComplexity << '\n';
}

void printPreservation(const PreservedAnalyses &Preserved) {
  outs() << "P\t" << (Preserved.areAllPreserved() ? "all" : "not-all")
         << '\n';
}

void printSyntheticModulePass(StringRef PassId, const Module &ModuleValue) {
  PassCfgFrame Frame{PassId.str()};
  printModuleMetrics('B', PassId, ModuleValue);
  printCfg('B', PassId, Any(static_cast<const Module *>(&ModuleValue)), Frame);
  outs() << "P\tall\n";
  printCfg('A', PassId, Any(static_cast<const Module *>(&ModuleValue)), Frame);
  printModuleMetrics('A', PassId, ModuleValue);
}

} // namespace

// Maps an `opt`-style level flag to the matching OptimizationLevel constant.
// Must be run with the same level as the `opt` invocation that produced the
// dump log being measured, or pass events will not align with the dumps.
static std::optional<OptimizationLevel> parseOptimizationLevel(StringRef Level) {
  if (Level == "O0") return OptimizationLevel::O0;
  if (Level == "O1") return OptimizationLevel::O1;
  if (Level == "O2") return OptimizationLevel::O2;
  if (Level == "O3") return OptimizationLevel::O3;
  if (Level == "Os") return OptimizationLevel::Os;
  if (Level == "Oz") return OptimizationLevel::Oz;
  return std::nullopt;
}

int main(int ArgumentCount, char **Arguments) {
  if (ArgumentCount != 3) {
    errs() << "usage: llvm-ir-metrics <original-ir> <O0|O1|O2|O3|Os|Oz>\n";
    return 2;
  }

  std::optional<OptimizationLevel> Level = parseOptimizationLevel(Arguments[2]);
  if (!Level) {
    errs() << "invalid optimisation level: " << Arguments[2] << '\n';
    return 2;
  }

  LLVMContext Context;
  SMDiagnostic Diagnostic;
  std::unique_ptr<Module> Module = parseIRFile(Arguments[1], Diagnostic, Context);
  if (!Module) {
    Diagnostic.print("llvm-ir-metrics", errs());
    return 2;
  }

  PassInstrumentationCallbacks InstrumentationCallbacks;
  std::vector<PassCfgFrame> CfgFrames;
  InstrumentationCallbacks.registerBeforeNonSkippedPassCallback(
      [&](StringRef PassId, Any IrUnit) {
        CfgFrames.push_back({PassId.str()});
        printMetrics('B', PassId, IrUnit);
        printCfg('B', PassId, IrUnit, CfgFrames.back());
      });
  InstrumentationCallbacks.registerAfterPassCallback(
      [&](StringRef PassId, Any IrUnit,
          const PreservedAnalyses &Preserved) {
        printPreservation(Preserved);
        if (!CfgFrames.empty() && CfgFrames.back().PassId == PassId)
          printCfg('A', PassId, IrUnit, CfgFrames.back());
        printMetrics('A', PassId, IrUnit);
        if (!CfgFrames.empty())
          CfgFrames.pop_back();
      });
  InstrumentationCallbacks.registerAfterPassInvalidatedCallback(
      [&](StringRef PassId, const PreservedAnalyses &Preserved) {
        printPreservation(Preserved);
        outs() << "X\t" << PassId << '\n';
        if (!CfgFrames.empty())
          CfgFrames.pop_back();
      });
  InstrumentationCallbacks.registerBeforeAnalysisCallback(
      [](StringRef AnalysisId, Any) { outs() << "D\t" << AnalysisId << '\n'; });

  LoopAnalysisManager LoopAnalyses;
  FunctionAnalysisManager FunctionAnalyses;
  CGSCCAnalysisManager CgsccAnalyses;
  ModuleAnalysisManager ModuleAnalyses;

  // A default-constructed PipelineTuningOptions leaves SLPVectorization off;
  // the `opt` CLI enables it explicitly for every level unless the user opts
  // out. Without this, SLPVectorizerPass is silently missing from the built
  // pipeline at O2/O3/Os, so its dumps in the `opt` log never get a matching
  // measurement event.
  PipelineTuningOptions TuningOptions;
  TuningOptions.SLPVectorization = true;

  PassBuilder Builder(nullptr, TuningOptions, None, &InstrumentationCallbacks);

  FunctionAnalyses.registerPass([&] { return Builder.buildDefaultAAPipeline(); });
  Builder.registerModuleAnalyses(ModuleAnalyses);
  Builder.registerCGSCCAnalyses(CgsccAnalyses);
  Builder.registerFunctionAnalyses(FunctionAnalyses);
  Builder.registerLoopAnalyses(LoopAnalyses);
  Builder.crossRegisterProxies(LoopAnalyses, FunctionAnalyses, CgsccAnalyses,
                               ModuleAnalyses);

  // `PassBuilder::buildPerModuleDefaultPipeline` does not special-case O0 in
  // this LLVM version - it silently builds the full optimisation pipeline
  // regardless of level. `opt`'s own `default<O0>` pipeline text is handled by
  // `buildO0DefaultPipeline` instead, so this collector must dispatch the same
  // way or its measured events will not correspond to the O0 dump log at all.
  ModulePassManager Pipeline =
      *Level == OptimizationLevel::O0
          ? Builder.buildO0DefaultPipeline(*Level)
          : Builder.buildPerModuleDefaultPipeline(*Level);
  // The opt driver wraps textual pipelines with these utility passes. They do
  // not appear in PassBuilder's pipeline, but they do appear in
  // -print-before-all/-print-after-all output and leave the module unchanged.
  printSyntheticModulePass("VerifierPass", *Module);
  Pipeline.run(*Module, ModuleAnalyses);
  printSyntheticModulePass("VerifierPass", *Module);
  printSyntheticModulePass("PrintModulePass", *Module);
  return 0;
}
