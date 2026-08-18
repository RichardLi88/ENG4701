const FUNCTION_ID = "fn:bGFyZ2UtdGltZWxpbmU";
const PASS_COUNT = 60;

const beforeIr = `define i32 @large_timeline(i32 %value) {
  ret i32 %value
}`;

const passes = Array.from({ length: PASS_COUNT }, (_, index) => {
  const type = index % 5 === 0 ? "analysis" : "transform";
  const changed = type === "transform" && index % 3 === 0;
  const passNumber = String(index + 1).padStart(2, "0");

  return {
    id: `pass:large:${String(index).padStart(6, "0")}`,
    order: index,
    name: `${type}-pass-${passNumber}`,
    fullName: `LargeTimeline${type === "analysis" ? "Analysis" : "Transform"}Pass${passNumber}`,
    type,
    scope:
      index % 4 === 3
        ? {
            level: "loop",
            functionId: FUNCTION_ID,
            loopId: `loop:${FUNCTION_ID}:${Math.floor(index / 4)}`,
          }
        : { level: "function", functionId: FUNCTION_ID },
    changed,
    ir: {
      before: beforeIr,
      after: changed
        ? `${beforeIr}\n; transformed by pass ${passNumber}`
        : beforeIr,
    },
  };
});

const manyPassesFixture = {
  schemaVersion: "1.0.0",
  meta: {
    sourceFile: "large-timeline.c",
    optimisationLevel: "O2",
    totalPasses: PASS_COUNT,
  },
  functions: [
    {
      id: FUNCTION_ID,
      name: "large_timeline",
      signature: "i32 (i32)",
    },
  ],
  passes,
};

export default manyPassesFixture;
