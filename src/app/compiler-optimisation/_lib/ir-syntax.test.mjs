import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { splitIrLine } from "./ir-syntax.ts";

const signal = (line) =>
  splitIrLine(line)
    .filter((span) => !span.muted)
    .map((span) => span.text)
    .join("");

test("returns every character exactly once, in order", () => {
  const lines = readFileSync(
    new URL("../../../../study/logs/accumulate.O1.log", import.meta.url),
    "utf8",
  ).split("\n");

  for (const line of lines) {
    assert.equal(
      splitIrLine(line)
        .map((span) => span.text)
        .join(""),
      line,
      `round-trip failed for: ${line}`,
    );
  }
});

test("mutes whole lines of module bookkeeping", () => {
  for (const line of [
    "; ModuleID = 'accumulate.in.ll'",
    'source_filename = "accumulate.c"',
    'target datalayout = "e-m:e-i8:8:32"',
    'target triple = "aarch64-unknown-linux-gnu"',
    "; Function Attrs: nofree norecurse nounwind",
    "attributes #0 = { nounwind uwtable }",
    '!9 = !{!"Ubuntu clang version 14.0.0"}',
  ]) {
    assert.deepEqual(splitIrLine(line), [{ text: line, muted: true }]);
  }
});

test("keeps the operation and its operands, mutes the type", () => {
  assert.equal(signal("  %7 = mul i33 %4, %6"), "  %7 = mul  %4, %6");
});

test("keeps the function name, mutes linkage and parameter flags", () => {
  assert.equal(
    signal(
      "define dso_local i32 @accumulate(i32 noundef %0) local_unnamed_addr #0 {",
    ),
    "define   @accumulate(  %0)   {",
  );
});

test("keeps branch targets, mutes the label keyword and predecessor comment", () => {
  assert.equal(
    signal("  br i1 %2, label %.lr.ph, label %._crit_edge"),
    "  br  %2,  %.lr.ph,  %._crit_edge",
  );
  assert.equal(signal(".lr.ph:      ; preds = %1"), ".lr.ph:      ");
});

test("mutes alignment and metadata attachments on a memory operation", () => {
  assert.equal(
    signal("  store i32 %9, i32* %3, align 4, !tbaa !5"),
    "  store  %9,  %3, , ",
  );
});

test("leaves an empty line alone", () => {
  assert.deepEqual(splitIrLine(""), []);
});

test("does not mute identifiers that merely start with a keyword", () => {
  assert.equal(
    signal("  %internal_count = add i32 %0, 1"),
    "  %internal_count = add  %0, 1",
  );
});
