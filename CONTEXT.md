# LLVM pipeline caveats

The optimisation workspace does not show a stock `clang` pipeline verbatim. The
following deliberate deviations change what the compiler was asked to do, so
they matter whenever tool output is cited as evidence about a specific program.

- **`noinline` is stripped before `opt` runs.** `clang -O0` stamps `noinline` on
  every function, and `-Xclang -disable-O0-optnone` clears `optnone` but not
  `noinline`. Left in place, `InlinerPass` can never fire, so a call to a
  `static` helper survives at both `O1` and `O2`. The service therefore removes
  `noinline` from the emitted attribute group definitions (and from the matching
  `; Function Attrs:` comments) in `llvm-service/strip-noinline.js`, before the
  IR reaches `opt` and the `llvm-ir-metrics` collector. This also overrides an
  explicit `__attribute__((noinline))` written in the user's source: such a
  function may be inlined in the trace even though a real build would keep the
  call. The stripped IR, not clang's original output, is what the workspace
  reports as the starting IR.

# Program Reduction

This context describes how reduction attempts and their effects on a program are presented for analysis.

## Language

**Accepted candidate**:
A reduction candidate whose proposed program became the accepted next state. Every accepted candidate is represented by an accepted step linked to that candidate.
_Avoid_: Committed candidate

**Cumulative token reduction**:
The difference between the original program's token count and its token count after an accepted candidate. It includes changes made by intervening system steps, although those steps are not themselves plotted as candidates.
