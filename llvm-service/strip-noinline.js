// clang emits `-O0` functions with the `noinline` attribute. `-disable-O0-optnone`
// clears `optnone` but leaves `noinline`, so `InlinerPass` can never fire and every
// call survives the pipeline at O1 and above. Removing the attribute before `opt`
// runs lets the requested pipeline inline as it normally would.
//
// Caveat: this changes what the compiler was asked to do relative to what clang
// emitted, and it overrides an explicit `__attribute__((noinline))` in user source.
// See the "LLVM pipeline caveats" section of README.md before citing tool output
// as evidence about a specific program.

// `attributes #0 = { noinline nounwind uwtable "frame-pointer"="non-leaf" ... }`.
// The attribute groups are the semantically load-bearing definitions.
const ATTRIBUTE_GROUP_PATTERN = /^attributes #\d+ = \{[^}\n]*\}$/gm;

// `; Function Attrs: noinline nounwind uwtable`. Not load-bearing, but left stale
// the comments contradict the group they describe.
const FUNCTION_ATTRS_COMMENT_PATTERN = /^; Function Attrs:.*$/gm;

// A standalone `noinline` token, plus the single space that separated it. The
// lookbehind keeps quoted attribute keys such as `"noinline"="true"` intact.
const NOINLINE_TOKEN_PATTERN = /(?<=[{\s:])noinline(?![-\w])[ ]?/g;

/** Remove `noinline` from every attribute group so `opt` may inline. */
function stripNoinlineAttributes(ir) {
  return ir
    .replace(ATTRIBUTE_GROUP_PATTERN, (group) =>
      group.replace(NOINLINE_TOKEN_PATTERN, ""),
    )
    .replace(FUNCTION_ATTRS_COMMENT_PATTERN, (comment) =>
      comment.replace(NOINLINE_TOKEN_PATTERN, ""),
    );
}

module.exports = { stripNoinlineAttributes };
