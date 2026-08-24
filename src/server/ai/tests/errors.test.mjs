import assert from "node:assert/strict";
import test from "node:test";

import { createAiError, isAiError } from "../errors.ts";

test("recognises an AI error", () => {
  assert.equal(isAiError(createAiError("timeout", "too slow")), true);
});

test("rejects a plain error", () => {
  assert.equal(isAiError(new Error("boom")), false);
});

test("rejects an object carrying an unknown code", () => {
  assert.equal(
    isAiError({ category: "ai", code: "not-a-real-code", message: "x" }),
    false,
  );
});

test("rejects null", () => {
  assert.equal(isAiError(null), false);
});
