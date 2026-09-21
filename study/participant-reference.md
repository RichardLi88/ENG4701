# Reading a compiler optimisation trace

A reference sheet for the study. Nothing here is specific to the program you are looking
at: it explains the notation and the shape of the log, not what any particular program
does.

**Give this to every participant in both conditions.** The application shows the same
glossary on screen, so handing it only to the raw condition would measure the sheet rather
than the tool.

---

## 1. What you are looking at

Your C file is turned into **LLVM IR**, a simpler language the compiler works in. The
compiler then makes many small attempts to improve it. Each attempt is called a **pass**.

A pass is given the program, and hands back a program. Most passes change nothing at all.

Two words worth having:

- **Basic block** - a straight run of instructions with no branches inside it. Control
  enters at the top and leaves at the bottom. The `if` and loop structure of your C code
  shows up as the arrangement of blocks.
- **Function scope vs loop scope** - some passes are handed a whole function, others just
  one loop out of it. A loop dump starts at `; Preheader:` and shows only the loop.

---

## 2. The shape of the raw log

The log is a long sequence of dumps. Each one starts with a header line:

```
*** IR Dump Before SimplifyCFGPass on accumulate ***
*** IR Dump After SimplifyCFGPass on accumulate ***
```

- `Before` / `After` - the program going into that pass, and coming out of it.
- `SimplifyCFGPass` - the name of the pass.
- `accumulate` - what it was handed. A function name, or `[module]` for the whole file, or
  `Parallel Loop at depth 1 containing: %...` for a single loop.

**A pass ran without changing anything if its Before and After dumps are identical.** That
is the single most useful fact about the log, and there is no marker for it: you have to
compare the two blocks.

Useful commands, if you have a terminal:

| Goal | Command |
|---|---|
| List every pass in order | `grep "IR Dump Before" trace.log` |
| Count how many passes ran | `grep -c "IR Dump Before" trace.log` |
| Find one pass | `grep -n "LoopDeletionPass" trace.log` |
| Jump to a line number in an editor | `Ctrl+G` / `Cmd+L` |

In an editor without a terminal, search for `IR Dump Before` and step through the matches.

---

## 3. IR notation

### Structure

| Notation | Meaning |
|---|---|
| `define` | Starts a function. |
| `%0`, `%3` | A value worked out earlier, or a parameter. Numbered rather than named. |
| `@name` | A function or a global variable. |
| `label:` | Starts a basic block. Labels look like `5:` or `.lr.ph:`. |
| `; preds = %1` | Lists the blocks that can jump to this one. |

### Control flow

| Notation | Meaning |
|---|---|
| `br label %7` | Always jumps to block `%7`. |
| `br i1 %2, label %7, label %10` | Jumps to `%7` if `%2` is true, otherwise `%10`. |
| `ret` | Returns from the function. |
| `phi` | Picks a value depending on which block control arrived from. This is how a variable that changes each time round a loop is written. |
| `call` | Calls a function. |

**Spotting a loop:** a block jumps *back* to a label that appeared earlier in the listing.
If no branch target appears earlier than the branch itself, there is no loop left.

### Working with values

| Notation | Meaning |
|---|---|
| `add`, `sub`, `mul` | Arithmetic. |
| `icmp sgt` | Compares two values. `sgt` greater than, `slt` less than, `sle` less than or equal, `ult` unsigned less than. |
| `lshr` | Shifts the bits right, which halves the value once per step. |
| `zext`, `trunc` | Widens a value to more bits, or narrows it to fewer. |

### Memory

| Notation | Meaning |
|---|---|
| `alloca` | Reserves space for a local variable. |
| `load` | Reads a value out of memory. |
| `store` | Writes a value into memory. |

### Safe to skim past

None of the following changes what the program computes. The application dims them; in the
raw log you can read past them.

| Notation | Meaning |
|---|---|
| `i32`, `i64`, `i33` | How many bits a value uses. Odd widths like `i33` come from the compiler widening a calculation to prove it cannot overflow. |
| `nsw`, `nuw` | Promises the arithmetic will not overflow. |
| `align 4` | How the value is laid out in memory. |
| `noundef` | Promises the value is always properly defined. |
| `dso_local`, `local_unnamed_addr`, `#0` | Linkage and attribute bookkeeping. |
| `!tbaa !5`, `!llvm.loop !6` | References to metadata further down the file. |
| `; ModuleID`, `source_filename`, `target datalayout`, `target triple` | File header. Appears at the top of every dump. |
| `; Function Attrs:`, `attributes #0 = { ... }` | Summaries of function properties. |

---

## 4. A worked example of the notation

This is a function that returns 1 no matter what it is given, before and after one pass.
It is here to show how the notation fits together, not as an answer to anything.

Before, four blocks:

```llvm
define i32 @example(i32 %0) {
  %2 = icmp sgt i32 %0, 0        ; is %0 greater than 0?
  br i1 %2, label %3, label %4   ; jump to block 3 or block 4

3:                                ; preds = %1
  br label %5

4:                                ; preds = %1
  br label %5

5:                                ; preds = %4, %3
  %6 = phi i32 [ 1, %3 ], [ 1, %4 ]   ; 1 either way
  ret i32 %6
}
```

After, one block:

```llvm
define i32 @example(i32 %0) {
  ret i32 1
}
```

Reading it: the comparison and the branch have gone, the four blocks have become one, and
the `phi` disappeared because there is no longer a choice to make.
