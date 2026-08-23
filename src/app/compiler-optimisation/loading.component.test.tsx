import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import CompilerOptimisationLoading from "./loading";

describe("CompilerOptimisationLoading", () => {
  test("keeps the workspace theme while loading", () => {
    const { container } = render(<CompilerOptimisationLoading />);

    expect(container.querySelector("main")).toHaveAttribute(
      "data-workspace-theme",
    );
  });
});
