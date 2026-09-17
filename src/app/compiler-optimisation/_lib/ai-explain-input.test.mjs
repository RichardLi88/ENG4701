import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseOptimisationResult } from "./optimisation-adapter.ts";
import { toExplainInput } from "./ai-explain-input.ts";
import { explainInputSchema } from "../../../server/ai/schema.ts";

test("LLVM AI adapter preserves actual version and missing metrics", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "../../../test-data/compiler-optimisation/partial-data.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  fixture.meta.toolVersion = "14.0.0";
  const result = parseOptimisationResult(fixture);
  assert.ok(result.ok);
  for (const pass of result.data.passes) {
    const input = toExplainInput(pass, result.data);
    assert.equal(input.toolVersion, "14.0.0");
    assert.equal(input.llvm.type, pass.type);
    assert.equal(input.llvm.changed, pass.changed);
    assert.ok(explainInputSchema.safeParse(input).success);
    if (pass.metrics.status === "unavailable")
      assert.deepEqual(input.metrics, []);
  }
});
