import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { ExplanationPanel } from "./explanation-panel";
import { aiExplanationContent } from "./content";

const ready = {
  status: "ready" as const,
  result: {
    explanation: {
      summary: "Folded a constant add.",
      mechanism: "Constant folding replaced the add with its literal result.",
      metricClaims: [
        { metric: "instructions", claimedDelta: -3 },
        { metric: "basicBlocks", claimedDelta: -1 },
      ],
      confidence: "high" as const,
    },
    claimChecks: [
      {
        metric: "instructions",
        claimedDelta: -3,
        actualDelta: -3,
        status: "match" as const,
      },
      {
        metric: "basicBlocks",
        claimedDelta: -1,
        actualDelta: null,
        status: "unsupported" as const,
      },
    ],
    promptVersion: "metrics-augmented@1",
    usage: { promptTokens: 120, outputTokens: 45, latencyMs: 800 },
  },
};

describe("ExplanationPanel", () => {
  test("offers an explain action when idle", async () => {
    const user = userEvent.setup();
    const onExplain = vi.fn();
    render(
      <ExplanationPanel state={{ status: "idle" }} onExplain={onExplain} />,
    );

    await user.click(
      screen.getByRole("button", { name: aiExplanationContent.labels.explain }),
    );

    expect(onExplain).toHaveBeenCalledOnce();
  });

  test("blocks repeat submissions while generating", () => {
    render(
      <ExplanationPanel state={{ status: "loading" }} onExplain={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: aiExplanationContent.labels.pending }),
    ).toBeDisabled();
  });

  test("shows copy specific to the failure code", () => {
    render(
      <ExplanationPanel
        state={{ status: "error", code: "rate-limited" }}
        onExplain={vi.fn()}
      />,
    );

    expect(
      screen.getByText(aiExplanationContent.errors["rate-limited"]),
    ).toBeInTheDocument();
  });

  test("renders the explanation body", () => {
    render(<ExplanationPanel state={ready} onExplain={vi.fn()} />);

    expect(screen.getByText("Folded a constant add.")).toBeInTheDocument();
    expect(
      screen.getByText(/Constant folding replaced the add/),
    ).toBeInTheDocument();
  });

  test("flags a metric claim the trace does not support", () => {
    render(<ExplanationPanel state={ready} onExplain={vi.fn()} />);

    const claims = screen.getByRole("table", {
      name: aiExplanationContent.labels.claims,
    });
    const unsupported = within(claims).getByLabelText(
      aiExplanationContent.labels.unsupportedClaim,
    );

    expect(within(unsupported).getByText("basicBlocks")).toBeInTheDocument();
    expect(
      within(claims).getByLabelText(aiExplanationContent.labels.verifiedClaim),
    ).toBeInTheDocument();
  });
});
