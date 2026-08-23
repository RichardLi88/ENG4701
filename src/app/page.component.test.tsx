import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import Home from "./page";

describe("Home", () => {
  test("presents both destinations equally within the workspace theme", () => {
    const { container } = render(<Home />);
    const programReduction = screen.getByRole("link", {
      name: "Program Reduction",
    });
    const compilerOptimisation = screen.getByRole("link", {
      name: "Compiler Optimisation",
    });

    expect(container.querySelector("main")).toHaveAttribute(
      "data-workspace-theme",
    );
    expect(programReduction).toHaveAttribute("href", "/program-reduction");
    expect(compilerOptimisation).toHaveAttribute(
      "href",
      "/compiler-optimisation",
    );
    expect(programReduction.className).toBe(compilerOptimisation.className);
  });
});
