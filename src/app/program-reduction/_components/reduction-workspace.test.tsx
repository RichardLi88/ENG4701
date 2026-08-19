// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeAll, describe, expect, test } from "vitest";

import { parseReductionTrace } from "../_lib/trace-parser";
import type { TraceParseResult } from "../_lib/trace-model";
import { ReductionWorkspace } from "./reduction-workspace";

const fixturePath = resolve(
  process.cwd(),
  "src/test-data/program-reduction/version-1.jsonl",
);

let parsed: TraceParseResult;

beforeAll(async () => {
  const text = readFileSync(fixturePath, "utf8");
  const bytes = new TextEncoder().encode(text);
  parsed = await parseReductionTrace(
    new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    { totalBytes: bytes.byteLength },
  );
});

function renderWorkspace() {
  if (!parsed.ok) throw new Error(parsed.message);
  return render(
    createElement(ReductionWorkspace, {
      fileName: "fixture.jsonl",
      runs: parsed.runs,
      diagnostics: parsed.diagnostics,
      onReset: () => undefined,
    }),
  );
}

describe("ReductionWorkspace", () => {
  test("shows pass and commit independently and switches diff modes", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(
      screen.getByRole("button", { name: /passing-committed/i }),
    );
    expect(
      screen.getByRole("heading", { name: "passing-committed" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Passed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Committed").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /cancelled/i }));
    await user.click(screen.getByRole("button", { name: "Tokens" }));
    expect(screen.getByLabelText("Token sequence diff")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Next committed revision" }),
    );
    expect(
      screen.getByRole("heading", { name: "internal-heuristic" }),
    ).toBeInTheDocument();
  });

  test("does not apply navigation shortcuts while search is focused", () => {
    renderWorkspace();
    const search = screen.getByLabelText("Search candidates");
    fireEvent.keyDown(search, { key: "j" });

    expect(
      screen.getByRole("heading", { name: "failed-delete" }),
    ).toBeInTheDocument();
  });
});
