import assert from "node:assert/strict";
import test from "node:test";

import { selectModelConfig } from "../model-config.ts";

test("accepts a complete configuration", () => {
  const result = selectModelConfig({
    apiKey: "key-123",
    modelId: "gemini-flash",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { apiKey: "key-123", modelId: "gemini-flash" });
});

test("reports a missing key as a typed error", () => {
  const result = selectModelConfig({
    apiKey: undefined,
    modelId: "gemini-flash",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "missing-api-key");
});

test("reports a missing model id as a typed error", () => {
  const result = selectModelConfig({ apiKey: "key-123", modelId: undefined });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, "missing-api-key");
});
