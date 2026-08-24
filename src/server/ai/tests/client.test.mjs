import assert from "node:assert/strict";
import test from "node:test";
import { MockLanguageModelV4 } from "ai/test";

import { generateExplanation } from "../client.ts";

const pack = {
  packVersion: "1",
  domain: "compiler-optimisation",
  subject: { id: "pass-7", label: "InstCombinePass", scope: "function main" },
  transformation: null,
  code: { before: "a", after: "b", patch: null },
  metrics: [
    { key: "instructions", before: 12, after: 9, delta: -3, estimated: false },
  ],
};

const respondWith = (payload) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(payload) }],
      finishReason: "stop",
      usage: {
        inputTokens: { total: 120 },
        outputTokens: { total: 45 },
      },
      warnings: [],
    }),
  });

test("returns a parsed explanation with verified metric claims", async () => {
  const model = respondWith({
    summary: "Folded a constant add.",
    mechanism: "Constant folding replaced the add with its literal result.",
    metricClaims: [{ metric: "instructions", claimedDelta: -3 }],
    confidence: "high",
  });

  const result = await generateExplanation({ model, pack });

  assert.equal(result.ok, true);
  assert.equal(result.data.explanation.confidence, "high");
  assert.equal(result.data.claimChecks[0].status, "match");
  assert.equal(result.data.usage.promptTokens, 120);
  assert.equal(result.data.usage.outputTokens, 45);
});

test("flags a claim the evidence does not support", async () => {
  const model = respondWith({
    summary: "Removed three basic blocks.",
    mechanism: "Speculation.",
    metricClaims: [{ metric: "basicBlocks", claimedDelta: -3 }],
    confidence: "high",
  });

  const result = await generateExplanation({ model, pack });

  assert.equal(result.ok, true);
  assert.equal(result.data.claimChecks[0].status, "unsupported");
});

test("maps a provider failure to a typed error", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error("network down");
    },
  });

  const result = await generateExplanation({ model, pack });

  assert.equal(result.ok, false);
  assert.equal(result.error.category, "ai");
  assert.equal(result.error.code, "provider-unavailable");
});
