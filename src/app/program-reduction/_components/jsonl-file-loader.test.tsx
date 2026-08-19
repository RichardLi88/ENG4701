// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, test, vi } from "vitest";

import { fileLoaderContent } from "../content";
import { JsonlFileLoader } from "./jsonl-file-loader";

function fileInput(container: HTMLElement) {
  const input = container.querySelector("input[type=file]");
  if (!(input instanceof HTMLInputElement))
    throw new Error("Missing file input");
  return input;
}

describe("JsonlFileLoader", () => {
  test("rejects a non-JSONL file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onLoaded = vi.fn();
    const { container } = render(createElement(JsonlFileLoader, { onLoaded }));

    await user.upload(
      fileInput(container),
      new File(["{}"], "trace.json", { type: "application/json" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      fileLoaderContent.invalidType,
    );
    expect(onLoaded).not.toHaveBeenCalled();
  });

  test("cancels an in-progress stream and discards its partial run", async () => {
    const user = userEvent.setup();
    const onLoaded = vi.fn();
    const { container } = render(createElement(JsonlFileLoader, { onLoaded }));
    const firstRecord = new TextEncoder().encode(
      `${JSON.stringify({
        schemaVersion: 1,
        sequence: 1,
        timestampMillis: 1,
        type: "run_started",
        initialRevision: 0,
        snapshot: { files: [], tokens: [], tokenCount: 0 },
      })}\n`,
    );
    const file = new File([firstRecord], "trace.jsonl");
    Object.defineProperty(file, "stream", {
      value: () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(firstRecord);
          },
        }),
    });

    await user.upload(fileInput(container), file);
    await user.click(
      await screen.findByRole("button", { name: fileLoaderContent.cancel }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        fileLoaderContent.cancelled,
      ),
    );
    expect(onLoaded).not.toHaveBeenCalled();
  });
});
