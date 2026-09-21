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

## Three programs, ten questions

Every question addresses exactly one program. Each program carries questions from more
than one research question, so three files cover all ten items. Participants are briefed
on three ideas only: a pass is one step that rewrites the program, a basic block is a
straight-line chunk of code, and the before/after panes show the program at that step.

| Block | Program | Level(s) | Questions | Why a non-expert can answer it |
|---|---|---|---|---|
| **A** | `classify.c` | O1 | RQ2 Q1, Q2 · RQ4 Q8 | Both arms of the `if` are visibly identical, so the branch is obviously pointless |
| **B** | `accumulate.c` | O1 | RQ2 Q3, Q4 · RQ4 Q9 | "You wrote a loop — is it still there?" needs no IR reading |
| **C** | `combine.c` | O1 and O2 | RQ3 Q5, Q6, Q7 · RQ4 Q10 | "Does the function still call itself?" is visible in the source |

### Counterbalancing

Each participant works through all three blocks, some in the raw condition and the rest in
the tool condition, and never sees the same trace twice. Rotate the assignment so each
block appears in each condition equally often:

| Group | Raw condition | Tool condition |
|---|---|---|
| 1 | A, B | C |
| 2 | C | A, B |
| 3 | A, C | B |
| 4 | B | A, C |
| 5 | B, C | A |
| 6 | A | B, C |

Over six participants each block is seen three times in each condition.

**Consequence of using only three files, state it in the write-up:** because a given RQ
lives in one block, the condition comparison *for that RQ* is between participants rather
than within. A participant answers RQ3 in only one condition. The design stays
within-participant overall — everyone does both conditions — but per-RQ contrasts rely on
the rotation, so group sizes need to be multiples of six. Two matched programs per RQ
would give within-participant contrasts at the cost of doubling the file count.

## Measurements

`last` is the zero-based order of the final pass that changed the IR; `%` is that position
as a fraction of the run. Every metric came back `estimated: false`, and the application
agrees with ground truth on all four traces.

| Program | Level | Passes | Changed | Last change | % | Log lines | Log size |
|---|---|---|---|---|---|---|---|
| `classify.c` | O1 | 83 | 4 | 22 | 28% | 2,175 | 87 KB |
| `accumulate.c` | O1 | 92 | 16 | 53 | 59% | 5,044 | 177 KB |
| `combine.c` | O1 | 83 | 5 | 22 | 28% | 4,001 | 139 KB |
| `combine.c` | O2 | 110 | 27 | 101 | 93% | 5,686 | 220 KB |

Key facts behind the answers:

- `classify.c` O1: `SimplifyCFGPass`@16 takes the function from **4 basic blocks to 1**;
  the final body is `ret i32 1`.
- `accumulate.c` O1: `LoopDeletionPass`@45 removes the loop; the final function has no back
  edge and computes the total with arithmetic.
- `combine.c`: `TailCallElimPass` does not run at all at O1 (zero dumps) and changes the IR
  at O2 order 32. One self-call survives in the O1 final IR; none at O2.
- `LoopVectorizePass` runs exactly once in **all four** traces and changes nothing in any of
  them — the basis of the Q7 distractor.

Sources are in `study/programs/`, logs in `study/logs/<program>.<level>.log` (4 files,
636 KB), unmodified `opt` stderr.

**The programs are 9–11 lines, not the 15–40 the brief asks for.** The known-good programs
supplied in the brief are 6–7 lines, and padding would only lengthen traces that already
run to thousands of lines in the raw condition.

---

## Question set

Four RQ2, three RQ3, three RQ4. Each question names a pass rather than an index.

### Block A — `classify.c` at O1

**Q1. RQ2. Objective.**
> Both branches of your `if` do the same thing. Look at the step called `SimplifyCFGPass`.
> How many basic blocks does the function have going in, and how many coming out?

**Answer: 4 going in, 1 coming out.**

*Raw:* count the block labels in the Before and After dumps for `SimplifyCFGPass`.
*Tool:* the Basic blocks row of the metrics table, or the two CFG panes side by side.

**Q2. RQ2. Multiple choice.**
> Which one best describes what that step did?
> a) It made each branch faster but kept both of them.
> b) It removed the choice entirely, because both paths did the same thing.
> c) It repeated the branch body several times to save work later.
> d) It moved the branch out into whoever calls this function.

**Answer: (b).** The finished function is `ret i32 1`. Distractors are all real
optimisations: (a) instruction combining, (c) unrolling, (d) interprocedural code motion.

**Q8. RQ4. Band estimate.**
> This run is 83 steps long. Roughly how far through does the program stop changing at all?
> Answer as a percentage.

**Answer: 28%** — last change at order 22 of 83. **Accept 20–35%.**

*Raw:* find the last pair of dumps that differ.
*Tool:* filter the timeline to Changed and read the position of the last entry.

### Block B — `accumulate.c` at O1

**Q3. RQ2. Objective.**
> You wrote a `for` loop. In the finished program, is the loop still there? Name the step
> that removed it.

**Answer: no, the loop is gone; `LoopDeletionPass`, at order 45.** The final function has
no back edge.

*Raw:* search the log for `LoopDeletionPass` and compare its Before and After dumps.
*Tool:* search the timeline for "loop" under All Passes or under `accumulate`;
`loop-deletion` carries a CHANGED badge, and its description explains what loop deletion
does in general, which the participant connects to their own loop. See
[D4](#d4--loop-passes-were-filed-away-from-their-function-fixed): before that fix this
question was close to unanswerable in the tool condition.

**Q4. RQ2. Free text.**
> In one or two sentences, say what the finished program does instead of your loop, and why
> it still gives the right answer.

**Answer:** accept any response conveying that the repeated adding was replaced by a direct
calculation producing the same total without looping. Reject answers claiming the result
changed, that the loop was merely made faster and still runs, or that iterations were
merged or unrolled.

**Q9. RQ4. Objective.**
> Of the 92 steps in this run, how many changed the program at all?

**Answer: 16.** **Accept 14–18**, to allow for miscounting across a 5,044-line log in the
raw condition.

*Raw:* compare every Before/After pair in the log.
*Tool:* the Changed filter count in the sidebar.

### Block C — `combine.c`, two windows at O1 and O2

**Q5. RQ3. Objective.**
> You wrote a function that calls itself. In which of the two runs does the finished
> program still call itself?

**Answer: it still calls itself at O1; at O2 it does not.** Verified: one self-call in the
O1 final IR, zero at O2.

*Raw:* search each final dump for `call i32 @combine`.
*Tool:* the whole-program before and after view in each window.

**Q6. RQ3. Objective.**
> Name the step responsible for that difference.

**Answer: `TailCallElimPass`** (shown as `tail-call-elim`). It changed the program at O2
order 32 and does not run at all at O1.

*Raw:* diff the two lists of `*** IR Dump Before ... ***` names.
*Tool:* search the pass list in each window — present and CHANGED in one, absent in the
other.

**Q7. RQ3. Multiple choice.**
> Why does the higher setting manage this when the lower one does not?
> a) The higher setting runs a step that the lower one never runs at all.
> b) The higher setting runs the same steps but goes round them more times.
> c) The lower setting ran the same step, but it chose not to change anything.
> d) The lower setting had already removed the self-call earlier on.

**Answer: (a).** `TailCallElimPass` has zero dumps at O1 and one at O2. Option (c) is the
misconception this item exists to catch, and it is not a straw man: it is exactly what
`LoopVectorizePass` does in these same traces, running once at both levels and changing
nothing at either.

*Raw:* count dump headers per step name in both logs.
*Tool:* the pass list shows presence, and the CHANGED / NO CHANGE badge separates "ran and
did nothing" from "never ran".

**Q10. RQ4. Band estimate, the O2 window.**
> This run is 110 steps long. Roughly how far through does the program stop changing at all?

**Answer: 93%** — last change at order 101 of 110. **Accept 85–100%.**

Q8 and Q10 are the discriminating pair for RQ4: 28% against 93%, so a participant who
guesses a constant scores well on one and badly on the other. Q9 asks for a count rather
than a proportion, so the three RQ4 items are not all the same task.

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
program at O2 on a vectorisable loop. A question asking "which pass runs only at O2" would
have been marked against a wrong answer; Q7 uses this as its strongest distractor instead.

### D3 — `verify-trace.py` did not exist

The brief states a comparison script is in the repo. It is not, and never has been on any
branch. `scripts/verify-trace.py` was written for this task. Writing it surfaced two bugs
in its own parser before it produced anything trustworthy: pass names carry template
arguments with spaces (`RequireAnalysisPass<llvm::GlobalsAA, llvm::Module>`) and loop
scopes are prose (`Parallel Loop at depth 1 containing: %2<header>`), so a header regex
built on non-space runs silently swallowed those dumps into the previous body and shifted
every later pairing. The first run reported `classify.c` as 78 passes with an analysis pass
apparently rewriting the IR; after the fix it reproduced the brief exactly.

### D4 - Loop passes were filed away from their function (fixed)

**Symptom.** Searching "loop" under the `accumulate` function returned nine passes and did
not include `loop-deletion`, the pass that removes the participant's loop. It and
`loop-rotate` sat under "Global Passes / Module and unassigned" instead, where nobody
reasoning about their own function would look. Q3 was close to unanswerable in the tool
condition for that reason.

**Root cause.** The service reads the owning function out of the dump text by finding the
`define` line. A loop dump prints only the loop's blocks, starting at `; Preheader:`, so
there is no `define` and the scope fell back to `{"level": "unknown"}`. `createScope`
already had a `level: "loop"` branch; it could never fire.

**Fix.** The metrics collector resolves the loop's owning function itself and reports it
against the same dump (`C B <LoopDeletionPass> <accumulate>`). The payload builder now
falls back to that when the IR text carries no function name. On `accumulate.c` O1 the
unattributed count went from 9 to 0: the function scope went 61 -> 70 passes and the
global scope 31 -> 22.

**No effect on the answer key.** Pass count, order, names, `changed` flags and last-change
positions are unchanged for all four traces; only the `scope` field moved.

### Non-discrepancies (checked, agree)

For all four traces the application agrees with ground truth on pass count, pass order,
full pass names, the `changed` flag for every pass, and the target triple, and reports
`estimated: false` on every metric.

### Caveat on one pass, not a disagreement

When a loop pass deletes its loop, LLVM appends ` (invalidated)` to the scope of the After
dump and prints the **whole module** where the Before dump printed **only the loop**. The
application pairs these, correctly per the documented rule, but the two sides describe
different IR units, so the deltas reported for `LoopDeletionPass` compare a loop against a
module and are not meaningful. This affects `LoopDeletionPass`@45 in `accumulate.c`. Q3
therefore asks participants to name that pass, never to read its metrics.
