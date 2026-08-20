import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ReductionDiffViewer } from "./reduction-diff-viewer";

describe("ReductionDiffViewer", () => {
  test("opens both panes with context above the first changed row", () => {
    const unchangedLines = Array.from(
      { length: 10 },
      (_, index) => `line ${index + 1}`,
    );

    render(
      <ReductionDiffViewer
        before={[...unchangedLines, "before", "tail"].join("\n")}
        after={[...unchangedLines, "after", "tail"].join("\n")}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Previous code, read only" })
        .scrollTop,
    ).toBe(7 * 24);
    expect(
      screen.getByRole("region", { name: "Modified code, read only" })
        .scrollTop,
    ).toBe(7 * 24);
  });

  test("keeps unchanged comparisons at the top", () => {
    render(<ReductionDiffViewer before="same" after="same" />);

    expect(
      screen.getByRole("region", { name: "Previous code, read only" })
        .scrollTop,
    ).toBe(0);
  });
});
