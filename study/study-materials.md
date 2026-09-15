# Compiler optimisation user study: programs, questions and answer key

Ground truth is computed by `scripts/verify-trace.py`, which runs `clang-14` and `opt-14`
directly and parses the dump log itself. It shares no code with the application. The
application is then checked against it; disagreements are recorded in
[Discrepancies](#discrepancies) rather than folded into the answer key.

Regenerate everything with:

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
target-specific, and `verify-trace.py check` now fails if the application's trace was
produced on a different target. See [D2](#d2--the-key-is-target-specific-resolved).

Pipeline replicated per program and level:

```bash
clang-14 -O0 -Xclang -disable-O0-optnone -S -emit-llvm <src> -o <ir>
# strip noinline from attribute groups and "; Function Attrs:" comments
opt-14 -passes="default<LEVEL>" -print-before-all -print-after-all -S <ir> -o <out>
```

Dumps are paired as adjacent Before/After with the same full pass name and non-empty IR
on both sides. Unpaired dumps are dropped.

## The two programs

Both are tail-recursive and matched in shape, so the same ten questions can be asked of
either. They diverge in where they end up, so a participant who saw one cannot transfer
the answer to the other.

| | `sumTo.c` | `mixBits.c` |
|---|---|---|
| What it computes | sum of 1..n | a bit-mixing fold over 1..n |
| Closed form exists? | yes | no |
| At O1 | recursion intact | recursion intact |
| At O2 | recursion gone **and loop gone** — straight-line arithmetic | recursion gone, **loop remains** (unrolled) |

**Counterbalancing:** a participant does `sumTo.c` in one condition and `mixBits.c` in the
other, never the same program twice. Both support all three research questions.

## Measurements

`last` is the zero-based order of the final pass that changed the IR; `%` is that position
as a fraction of the run. Every metric came back `estimated: false`.

| Program | Level | Passes | Changed | Last change | % | Log lines | Log size |
|---|---|---|---|---|---|---|---|
| `sumTo.c` | O1 | 83 | 5 | 22 | 28% | 3,835 | 136 KB |
| `sumTo.c` | O2 | 105 | 16 | 58 | 56% | 5,601 | 199 KB |
| `mixBits.c` | O1 | 83 | 5 | 22 | 28% | 4,180 | 145 KB |
| `mixBits.c` | O2 | 110 | 27 | 101 | 93% | 5,919 | 229 KB |

Passes that changed the IR:

- **Both programs, O1** (identical): `SROAPass`@6, `GlobalOptPass`@12, `InstCombinePass`@15,
  `SimplifyCFGPass`@16, `PostOrderFunctionAttrsPass`@22.
- **`sumTo.c` O2**: the O1 five, then `TailCallElimPass`@32, `LCSSAPass`@37,
  `LoopRotatePass`@41, `SimplifyCFGPass`@44, `InstCombinePass`@45, `LoopSimplifyPass`@46,
  `LCSSAPass`@47, `IndVarSimplifyPass`@49, **`LoopDeletionPass`@50**, `GVNPass`@53,
  `CorrelatedValuePropagationPass`@58.
- **`mixBits.c` O2**: the O1 five, then `TailCallElimPass`@32 and 21 more through to
  `SimplifyCFGPass`@101, including **`LoopUnrollPass`@90**. No loop deletion.

`TailCallElimPass` does not appear anywhere in the O1 pipeline for either program (zero
dumps). `LoopVectorizePass` **does** run at both levels in both programs and changes
nothing in either — it is the basis of the Q7 distractor.

Sources are in `study/programs/`, logs in `study/logs/<program>.<level>.log` (4 files,
709 KB), unmodified `opt` stderr.

**The programs are 9 lines, not the 15–40 the brief asks for.** The known-good programs
supplied in the brief are 6–7 lines, and padding would only lengthen traces that already
run to thousands of lines in the raw condition.

---

## Question set

Ten questions: four RQ2, three RQ3, three RQ4. Each is asked of whichever program the
participant has, and every one is keyed on a pass name rather than an index.

### RQ2 — identifying transformation behaviour (O2 trace)

**Q1. Objective.**
> You wrote a function that calls itself. Look at the program just after `TailCallElimPass`
> has run. Does it still call itself, and if not, what has taken the place of the call?

**Answer (both programs):** no, the self-call is gone; it has become a loop.
`TailCallElimPass` changed the IR at order 32 in both.

*Raw:* read the Before and After dumps for `TailCallElimPass`.
*Tool:* select `tail-call-elim`; the CHANGED badge and the two IR panes show the call
replaced by a branch back to the top.

**Q2. Multiple choice.**
> Which one best describes what that pass did?
> a) It copied the body of the function into its own caller.
> b) It turned the repetition into a loop, so the function no longer calls itself.
> c) It removed the recursion because the result was never used.
> d) It repeated the body several times to reduce the number of calls.

**Answer: (b).** Distractors are real optimisations: (a) inlining, (c) dead-code
elimination, (d) unrolling — and (d) genuinely happens later in `mixBits.c`, so it is
only wrong as a description of *this* pass.

**Q3. Objective. This is the item that differs between the two programs.**
> Keep going to the end of the run. In the finished program, is there still a loop?

**`sumTo.c`: no.** `LoopDeletionPass` removed it at order 50; the final function is
straight-line arithmetic with no back edge.
**`mixBits.c`: yes.** The loop survives to the end and is unrolled by `LoopUnrollPass` at
order 90.

*Raw:* check the final After dump for a branch back to an earlier label.
*Tool:* the whole-program before/after view, or the CFG of the last changed pass.

**Q4. Free text.**
> In one or two sentences, explain what the finished program does differently from the
> function you wrote, and why it still gives the same answer.

**`sumTo.c`:** accept any answer conveying that the repetition is gone entirely and the
result is now computed directly with arithmetic. **`mixBits.c`:** accept any answer
conveying that the function no longer calls itself but still repeats the work in a loop.
Reject, for both, answers claiming the result changed or that the function was inlined
into its caller.

### RQ3 — comparative reasoning (two windows, O1 and O2 of the same program)

**Q5. Objective.**
> In which of the two runs does the finished program still call itself?

**Answer: O1 yes, O2 no.** Verified: one `call i32 @sumTo` / `@mixBits` in the O1 final
IR, zero at O2.

*Raw:* search each final dump for the self-call.
*Tool:* the whole-program before/after view in each window.

**Q6. Objective.**
> Name the pass responsible for that difference.

**Answer: `TailCallElimPass`** (shown as `tail-call-elim`), which changed the IR at O2
order 32 and does not run at all at O1.

*Raw:* diff the two lists of `*** IR Dump Before ... ***` names.
*Tool:* search the pass list in each window — present and CHANGED in one, absent in the other.

**Q7. Multiple choice.**
> Why does the higher level manage this when the lower one does not?
> a) The higher level runs a pass that the lower one does not run at all.
> b) The higher level runs the same passes but repeats them more often.
> c) The lower level ran the same pass, but it decided not to change anything.
> d) The lower level had already removed the recursion earlier.

**Answer: (a).** `TailCallElimPass` has zero dumps at O1 and one at O2. Option (c) is the
misconception this item is built to catch: it is exactly what `LoopVectorizePass` does in
these same two traces — it runs at both levels and changes nothing at either.

*Raw:* count dump headers per pass name in both logs.
*Tool:* the pass list shows presence; the CHANGED / NO CHANGE badge separates "ran and did
nothing" from "did not run".

### RQ4 — judging redundancy

**Q8. Band estimate, O1 run (83 passes).**
> Roughly how far through this run does the program stop changing at all? Give a percentage.

**Answer (both programs): 28%** — last change at order 22 of 83. **Accept 20–35%.**

**Q9. Band estimate, O2 run.**
> Same question for the O2 run of the same program.

**`sumTo.c`: 56%** — order 58 of 105. **Accept 45–65%.**
**`mixBits.c`: 93%** — order 101 of 110. **Accept 85–100%.**

Q8 and Q9 together are the discriminating items: within one program the answer moves from
28% to either 56% or 93%, so a participant guessing a constant cannot score well on both,
and the two programs disagree with each other at O2.

**Q10. Objective, O2 run.**
> How many of the passes in this run changed the program at all?

**`sumTo.c`: 16** of 105. **Accept 14–18.**
**`mixBits.c`: 27** of 110. **Accept 25–29.**

*Raw:* compare every Before/After pair across a 5,600–5,900 line log.
*Tool:* the Changed filter count in the sidebar.

---

## Discrepancies

### D1 — Traces containing a vectorised loop could not be loaded (fixed)

**Symptom.** `POST /optimise-structured` returned HTTP 500 with
`LLVM could not measure dump snapshots 194, 195`. It reproduced on every program whose O2
trace contained vector types and on none that did not.

**Root cause.** `llvm-ir-metrics` constructed its pipeline with
`PassBuilder Builder(nullptr, ...)` — no `TargetMachine`. Without one the pipeline gets
only default `TargetTransformInfo`, so the loop vectoriser cannot know the target's vector
width and quietly declines to vectorise. `opt` builds a `TargetMachine` from the module
triple and does vectorise. The two pipelines therefore diverged: on `sumArray.c` at O2
`opt` ran `LICMPass` five times, over the extra `%vector.body` loop, while the collector
ran it four times. The fifth pair of dumps had no measurement, and the service correctly
refused rather than substituting estimates.

**Fix.** `llvm-service/llvm-ir-metrics.cpp` now derives a `TargetMachine` from the module
triple and passes it to `PassBuilder`; `dockerfile.llvm` links the native target libraries.
`LICMPass` invocations went 4 → 5, matching `opt`.

**Verified after the fix.** All twelve programs measured during selection now load at both
levels and agree with ground truth, including the five that previously failed
(`sumArray.c` O2, `scaleArray.c` O2, `countPositive.c` O2, `countDown.c` O2).

**Residual, one program.** `nestedSum.c` (a doubly nested loop, not used in the study)
still fails at both levels, now in the opposite direction: the collector runs `LICMPass`
six times where `opt` runs it five. The remaining divergence is most likely that the
collector's `TargetMachine` is built with default `TargetOptions` rather than the
code-generation flag defaults `opt` uses, leaving unroll decisions on a nested loop
slightly different. Worth filing separately; it does not affect the study.

### D2 — The key is target-specific (resolved)

The brief's reference figures did not reproduce. The cause is **target architecture, not
LLVM version**: recompiling `sumArray.c` with `--target=x86_64-unknown-linux-gnu` in the
same container gives 97 passes at O1 and 112 at O2, matching the brief exactly, where
aarch64 gives 96 and 111.

So the brief's numbers were measured on x86-64 and this container runs aarch64. The
14.0.0-versus-14.0.6 difference is a red herring.

**This matters for the study, not just for bookkeeping:** an answer key is only valid for
the architecture the participants' machine runs. `verify-trace.py check` now records the
ground-truth triple and reports a discrepancy if the application's trace carries a
different one, so the key cannot silently drift by being regenerated on another machine.
If the study runs on x86-64 hardware, regenerate rather than reusing the table above.

One factual correction that would have produced a wrong key: `LoopVectorizePass` is **not**
absent at O1 as the brief states. It runs at both levels and only changes the program at
O2. A question asking "which pass runs only at O2" would have been marked against a wrong
answer; Q7 uses this as its strongest distractor instead.

### D3 — `verify-trace.py` did not exist

The brief states a comparison script is in the repo. It is not, and never has been on any
branch. `scripts/verify-trace.py` was written for this task. Writing it surfaced two bugs
in its own parser before it produced anything trustworthy: pass names carry template
arguments with spaces (`RequireAnalysisPass<llvm::GlobalsAA, llvm::Module>`) and loop
scopes are prose (`Parallel Loop at depth 1 containing: %2<header>`), so a header regex
built on non-space runs silently swallowed those dumps into the previous body and shifted
every subsequent pairing. The first run reported `classify.c` as 78 passes with an analysis
pass apparently rewriting the IR; after the fix it reproduced the brief exactly.

### Non-discrepancies (checked, agree)

For both study programs at both levels the application agrees with ground truth on pass
count, pass order, full pass names, the `changed` flag for every pass, and the target
triple, and reports `estimated: false` on every metric.

### Caveat on one pass, not a disagreement

When a loop pass deletes its loop, LLVM appends ` (invalidated)` to the scope of the After
dump and prints the **whole module** where the Before dump printed **only the loop**. The
application pairs these, correctly per the documented rule, but the two sides describe
different IR units, so the before/after deltas reported for `LoopDeletionPass` compare a
loop against a module and are not meaningful. In `sumTo.c` O2 this affects
`LoopDeletionPass`@50. Q3 therefore asks participants whether a loop survives, not to read
that pass's metrics.
