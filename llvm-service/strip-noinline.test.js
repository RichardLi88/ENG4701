const assert = require("node:assert/strict");
const test = require("node:test");

const { stripNoinlineAttributes } = require("./strip-noinline");

test("removes noinline from an attribute group definition", () => {
  assert.equal(
    stripNoinlineAttributes(
      'attributes #0 = { noinline nounwind uwtable "frame-pointer"="non-leaf" }',
    ),
    'attributes #0 = { nounwind uwtable "frame-pointer"="non-leaf" }',
  );
});

test("removes noinline from any position in the group", () => {
  assert.equal(
    stripNoinlineAttributes("attributes #1 = { nounwind noinline }"),
    "attributes #1 = { nounwind }",
  );
  assert.equal(
    stripNoinlineAttributes("attributes #2 = { noinline }"),
    "attributes #2 = { }",
  );
});

test("clears the matching Function Attrs comment so it cannot contradict the group", () => {
  assert.equal(
    stripNoinlineAttributes("; Function Attrs: noinline nounwind uwtable"),
    "; Function Attrs: nounwind uwtable",
  );
});

test("leaves quoted attribute keys and longer identifiers alone", () => {
  const ir = [
    'attributes #0 = { nounwind "noinline"="true" }',
    "attributes #1 = { noinline-thing nounwind }",
  ].join("\n");

  assert.equal(stripNoinlineAttributes(ir), ir);
});

test("leaves function bodies and metadata untouched", () => {
  const ir = [
    "define internal i32 @scale(i32 noundef %0) #0 {",
    "  ret i32 0",
    "}",
    "",
    "attributes #0 = { noinline nounwind }",
    "",
    '!9 = !{!"Ubuntu clang version 14.0.0-1ubuntu1.1"}',
  ].join("\n");

  assert.equal(
    stripNoinlineAttributes(ir),
    ir.replace("{ noinline nounwind }", "{ nounwind }"),
  );
});

test("is idempotent", () => {
  const once = stripNoinlineAttributes("attributes #0 = { noinline nounwind }");

  assert.equal(stripNoinlineAttributes(once), once);
});
