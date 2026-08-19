import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { IrDiffViewer } from "./ir-diff-viewer";

describe("IrDiffViewer", () => {
  test("keeps before and after sides ordered and labels line changes", () => {
    render(
      <IrDiffViewer
        before={"define @main {\n  ret i32 0\n}"}
        after={"define @main {\n  ret i32 1\n}"}
      />,
    );

    const before = screen.getByRole("region", {
      name: "Before optimisation IR",
    });
    const after = screen.getByRole("region", { name: "After optimisation IR" });

    expect(within(before).getByText("ret i32 0")).toBeInTheDocument();
    expect(within(before).getByLabelText("Removed line")).toBeInTheDocument();
    expect(within(after).getByText("ret i32 1")).toBeInTheDocument();
    expect(within(after).getByLabelText("Added line")).toBeInTheDocument();
  });

  test("announces a Pass that ran without changing IR", () => {
    render(<IrDiffViewer before={"ret i32 0"} after={"ret i32 0"} />);

    expect(screen.getByText("No IR changes")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This Pass ran successfully but left the intermediate representation unchanged.",
      ),
    ).toBeInTheDocument();
  });

  test("shows a data error instead of inventing a missing snapshot", () => {
    render(<IrDiffViewer before={null} after={"ret i32 0"} />);

    expect(
      screen.getByRole("heading", { name: "IR comparison is unavailable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The IR snapshot before this Pass was not provided."),
    ).toBeInTheDocument();
  });
});
