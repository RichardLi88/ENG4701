import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { test, expect, vi } from "vitest";
import {
  ExplanationContainer,
  ExplanationSessionProvider,
} from "./explanation-container";
import { prepareRecord } from "~/server/ai/client";
import { explainInputSchema, type ExplanationRecord } from "~/server/ai/schema";
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("~/trpc/react", () => ({
  api: { ai: { explain: { useMutation: () => ({ mutateAsync: mutate }) } } },
}));
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
test("switching selection during generation never displays the old result; returning reuses it", async () => {
  let resolve: (record: ExplanationRecord) => void = () => undefined;
  mutate.mockImplementation(
    () =>
      new Promise<ExplanationRecord>((r) => {
        resolve = r;
      }),
  );
  const tree = (id: string) => (
    <ExplanationSessionProvider>
      <ExplanationContainer
        input={{ ...input, subject: { ...input.subject, id } }}
      />
    </ExplanationSessionProvider>
  );
  const { rerender } = render(tree("p1"));
  fireEvent.click(screen.getByRole("button", { name: "Explain this step" }));
  expect(mutate).toHaveBeenCalledTimes(1);
  rerender(tree("p2"));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  const record = prepareRecord(input);
  record.status = "completed";
  record.output = {
    generalPurpose: [{ text: "First pass purpose", evidenceIds: ["K1"] }],
    observedChanges: [{ text: "First pass result", evidenceIds: ["E1"] }],
    conclusions: [{ text: "Conclusion", evidenceIds: ["E2"] }],
    limitations: [{ text: "Limitation", evidenceIds: ["E3"] }],
    metricClaims: [],
  };
  resolve(record);
  await waitFor(() =>
    expect(screen.queryByText("First pass result")).not.toBeInTheDocument(),
  );
  rerender(tree("p1"));
  await screen.findByText("First pass result");
  expect(mutate).toHaveBeenCalledTimes(1);
});
