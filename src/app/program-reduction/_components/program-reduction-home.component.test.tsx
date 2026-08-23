import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProgramReductionHome } from "./program-reduction-home";

describe("ProgramReductionHome", () => {
  test("opts the program reduction page into the workspace theme", () => {
    const { container } = render(<ProgramReductionHome />);

    expect(container.querySelector("main")).toHaveAttribute(
      "data-workspace-theme",
    );
    expect(
      screen.getByRole("heading", { name: "Reduction trace visualiser" }),
    ).toBeInTheDocument();
  });
});
