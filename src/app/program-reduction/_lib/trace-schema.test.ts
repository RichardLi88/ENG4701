import { describe, expect, test } from "vitest";

import { traceEventSchema } from "./trace-schema";

const snapshot = {
  files: [{ path: "main.c", content: "x\n" }],
  tokens: [{ index: 0, text: "x" }],
  tokenCount: 1,
};

const candidate = {
  schemaVersion: 1,
  sequence: 2,
  timestampMillis: 10,
  type: "candidate_tested",
  candidateId: "candidate-1",
  baseRevision: 0,
  result: "pass",
  exitCode: 0,
  elapsedMillis: 2,
  edit: { kind: "NODE_DELETION", description: "Delete node", actions: [] },
  snapshot,
};

describe("traceEventSchema", () => {
  test("rejects invalid candidate status values", () => {
    expect(
      traceEventSchema.safeParse({ ...candidate, result: "interesting" })
        .success,
    ).toBe(false);
  });

  test("rejects missing required fields", () => {
    const missingId: Partial<typeof candidate> = { ...candidate };
    delete missingId.candidateId;
    expect(traceEventSchema.safeParse(missingId).success).toBe(false);
  });

  test("rejects duplicate source paths", () => {
    expect(
      traceEventSchema.safeParse({
        ...candidate,
        snapshot: {
          ...snapshot,
          files: [...snapshot.files, ...snapshot.files],
        },
      }).success,
    ).toBe(false);
  });

  test("rejects token indices that do not match their positions", () => {
    expect(
      traceEventSchema.safeParse({
        ...candidate,
        snapshot: {
          ...snapshot,
          tokens: [{ index: 4, text: "x" }],
        },
      }).success,
    ).toBe(false);
  });

  test("requires replacement node metadata for replacement actions", () => {
    expect(
      traceEventSchema.safeParse({
        ...candidate,
        edit: {
          kind: "ANY_NODE_REPLACEMENT",
          description: "Replace node",
          actions: [
            {
              kind: "REPLACE",
              description: "Replace child",
              targetNodeId: 1,
            },
          ],
        },
      }).success,
    ).toBe(false);
  });

  test("accepts critical error events with nullable messages", () => {
    expect(
      traceEventSchema.safeParse({
        schemaVersion: 1,
        sequence: 3,
        timestampMillis: 11,
        type: "error",
        exceptionClass: "java.lang.IllegalStateException",
        message: null,
        stackTrace: "stack trace",
      }).success,
    ).toBe(true);
  });
});
