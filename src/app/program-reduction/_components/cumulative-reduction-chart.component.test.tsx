import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import type { ReductionStepView } from "../_lib/reduction-trace-adapter";
import { CumulativeReductionChart } from "./cumulative-reduction-chart";

function step(
  index: number,
  candidateId: string | null,
  tokensBefore: number,
  tokensAfter: number,
): ReductionStepView {
  return {
    index,
    candidateId,
    fromStateId: `state:${index}`,
    toStateId: `state:${index + 1}`,
    tokensBefore,
    tokensAfter,
    tokensRemoved: tokensBefore - tokensAfter,
    acceptedAtSeq: index + 1,
    reducer: candidateId === null ? null : "token-reducer",
    reducerPass: candidateId === null ? null : 1,
    transformationKind: candidateId === null ? null : "DELETE",
    description: null,
    systemReason: candidateId === null ? "System transition" : null,
    files: [],
    initialFilePath: null,
  };
}

describe("CumulativeReductionChart", () => {
  test("plots candidate-backed steps and includes intervening system progress", () => {
    render(
      <CumulativeReductionChart
        originalTokens={9}
        steps={[
          step(0, "candidate:1", 9, 7),
          step(1, null, 7, 6),
          step(2, "candidate:2", 6, 4),
        ]}
      />,
    );

    const chart = screen.getByRole("img", {
      name: /accepted candidates: 2.*latest plotted token count: 4.*cumulative token reduction: 5 tokens/i,
    });
    expect(chart).toHaveAttribute("data-point-count", "2");

    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: "End" });

    expect(screen.getByText("candidate:2")).toBeInTheDocument();
    expect(screen.getByText("5 tokens")).toBeInTheDocument();
  });

  test("supports keyboard inspection of adjacent candidates", () => {
    render(
      <CumulativeReductionChart
        originalTokens={9}
        steps={[step(0, "candidate:1", 9, 7), step(1, "candidate:2", 7, 5)]}
      />,
    );

    const chart = screen.getByRole("img");
    fireEvent.focus(chart);
    expect(screen.getByText("candidate:1")).toBeInTheDocument();

    fireEvent.keyDown(chart, { key: "ArrowRight" });
    expect(screen.getByText("candidate:2")).toBeInTheDocument();

    fireEvent.keyDown(chart, { key: "Home" });
    expect(screen.getByText("candidate:1")).toBeInTheDocument();
  });

  test("dismisses a pinned touch inspection outside the chart", () => {
    render(
      <CumulativeReductionChart
        originalTokens={9}
        steps={[step(0, "candidate:1", 9, 7)]}
      />,
    );

    const chart = screen.getByRole("img");
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 960,
      top: 0,
      width: 960,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.focus(chart);
    fireEvent.pointerDown(chart, { clientX: 900, pointerType: "touch" });
    expect(screen.getByText("candidate:1")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("candidate:1")).not.toBeInTheDocument();
  });

  test("preserves a negative cumulative reduction", () => {
    render(
      <CumulativeReductionChart
        originalTokens={9}
        steps={[step(0, "candidate:1", 9, 10)]}
      />,
    );

    fireEvent.focus(screen.getByRole("img"));
    expect(screen.getByText("−1 tokens")).toBeInTheDocument();
  });

  test("shows an empty state when accepted steps have no candidates", () => {
    render(
      <CumulativeReductionChart
        originalTokens={9}
        steps={[step(0, null, 9, 8)]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No accepted candidates to graph" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("draws large traces as one path with only endpoint markers", () => {
    const steps = Array.from({ length: 2_000 }, (_, index) =>
      step(index, `candidate:${index + 1}`, 10_000 - index, 9_999 - index),
    );
    const { container } = render(
      <CumulativeReductionChart originalTokens={10_000} steps={steps} />,
    );

    expect(screen.getByRole("img")).toHaveAttribute("data-point-count", "2000");
    expect(container.querySelectorAll("path")).toHaveLength(1);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });
});
