import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCompilerWorkflowFailure,
  compilerWorkflowStatuses,
  isCompilerWorkflowPending,
  MAX_SOURCE_LENGTH,
  validateCompilerInput,
} from "./compiler-workflow.ts";

test("declares every Day 2 workflow status", () => {
  assert.deepEqual(compilerWorkflowStatuses, [
    "idle",
    "validating",
    "compiling",
    "optimising",
    "processing",
    "success",
    "failure",
  ]);
});

test("accepts C and C++ input without changing the user's source", () => {
  const source = "int main(void) { return 0; }\n";

  assert.deepEqual(validateCompilerInput(" example.CPP ", source), {
    ok: true,
    filename: "example.CPP",
    source,
  });
});

test("rejects unsupported, empty, and oversized input", () => {
  assert.deepEqual(validateCompilerInput("example.txt", "int main() {}"), {
    ok: false,
    code: "unsupportedExtension",
  });
  assert.deepEqual(validateCompilerInput("example.c", "  \n"), {
    ok: false,
    code: "emptySource",
  });
  assert.deepEqual(
    validateCompilerInput("example.c", "a".repeat(MAX_SOURCE_LENGTH + 1)),
    { ok: false, code: "sourceTooLarge" },
  );
});

test("only active request stages count as pending", () => {
  for (const status of compilerWorkflowStatuses) {
    assert.equal(
      isCompilerWorkflowPending(status),
      ["validating", "compiling", "optimising", "processing"].includes(status),
    );
  }
});

test("classifies compile, service, timeout, and schema failures", () => {
  assert.equal(
    classifyCompilerWorkflowFailure("compile", {
      code: "BAD_REQUEST",
      hasSchemaIssues: false,
    }),
    "compileFailed",
  );
  assert.equal(
    classifyCompilerWorkflowFailure("optimise", {
      code: "SERVICE_UNAVAILABLE",
      hasSchemaIssues: false,
    }),
    "serviceUnavailable",
  );
  assert.equal(
    classifyCompilerWorkflowFailure("optimise", {
      code: "TIMEOUT",
      hasSchemaIssues: false,
    }),
    "requestTimedOut",
  );
  assert.equal(
    classifyCompilerWorkflowFailure("optimise", {
      code: "INTERNAL_SERVER_ERROR",
      hasSchemaIssues: true,
    }),
    "schemaInvalid",
  );
});
