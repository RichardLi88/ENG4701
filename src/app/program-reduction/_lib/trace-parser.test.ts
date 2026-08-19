import { readFileSync } from "node:fs";

import { describe, expect, test, vi } from "vitest";

import { parseReductionTrace } from "./trace-parser";

const fixtureUrl = new URL(
  "../../../test-data/program-reduction/version-1.jsonl",
  import.meta.url,
);

function chunkedStream(value: string, chunkSizes: ReadonlyArray<number>) {
  const bytes = new TextEncoder().encode(value);
  let offset = 0;
  let chunkIndex = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const size = chunkSizes[chunkIndex % chunkSizes.length] ?? bytes.length;
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
      chunkIndex += 1;
    },
  });
}

describe("parseReductionTrace", () => {
  test("normalizes all candidate states and separates runs", async () => {
    const input = readFileSync(fixtureUrl, "utf8");
    const result = await parseReductionTrace(chunkedStream(input, [1, 7, 31]), {
      totalBytes: new TextEncoder().encode(input).byteLength,
      batchSize: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.runs).toHaveLength(2);
    expect(
      result.runs[0]?.candidates.map((candidate) => candidate.status),
    ).toEqual([
      "fail",
      "pass",
      "pass",
      "cache-rejected",
      "cancelled",
      "internal-commit",
    ]);
    expect(
      result.runs[0]?.candidatesById.get("passing-committed")?.committed,
    ).toBe(true);
    expect(result.runs[0]?.revisions.has(2)).toBe(true);
    expect(
      result.runs[0]?.candidatesById.get("internal-heuristic")?.changedFiles,
    ).toEqual(["src/main.c", "README.txt", "notes.txt"]);
    expect(
      result.runs[0]?.candidatesById.get("internal-heuristic")?.edit?.kind,
    ).toBe("LATRA_GENERAL");
    const persesError = result.runs[0]?.diagnostics.find(
      (item) => item.severity === "error",
    );
    expect(persesError?.message).toContain("java.lang.IllegalStateException");
  });

  test("continues after malformed and unknown records with line diagnostics", async () => {
    const started = readFileSync(fixtureUrl, "utf8").split("\n")[0]!;
    const input = `${started}\r\n{bad json}\n${JSON.stringify({ schemaVersion: 1, sequence: 2, timestampMillis: 2, type: "future_event" })}`;
    const progress = vi.fn();
    const result = await parseReductionTrace(chunkedStream(input, [5]), {
      totalBytes: input.length,
      batchSize: 1,
      onProgress: progress,
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lineNumber: 2, severity: "error" }),
        expect.objectContaining({ lineNumber: 3, severity: "warning" }),
      ]),
    );
    expect(progress).toHaveBeenCalled();
  });

  test("rejects unsupported schema versions for the whole file", async () => {
    const input = JSON.stringify({ schemaVersion: 2, type: "run_started" });
    const result = await parseReductionTrace(chunkedStream(input, [2]), {
      totalBytes: input.length,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("Unsupported schema version");
  });

  test("honours an aborted load", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      parseReductionTrace(chunkedStream("{}", [1]), {
        totalBytes: 2,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  test("sorts out-of-order events by sequence before linking commits", async () => {
    const lines = readFileSync(fixtureUrl, "utf8")
      .trimEnd()
      .split("\n")
      .slice(0, 9);
    const input = [
      lines[0],
      lines[4],
      lines[3],
      ...lines.slice(1, 3),
      ...lines.slice(5),
    ].join("\n");
    const result = await parseReductionTrace(chunkedStream(input, [17]), {
      totalBytes: input.length,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.runs[0]?.candidatesById.get("passing-committed")?.status,
    ).toBe("pass");
    expect(
      result.runs[0]?.candidatesById.get("passing-committed")?.committed,
    ).toBe(true);
  });
});
