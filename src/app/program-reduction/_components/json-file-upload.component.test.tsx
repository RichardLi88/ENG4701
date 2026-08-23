import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const parseReductionTraceMock = vi.hoisted(() => vi.fn());

vi.mock("../_lib/reduction-trace-adapter", () => ({
  parseReductionTrace: parseReductionTraceMock,
}));

import type { ReductionTraceViewModel } from "../_lib/reduction-trace-adapter";
import { JsonFileUpload } from "./json-file-upload";

const model: ReductionTraceViewModel = {
  schemaVersion: "2.0.0",
  status: "COMPLETED",
  sourceFile: "main.c",
  language: "c",
  originalStateId: "initial",
  originalTokens: 1,
  finalTokens: 1,
  tokensRemoved: 0,
  reductionPercent: 0,
  durationMillis: 1,
  candidateCount: 0,
  steps: [],
  candidatesByState: {},
};

function createFile(name: string, content: string, type: string) {
  const file = new File([content], name, { type });
  Object.defineProperty(file, "text", {
    value: vi.fn().mockResolvedValue(content),
  });
  return file;
}

describe("JsonFileUpload", () => {
  beforeEach(() => {
    parseReductionTraceMock.mockReset();
  });

  test("shows the compiler-style initial upload panel", () => {
    render(<JsonFileUpload hasLoadedTrace={false} onTraceLoaded={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Reduction trace visualiser" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Perses v2 reduction trace JSON files"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Upload reduction trace")).toHaveAttribute(
      "accept",
      "application/json,.json",
    );
    expect(screen.queryByText("Upload error")).not.toBeInTheDocument();
  });

  test("collapses to a replacement action after a trace loads", () => {
    render(<JsonFileUpload hasLoadedTrace onTraceLoaded={vi.fn()} />);

    expect(screen.getByLabelText("Load another trace")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Reduction trace visualiser" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Reduction trace file actions" }),
    ).toBeInTheDocument();
  });

  test("shows an error for an unsupported file type", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<JsonFileUpload hasLoadedTrace={false} onTraceLoaded={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("Upload reduction trace"),
      createFile("trace.txt", "{}", "text/plain"),
    );

    expect(
      screen.getByRole("heading", {
        name: "The reduction trace could not be loaded",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Select a JSON file/)).toBeInTheDocument();
    expect(parseReductionTraceMock).not.toHaveBeenCalled();
  });

  test("shows an error for malformed JSON", async () => {
    const user = userEvent.setup();
    render(<JsonFileUpload hasLoadedTrace={false} onTraceLoaded={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("Upload reduction trace"),
      createFile("trace.json", "{", "application/json"),
    );

    expect(
      await screen.findByText(/The selected file is not valid JSON/),
    ).toBeInTheDocument();
    expect(parseReductionTraceMock).not.toHaveBeenCalled();
  });

  test("returns a parsed trace with its filename", async () => {
    const user = userEvent.setup();
    const onTraceLoaded = vi.fn();
    parseReductionTraceMock.mockReturnValue({ ok: true, data: model });
    render(
      <JsonFileUpload hasLoadedTrace={false} onTraceLoaded={onTraceLoaded} />,
    );

    await user.upload(
      screen.getByLabelText("Upload reduction trace"),
      createFile("trace.json", "{}", "application/json"),
    );

    expect(onTraceLoaded).toHaveBeenCalledWith(model, "trace.json");
  });
});
