import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import multiFunctionFixture from "~/test-data/compiler-optimisation/multi-function.json";

import { parseOptimisationResult } from "../_lib/optimisation-adapter";
import { OptimisationWorkspace } from "./optimisation-workspace";

function renderWorkspace() {
  const result = parseOptimisationResult(multiFunctionFixture);

  if (!result.ok) throw new Error(result.error.message);

  render(<OptimisationWorkspace model={result.data} resultKey="test-result" />);
}

describe("OptimisationWorkspace", () => {
  test("navigates between function and global Pass timelines", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(
      screen.getByRole("heading", { name: "instcombine" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /Global Passes 1 Pass Module and unassigned Passes/,
      }),
    );

    expect(screen.getByRole("heading", { name: "verify" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Pass 1, verify/ }),
    ).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByRole("button", { name: /helper 2 Passes/ }));

    expect(
      screen.getByRole("heading", { name: "simplifycfg" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "verify" })).toBeNull();
  });

  test("filters the current scope and navigates within visible results", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: /helper 2 Passes/ }));
    await user.click(screen.getByRole("button", { name: /^Unchanged/ }));

    const timeline = screen.getByRole("region", { name: "Pass timeline" });
    expect(
      within(timeline).getByRole("button", { name: /Pass 3, simplifycfg/ }),
    ).toBeInTheDocument();
    expect(
      within(timeline).getByRole("button", { name: /Pass 5, future-pass/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next Pass" }));

    expect(
      screen.getByRole("heading", { name: "future-pass" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next Pass" })).toBeDisabled();
  });

  test("shows a recoverable empty state when filters hide every Pass", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: /^Analysis/ }));

    expect(
      screen.getByRole("heading", {
        name: "No Passes match the current filters",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", { name: "Clear filters" })[0]!,
    );

    expect(
      screen.getByRole("heading", { name: "instcombine" }),
    ).toBeInTheDocument();
  });
});
