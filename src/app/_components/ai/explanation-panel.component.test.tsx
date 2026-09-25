import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { ExplanationPanel } from "./explanation-panel";
import { prepareRecord } from "~/server/ai/client";
import { explainInputSchema } from "~/server/ai/schema";

const input = explainInputSchema.parse({
  domain: "compiler-optimisation",
  traceVersion: "1.1.0",
  toolVersion: "14.0.0",
  sourceFile: "gcd.c",
  subject: { id: "p1", name: "sroa", scope: "gcd" },
  before: "a",
  after: "b",
  patch: null,
  metrics: [],
  llvm: {
    type: "transform",
    changed: true,
    optimisationLevel: "O1",
    analysisActivity: null,
  },
  reduction: null,
});
describe("AI explanation panel", () => {
  test("manual request, accessible pending state and bounded evidence errors", () => {
    const click = vi.fn();
    const { rerender } = render(
      <ExplanationPanel
        input={input}
        pending={false}
        records={[]}
        error={null}
        disabled={false}
        onExplain={click}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Explain this step" }));
    expect(click).toHaveBeenCalledOnce();
    rerender(
      <ExplanationPanel
        input={input}
        pending
        records={[]}
        error={null}
        disabled={false}
        onExplain={click}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Generating");
    expect(screen.getByRole("button")).toBeDisabled();
  });
  test("blocked record remains exportable and never masquerades as completed", () => {
    const record = prepareRecord({ ...input, toolVersion: null });
    render(
      <ExplanationPanel
        input={input}
        pending={false}
        records={[record]}
        error={null}
        disabled={false}
        onExplain={() => undefined}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No matching LLVM knowledge",
    );
    expect(
      screen.getByRole("button", { name: "Export research record" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("Changes in this execution"),
    ).not.toBeInTheDocument();
  });
  test("successful output links evidence and does not label all claims verified", () => {
    const record = prepareRecord(input);
    record.status = "completed";
    record.output = {
      generalPurpose: [{ text: "Purpose", evidenceIds: ["K1"] }],
      observedChanges: [{ text: "Observed", evidenceIds: ["E1"] }],
      conclusions: [{ text: "Conclusion", evidenceIds: ["E2"] }],
      limitations: [{ text: "Unknown runtime", evidenceIds: ["E3"] }],
      metricClaims: [],
    };
    render(
      <ExplanationPanel
        input={input}
        pending={false}
        records={[record]}
        error={null}
        disabled={false}
        onExplain={() => undefined}
      />,
    );
    expect(screen.getByRole("link", { name: "[E1]" })).toHaveAttribute(
      "href",
      expect.stringContaining("-E1"),
    );
    expect(
      screen.getByText(/do not verify the whole explanation/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Explain this step" }),
    ).not.toBeInTheDocument();
  });
});
