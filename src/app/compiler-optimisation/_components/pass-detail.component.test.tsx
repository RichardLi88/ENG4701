import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import multiFunctionFixture from "~/test-data/compiler-optimisation/multi-function.json";
import partialDataFixture from "~/test-data/compiler-optimisation/partial-data.json";

import { parseOptimisationResult } from "../_lib/optimisation-adapter";
import type { OptimisationPassViewModel } from "../_lib/optimisation-types";
import { PassDetail } from "./pass-detail";

function firstPassWithCfg(): OptimisationPassViewModel {
  const result = parseOptimisationResult(multiFunctionFixture);
  if (!result.ok) throw new Error(result.error.message);

  const pass = result.data.passes.find(
    (candidate) => candidate.cfg.status === "available",
  );
  if (pass === undefined) throw new Error("Expected a CFG fixture Pass");
  return pass;
}

function firstPartialPass(): OptimisationPassViewModel {
  const result = parseOptimisationResult(partialDataFixture);
  if (!result.ok) throw new Error(result.error.message);

  const pass = result.data.passes[0];
  if (pass === undefined) throw new Error("Expected a partial-data Pass");
  return pass;
}

describe("PassDetail CFG", () => {
  test("renders directed before and after graphs with change labels", () => {
    render(<PassDetail pass={firstPassWithCfg()} />);

    expect(
      screen.getByRole("img", {
        name: "Before directed control flow graph with 3 nodes and 2 edges",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "After directed control flow graph with 2 nodes and 1 edges",
      }),
    ).toBeInTheDocument();

    const beforeGraph = screen.getByRole("region", {
      name: "Before control flow graph",
    });
    expect(
      within(beforeGraph).getByText("internal · removed"),
    ).toBeInTheDocument();
    expect(within(beforeGraph).getByText("exit · changed")).toBeInTheDocument();
  });

  test("zooms a graph and resets zoom independently", async () => {
    const user = userEvent.setup();
    render(<PassDetail pass={firstPassWithCfg()} />);

    const reset = screen.getByRole("button", {
      name: "Reset zoom Before CFG",
    });
    expect(reset).toHaveTextContent("100%");

    await user.click(
      screen.getByRole("button", { name: "Zoom in Before CFG" }),
    );
    expect(reset).toHaveTextContent("125%");

    await user.click(reset);
    expect(reset).toHaveTextContent("100%");
  });

  test("keeps IR visible when CFG data is unavailable", () => {
    render(<PassDetail pass={firstPartialPass()} />);

    expect(
      screen.getByRole("region", { name: "Intermediate representation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("CFG data was not provided for this Pass."),
    ).toBeInTheDocument();
  });
});
