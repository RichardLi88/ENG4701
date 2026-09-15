# Compiler optimisation user study: programs, questions and answer key

Ground truth in this document was computed by `scripts/verify-trace.py`, which runs
`clang-14` and `opt-14` directly and parses the dump log itself. It shares no code with
the application. The application was then checked against it; disagreements are recorded
in [Discrepancies](#discrepancies) rather than folded into the answer key.

## Environment (read this before reusing any number)

| | |
|---|---|
| Toolchain | Ubuntu clang 14.0.0-1ubuntu1.1, LLVM 14.0.0 |
| Target | `aarch64-unknown-linux-gnu` |
| Where | Inside the pinned `ENG4701-llvm-service` container |

**The brief specifies LLVM 14.0.6; the pinned service is 14.0.0, on aarch64.** Pass counts
and orders below differ from the brief's figures for that reason and are the authoritative
numbers for this environment. Re-run `verify-trace.py` if the container image changes.

Pipeline replicated per program and level:

```bash
clang-14 -O0 -Xclang -disable-O0-optnone -S -emit-llvm <src> -o <ir>
# strip noinline from attribute groups and "; Function Attrs:" comments
opt-14 -passes="default<LEVEL>" -print-before-all -print-after-all -S <ir> -o <out>
```

Dumps are paired as adjacent Before/After with the same full pass name and non-empty IR
on both sides. Unpaired dumps are dropped.

## Per-program measurements

`last` is the zero-based order of the final pass that changed the IR; `%` is that position
as a fraction of the pipeline. Every metric in the application came back `estimated: false`
for every program that loads.

| Program | Level | Passes | Changed | Last change | % | Log lines | Log size |
|---|---|---|---|---|---|---|---|
| `accumulate.c` | O1 | 92 | 16 | 53 | 59% | 5,044 | 177 KB |
| `accumulate.c` | O2 | 105 | 17 | 58 | 56% | 5,556 | 193 KB |
| `classify.c` | O1 | 83 | 4 | 22 | 28% | 2,175 | 87 KB |
| `classify.c` | O2 | 96 | 4 | 22 | 24% | 2,305 | 93 KB |
| `constfold.c` | O1 | 83 | 4 | 22 | 28% | 1,955 | 79 KB |
| `constfold.c` | O2 | 96 | 4 | 22 | 24% | 2,085 | 84 KB |
| `deadLoop.c` | O1 | 92 | 9 | 53 | 59% | 3,275 | 117 KB |
| `deadLoop.c` | O2 | 105 | 9 | 53 | 51% | 3,495 | 125 KB |
| `deadstore.c` | O1 | 83 | 4 | 22 | 28% | 1,925 | 79 KB |
| `deadstore.c` | O2 | 96 | 4 | 22 | 24% | 2,055 | 85 KB |
| `mixBits.c` | O1 | 83 | 5 | 22 | 28% | 4,180 | 145 KB |
| `mixBits.c` | O2 | 110 | 27 | 101 | 93% | 5,919 | 229 KB |
| `scaleArray.c` | O1 | 96 | 17 | 87 | 92% | 5,742 | 225 KB |
| `scaleArray.c` | O2 | 111 | 22 | 102 | 93% | 8,273 | 351 KB |
| `sumArray.c` | O1 | 96 | 24 | 87 | 92% | 5,857 | 235 KB |
| `sumArray.c` | O2 | 111 | 30 | 102 | 93% | 8,313 | 355 KB |
| `sumTo.c` | O1 | 83 | 5 | 22 | 28% | 3,835 | 136 KB |
| `sumTo.c` | O2 | 105 | 16 | 58 | 56% | 5,601 | 199 KB |

Sources are in `study/programs/`, logs in `study/logs/<program>.<level>.log` (18 files,
3.0 MB total), unmodified `opt` stderr.

**Programs are 6–11 lines, not the 15–40 the brief asks for.** The three known-good
programs supplied in the brief are 6–7 lines, and padding them would only lengthen traces
that already run to thousands of lines in the raw condition. Length was traded for trace
size deliberately.

### Counterbalancing pairs

Each participant sees one member of a pair per condition, never both.

| RQ | Pair A | Pair B | Matched on |
|---|---|---|---|
| RQ2 | `classify.c` O1 | `deadstore.c` O1 | 4 changed passes, collapses to a constant return, 28% |
| RQ2 | `accumulate.c` O1 | `deadLoop.c` O1 | 92 passes, loop gone from the output, 59% |
| RQ3 | `sumTo.c` O1 vs O2 | `mixBits.c` O1 vs O2 | tail recursion, `TailCallElimPass` at O2 only |
| RQ4 | `classify.c` O1 (28%) | `deadstore.c` O1 (28%) | low-redundancy anchor |
| RQ4 | `sumArray.c` O1 (92%) | `scaleArray.c` O1 (92%) | high-redundancy anchor |

`constfold.c` is a verified spare for RQ2 (identical profile to `deadstore.c`).

---

## Question set

Ten questions: four RQ2, three RQ3, three RQ4. Each names a pass rather than an index.

### RQ2 — identifying transformation behaviour

**Q1. `classify.c`, O1.** *Objective.*
> You wrote an `if`/`else` with two branches. Look at the program after `SimplifyCFGPass`
> has run. How many basic blocks does the function have before that pass, and how many
> after?

**Answer: 4 before, 1 after.** Counterbalance: `deadstore.c` O1, asking the same of
`SROAPass` (1 before, 1 after — the answer is that the block count does not change,
because that pass works on memory slots and not on control flow).

*Raw:* count the `label`/block headers in the Before and After dumps for `SimplifyCFGPass`.
*Tool:* the Basic blocks row of the metrics table, or the two CFG panes.

**Q2. `classify.c`, O1.** *Multiple choice.*
> Both arms of your `if` assign the same value. Which one of these best describes what the
> compiler did with the branch?
> a) It kept both branches but made each one faster.
> b) It removed the branch entirely, because both paths produced the same result.
> c) It unrolled the branch into repeated copies.
> d) It moved the branch outside the function.

**Answer: (b).** The final function body is `ret i32 1`. Distractors are real
optimisations: (a) instruction combining, (c) unrolling, (d) interprocedural motion.

*Raw:* read the last After dump and see the body reduced to `ret i32 1`.
*Tool:* the computed change line reports the block drop, and the final pane shows `ret i32 1`.

**Q3. `accumulate.c`, O1.** *Objective.*
> You wrote a `for` loop. In the finished program, is the loop still there? Name the pass
> that removed it.

**Answer: No, the loop is gone; `LoopDeletionPass` (order 45).** The final IR has no back
edge; the sum is computed with arithmetic. Counterbalance: `deadLoop.c` O1, same answer
and same pass at the same order, reached because nothing reads the result rather than
because a closed form exists.

*Raw:* search the log for `LoopDeletionPass` and compare the Before/After dumps.
*Tool:* the pass timeline shows `loop-deletion` with a CHANGED badge; its description says
what loop deletion does in general, and the participant must connect that to their loop.

**Q4. `accumulate.c`, O1.** *Free text.*
> In one or two sentences, explain what the finished program does differently from the
> loop you wrote, and why it still gives the same answer.

**Answer:** accept any response conveying that the loop was replaced by a direct
calculation (closed form / formula / arithmetic) that produces the same total without
iterating. Reject answers claiming the loop was made faster but still runs, that iterations
were merged or unrolled, or that the result changed.

*Raw:* compare the first and last dumps.
*Tool:* the whole-program before/after view, plus the loop-deletion description.

### RQ3 — comparative reasoning across levels

Two browser windows, `sumTo.c` at O1 and at O2.

**Q5. `sumTo.c`, O1 vs O2.** *Objective.*
> You wrote a function that calls itself. In which of the two runs does the finished
> program still call itself, and in which does it not?

**Answer: the recursive call survives at O1 and is gone at O2.** Verified: one
`call i32 @sumTo` in the O1 final IR, zero at O2. Counterbalance: `mixBits.c`.

*Raw:* search each final dump for `call i32 @sumTo`.
*Tool:* the whole-program before/after view in each window.

**Q6. `sumTo.c`, O1 vs O2.** *Objective.*
> Name the pass that is responsible for that difference.

**Answer: `TailCallElimPass`** (shown as `tail-call-elim`), which changed the IR at O2
order 32. It does not appear anywhere in the O1 pipeline.

*Raw:* diff the two lists of `*** IR Dump Before ... ***` pass names.
*Tool:* search the pass list in each window; it is present and CHANGED in one, absent in
the other.

**Q7. `sumTo.c`, O1 vs O2.** *Multiple choice.*
> Why does the higher level manage this when the lower one does not?
> a) The higher level runs a pass the lower one does not run at all.
> b) The higher level runs the same passes but repeats them more often.
> c) The lower level ran the same pass but it decided not to change anything.
> d) The lower level removed the recursion earlier, so nothing was left to do.

**Answer: (a).** `TailCallElimPass` has zero dumps at O1 and one at O2. (c) is the
plausible misconception this item is designed to catch — it is true of `LoopVectorizePass`
in these same traces, which runs at both levels and only changes the program at O2.

*Raw:* count dump headers per pass name in both logs.
*Tool:* the pass list shows presence, and the CHANGED / NO CHANGE badge separates "ran and
did nothing" from "did not run".

### RQ4 — judging redundancy

**Q8. `classify.c`, O1.** *Band estimate.*
> This run is 83 passes long. Roughly how far through does the program stop changing at
> all? Give your answer as a percentage of the run.

**Answer: 28%** (last change at order 22 of 83). **Accept 20–35%.** Counterbalance:
`deadstore.c` O1, same answer and band.

*Raw:* find the last pair of dumps that differ.
*Tool:* filter the timeline to Changed and read the position of the last entry.

**Q9. `sumArray.c`, O1.** *Band estimate.*
> Same question for this run, which is 96 passes long.

**Answer: 92%** (last change at order 87 of 96). **Accept 80–100%.** Counterbalance:
`scaleArray.c` O1, same answer and band.

The Q8/Q9 pair is the discriminating item: 28% against 92% means a participant guessing a
constant scores well on one and badly on the other.

**Q10. `sumArray.c`, O1.** *Objective.*
> Of the 96 passes in this run, how many changed the program at all?

**Answer: 24.** **Accept 22–26** to allow for miscounting in the raw condition.
Counterbalance: `scaleArray.c` O1, answer **17**, accept 15–19.

*Raw:* compare every Before/After pair in a 5,857-line log.
*Tool:* the Changed filter count in the sidebar.

---

## Discrepancies

### D1 — Service cannot load any trace containing a vectorised loop (blocking)

`POST /optimise-structured` returns HTTP 500 with
`{"error":"LLVM could not measure dump snapshots 194, 195"}`.

Reproduces on `sumArray.c` O2, `scaleArray.c` O2, `countPositive.c` O2, `countDown.c` O2
and `nestedSum.c` at both levels. In `sumArray.c` O2 the two unmeasurable dumps are the
`LICMPass` loop-scope dumps around the `%vector.body` loop; `nestedSum.c` O1 fails on 86
dumps. Every failing trace contains vector types in its final IR, and every program
without them loads.

The service is behaving as designed in refusing rather than substituting estimates — the
defect is in `llvm-ir-metrics` failing to measure loop-scope dumps of vectorised loops.

**Study impact:** this is why RQ3 uses `sumTo.c` and `mixBits.c` rather than the
vectorisation contrast the brief proposed. Vectorisation is the most visible O1/O2
difference available, and it is currently unusable in the tool condition. `sumArray.c` and
`scaleArray.c` are used at O1 only, where they load.

### D2 — Brief's reference figures do not reproduce

Not an application bug; recorded so the older numbers are not reused.

| Program | Brief | Measured here |
|---|---|---|
| `classify.c` O1 | 83 passes, 4 changed, last 22 | matches exactly |
| `accumulate.c` O1 | 92 passes, 16 changed, last 53 | matches exactly |
| `sumArray.c` O1 | 97 passes, 24 changed, last 88 (91%) | 96 passes, 24 changed, last 87 (92%) |
| `sumArray.c` O2 | 112 passes, 30 changed, last 103 | 111 passes, 30 changed, last 102 |
| `sumArray.c` | `loop-vectorize` absent at O1 | **present at both levels**; changes the IR only at O2 (order 70) |

The last row matters for question design: "which pass runs only at O2" would have had a
wrong expected answer. The passes that genuinely run only at O2 are
`CorrelatedValuePropagationPass`, `DSEPass`, `GVNPass`, `JumpThreadingPass`,
`MergedLoadStoreMotionPass`, `OpenMPOptCGSCCPass`, `SLPVectorizerPass`,
`SpeculativeExecutionPass` and `TailCallElimPass`.

### D3 — `verify-trace.py` did not exist

The brief states a comparison script is in the repo. It is not, and never has been on any
branch. `scripts/verify-trace.py` was written for this task.

### Non-discrepancies (checked, agree)

For all nine selected programs at both levels, excluding the D1 failures, the application
agrees with ground truth on pass count, pass order, full pass names and the `changed` flag
for every pass, and reports `estimated: false` on every metric.

### Caveat on one pass, not a disagreement

When a loop pass deletes its loop, LLVM appends ` (invalidated)` to the scope of the After
dump and prints the **whole module** where the Before dump printed **only the loop**. The
application pairs these, correctly per the documented rule. But the two sides describe
different units, so the reported before/after deltas for `LoopDeletionPass` compare a loop
against a module and are not meaningful — in `accumulate.c` O1 the block count reads
0 → 4 even though the pass removed code. Q3 therefore asks participants to name the pass,
not to read its metrics.
