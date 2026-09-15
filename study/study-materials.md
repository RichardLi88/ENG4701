# Compiler optimisation user study: programs, questions and answer key

Ground truth is computed by `scripts/verify-trace.py`, which runs `clang-14` and `opt-14`
directly and parses the dump log itself. It shares no code with the application. The
application is then checked against it; disagreements are recorded in
[Discrepancies](#discrepancies) rather than folded into the answer key.

Regenerate and re-check everything:

```bash
for f in study/programs/*.c; do for l in O1 O2; do
  python3 scripts/verify-trace.py run "$f" --level $l
  python3 scripts/verify-trace.py check "$f" --level $l
done; done
```

## Environment

| | |
|---|---|
| Toolchain | Ubuntu clang 14.0.0-1ubuntu1.1, LLVM 14.0.0 |
| Target triple | `aarch64-unknown-linux-gnu` |
| Where | Inside the pinned `ENG4701-llvm-service` container |

**This answer key is valid only for `aarch64-unknown-linux-gnu`.** Pass counts are
target-specific, and `verify-trace.py check` fails if the application's trace was produced
on a different target. See [D2](#d2--the-key-is-target-specific-resolved).

Pipeline replicated per program and level:

```bash
clang-14 -O0 -Xclang -disable-O0-optnone -S -emit-llvm <src> -o <ir>
# strip noinline from attribute groups and "; Function Attrs:" comments
opt-14 -passes="default<LEVEL>" -print-before-all -print-after-all -S <ir> -o <out>
```

Dumps are paired as adjacent Before/After with the same full pass name and non-empty IR
on both sides. Unpaired dumps are dropped.

## How the programs map to questions

Every question belongs to exactly one program, chosen so that the thing being asked about
is visible in the C source without any compiler knowledge. Participants are only briefed
on three ideas: a pass is one step that rewrites the program, a basic block is a
straight-line chunk of code, and the before/after panes show the program at that step.

Each row is a **matched pair**: set A in one condition, set B in the other, so a
participant never sees the same trace twice.

| Questions | Set A | Set B | Why a non-expert can answer it |
|---|---|---|---|
| RQ2 Q1, Q2 · RQ4 Q8 | `classify.c` O1 | `grade.c` O1 | Both arms of the `if` are visibly identical, so the branch is obviously pointless |
| RQ2 Q3, Q4 | `accumulate.c` O1 | `deadLoop.c` O1 | "You wrote a loop — is it still there?" needs no IR reading |
| RQ3 Q5, Q6, Q7 | `sumTo.c` O1 vs O2 | `mixBits.c` O1 vs O2 | "Does the function still call itself?" is visible in the source |
| RQ4 Q9, Q10 | `sumArray.c` O1 | `scaleArray.c` O1 | Counting tasks; the program only has to be simple, not deep |

## Measurements

`last` is the zero-based order of the final pass that changed the IR; `%` is that position
as a fraction of the run. Every metric came back `estimated: false`, and the application
agrees with ground truth on all ten traces.

| Program | Level | Passes | Changed | Last change | % | Log lines | Log size |
|---|---|---|---|---|---|---|---|
| `classify.c` | O1 | 83 | 4 | 22 | 28% | 2,175 | 87 KB |
| `grade.c` | O1 | 83 | 5 | 22 | 28% | 2,175 | 86 KB |
| `accumulate.c` | O1 | 92 | 16 | 53 | 59% | 5,044 | 177 KB |
| `deadLoop.c` | O1 | 92 | 9 | 53 | 59% | 3,275 | 117 KB |
| `sumTo.c` | O1 | 83 | 5 | 22 | 28% | 3,835 | 136 KB |
| `sumTo.c` | O2 | 105 | 16 | 58 | 56% | 5,601 | 199 KB |
| `mixBits.c` | O1 | 83 | 5 | 22 | 28% | 4,180 | 145 KB |
| `mixBits.c` | O2 | 110 | 27 | 101 | 93% | 5,919 | 229 KB |
| `sumArray.c` | O1 | 96 | 24 | 87 | 92% | 5,857 | 235 KB |
| `scaleArray.c` | O1 | 96 | 17 | 87 | 92% | 5,742 | 225 KB |

Key passes for the answer key:

- `classify.c` / `grade.c` O1: `SimplifyCFGPass`@16 takes the function from **4 basic
  blocks to 1**; the final body is `ret i32 1` / `ret i32 2`.
- `accumulate.c` / `deadLoop.c` O1: `LoopDeletionPass`@45 removes the loop; neither final
  function has a back edge. `deadLoop.c` ends as `ret i32 7`.
- `sumTo.c` / `mixBits.c`: `TailCallElimPass` does not run at all at O1 (zero dumps) and
  changes the IR at O2 order 32. `LoopVectorizePass` runs at **both** levels in both
  programs and changes nothing in either — the basis of the Q7 distractor.

Sources are in `study/programs/`, logs in `study/logs/<program>.<level>.log` (10 files,
1.6 MB), unmodified `opt` stderr.

**The programs are 9–11 lines, not the 15–40 the brief asks for.** The known-good programs
supplied in the brief are 6–7 lines, and padding would only lengthen traces that already
run to thousands of lines in the raw condition.

---

## Question set

Ten questions: four RQ2, three RQ3, three RQ4. Each names a pass rather than an index.
Answers are given for both sets; a participant sees one.

### RQ2 — identifying transformation behaviour

**Q1. `classify.c` O1 / `grade.c` O1. Objective.**
> Both branches of your `if` do the same thing. Look at the step called `SimplifyCFGPass`.
> How many basic blocks does the function have going in, and how many coming out?

**Answer (both sets): 4 going in, 1 coming out.**

*Raw:* count the block labels in the Before and After dumps for `SimplifyCFGPass`.
*Tool:* the Basic blocks row of the metrics table, or the two CFG panes side by side.

**Q2. `classify.c` O1 / `grade.c` O1. Multiple choice.**
> Which one best describes what that step did?
> a) It made each branch faster but kept both of them.
> b) It removed the choice entirely, because both paths did the same thing.
> c) It repeated the branch body several times to save work later.
> d) It moved the branch out into whoever calls this function.

**Answer: (b).** The finished function is `ret i32 1` (set A) / `ret i32 2` (set B).
Distractors are all real optimisations: (a) instruction combining, (c) unrolling,
(d) interprocedural code motion.

**Q3. `accumulate.c` O1 / `deadLoop.c` O1. Objective.**
> You wrote a `for` loop. In the finished program, is the loop still there? Name the step
> that removed it.

**Answer (both sets): no, the loop is gone; `LoopDeletionPass`, at order 45.** Neither
final function has a back edge.

*Raw:* search the log for `LoopDeletionPass` and compare its Before and After dumps.
*Tool:* the pass timeline shows `loop-deletion` with a CHANGED badge; its description
explains what loop deletion does in general and the participant connects that to their loop.

**Q4. `accumulate.c` O1 / `deadLoop.c` O1. Free text.**
> In one or two sentences, say what the finished program does instead of your loop, and
> why it still gives the right answer.

**`accumulate.c`:** accept any answer conveying that the repeated adding was replaced by a
direct calculation that produces the same total without looping.
**`deadLoop.c`:** accept any answer conveying that the loop was dropped because nothing
used what it computed, so the function just returns 7.
Reject, for both, answers claiming the result changed, or that the loop was merely made
faster and still runs.

This is the pair where the two sets have genuinely different answers, so a participant
cannot carry one across conditions.

### RQ3 — comparative reasoning (two windows, O1 and O2 of the same program)

**Q5. `sumTo.c` / `mixBits.c`, O1 vs O2. Objective.**
> You wrote a function that calls itself. In which of the two runs does the finished
> program still call itself?

**Answer (both sets): it still calls itself at O1; at O2 it does not.** Verified: one
self-call in the O1 final IR, zero at O2.

*Raw:* search each final dump for the self-call.
*Tool:* the whole-program before and after view in each window.

**Q6. `sumTo.c` / `mixBits.c`, O1 vs O2. Objective.**
> Name the step responsible for that difference.

**Answer (both sets): `TailCallElimPass`** (shown as `tail-call-elim`). It changed the
program at O2 order 32 and does not run at all at O1.

*Raw:* diff the two lists of `*** IR Dump Before ... ***` names.
*Tool:* search the pass list in each window — present and CHANGED in one, absent in the other.

**Q7. `sumTo.c` / `mixBits.c`, O1 vs O2. Multiple choice.**
> Why does the higher setting manage this when the lower one does not?
> a) The higher setting runs a step that the lower one never runs at all.
> b) The higher setting runs the same steps but goes round them more times.
> c) The lower setting ran the same step, but it chose not to change anything.
> d) The lower setting had already removed the self-call earlier on.

**Answer: (a).** `TailCallElimPass` has zero dumps at O1 and one at O2. Option (c) is the
misconception this item exists to catch, and it is not a straw man: it is exactly what
`LoopVectorizePass` does in these same two traces, running at both levels and changing
nothing at either.

*Raw:* count dump headers per step name in both logs.
*Tool:* the pass list shows presence, and the CHANGED / NO CHANGE badge separates "ran and
did nothing" from "never ran".

### RQ4 — judging redundancy

**Q8. `classify.c` O1 / `grade.c` O1. Band estimate.**
> This run is 83 steps long. Roughly how far through does the program stop changing at
> all? Answer as a percentage.

**Answer (both sets): 28%** — last change at order 22 of 83. **Accept 20–35%.**

**Q9. `sumArray.c` O1 / `scaleArray.c` O1. Band estimate.**
> Same question for this run, which is 96 steps long.

**Answer (both sets): 92%** — last change at order 87 of 96. **Accept 80–100%.**

Q8 and Q9 are the discriminating pair: 28% against 92%, so a participant who guesses a
constant scores well on one and badly on the other.

**Q10. `sumArray.c` O1 / `scaleArray.c` O1. Objective.**
> Of the 96 steps in this run, how many changed the program at all?

**`sumArray.c`: 24.** **Accept 22–26.**
**`scaleArray.c`: 17.** **Accept 15–19.**
The band allows for miscounting across a 5,700–5,900 line log in the raw condition.

*Raw:* compare every Before/After pair in the log.
*Tool:* the Changed filter count in the sidebar.

---

## Discrepancies

### D1 — Traces containing a vectorised loop could not be loaded (fixed)

**Symptom.** `POST /optimise-structured` returned HTTP 500 with
`LLVM could not measure dump snapshots 194, 195`. It reproduced on every program whose O2
trace contained vector types and on none that did not.

**Root cause.** `llvm-ir-metrics` built its pipeline with `PassBuilder(nullptr, ...)` — no
`TargetMachine`. Without one the pipeline gets only default `TargetTransformInfo`, so the
loop vectoriser cannot know the target's vector width and quietly declines to vectorise.
`opt` builds a `TargetMachine` from the module triple and does vectorise. The two pipelines
therefore diverged: on `sumArray.c` at O2, `opt` ran `LICMPass` five times, over the extra
`%vector.body` loop, while the collector ran it four. The fifth pair of dumps had no
measurement, and the service correctly refused rather than substituting estimates.

**Fix** (commit `fd24b3b`). `llvm-service/llvm-ir-metrics.cpp` derives a `TargetMachine`
from the module triple and passes it to `PassBuilder`; `dockerfile.llvm` links the native
target libraries. `LICMPass` invocations went 4 → 5, matching `opt`.

**Verified after the fix.** All five previously failing traces load and agree with ground
truth (`sumArray.c` O2, `scaleArray.c` O2, `countPositive.c` O2, `countDown.c` O2).

**Residual, one program.** A doubly nested loop (`nestedSum.c`, measured during selection
and not used in the study) still fails, now in the opposite direction: the collector runs
`LICMPass` six times where `opt` runs it five. The likeliest remaining cause is that the
collector's `TargetMachine` uses default `TargetOptions` rather than the code-generation
flag defaults `opt` applies, leaving unroll decisions on a nested loop slightly different.
Worth filing separately; it does not affect the study.

### D2 — The key is target-specific (resolved)

The brief's reference figures did not reproduce. The cause is **target architecture, not
LLVM version**: recompiling `sumArray.c` with `--target=x86_64-unknown-linux-gnu` in the
same container gives 97 passes at O1 and 112 at O2, matching the brief exactly, where
aarch64 gives 96 and 111. The 14.0.0-versus-14.0.6 difference is a red herring.

**This matters for running the study, not just for bookkeeping:** an answer key is valid
only for the architecture the participants' machine runs. `verify-trace.py check` records
the ground-truth triple and reports a discrepancy if the application's trace carries a
different one, so a key regenerated on another machine cannot silently disagree. If the
study runs on x86-64, regenerate rather than reusing the table above.

One factual correction that would otherwise have produced a wrong key: `LoopVectorizePass`
is **not** absent at O1 as the brief states. It runs at both levels and only changes the
program at O2. A question asking "which pass runs only at O2" would have been marked
against a wrong answer; Q7 uses this as its strongest distractor instead.

### D3 — `verify-trace.py` did not exist

The brief states a comparison script is in the repo. It is not, and never has been on any
branch. `scripts/verify-trace.py` was written for this task. Writing it surfaced two bugs
in its own parser before it produced anything trustworthy: pass names carry template
arguments with spaces (`RequireAnalysisPass<llvm::GlobalsAA, llvm::Module>`) and loop
scopes are prose (`Parallel Loop at depth 1 containing: %2<header>`), so a header regex
built on non-space runs silently swallowed those dumps into the previous body and shifted
every later pairing. The first run reported `classify.c` as 78 passes with an analysis pass
apparently rewriting the IR; after the fix it reproduced the brief exactly.

### Non-discrepancies (checked, agree)

For all ten traces the application agrees with ground truth on pass count, pass order, full
pass names, the `changed` flag for every pass, and the target triple, and reports
`estimated: false` on every metric.

### Caveat on one pass, not a disagreement

When a loop pass deletes its loop, LLVM appends ` (invalidated)` to the scope of the After
dump and prints the **whole module** where the Before dump printed **only the loop**. The
application pairs these, correctly per the documented rule, but the two sides describe
different IR units, so the deltas reported for `LoopDeletionPass` compare a loop against a
module and are not meaningful. This affects `LoopDeletionPass`@45 in `accumulate.c` and
`deadLoop.c`. Q3 therefore asks participants to name that pass, never to read its metrics.
