import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { CompilerOptimisationExplorer } from "./compiler-optimisation-explorer";

vi.mock("./compiler-workflow-form", () => ({
  CompilerWorkflowForm: () => <div>Compiler workflow</div>,
}));

vi.mock("./optimisation-workspace", () => ({
  OptimisationWorkspace: () => <div>Optimisation workspace</div>,
}));

describe("CompilerOptimisationExplorer", () => {
  test("opts the compiler optimisation page into the workspace theme", () => {
    const { container } = render(<CompilerOptimisationExplorer />);

    expect(container.querySelector("main")).toHaveAttribute(
      "data-workspace-theme",
    );
  });
});
