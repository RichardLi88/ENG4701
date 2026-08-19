import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { IrDiffViewer } from "./ir-diff-viewer";

describe("IrDiffViewer", () => {
  test("renders a unified edit stream and exposes a controlled mode toggle", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(
      <IrDiffViewer
        before={"define @main {\n  ret i32 0\n}"}
        after={"define @main {\n  ret i32 1\n}"}
        mode="unified"
        onModeChange={onModeChange}
      />,
    );

    const unified = screen.getByRole("region", {
      name: "Unified optimisation IR",
    });
    expect(within(unified).getByText("ret i32 0")).toBeInTheDocument();
    expect(within(unified).getByText("ret i32 1")).toBeInTheDocument();
    expect(within(unified).getByLabelText("Removed line")).toBeInTheDocument();
    expect(within(unified).getByLabelText("Added line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unified" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Side by side" }));
    expect(onModeChange).toHaveBeenCalledWith("side-by-side");
  });

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

  test("prefers a valid backend structured Diff", () => {
    render(
      <IrDiffViewer
        before="old"
        after="new"
        structuredDiff={[
          {
            kind: "removed",
            content: "old",
            beforeLineNumber: 1,
            afterLineNumber: null,
            endsWithNewline: false,
          },
          {
            kind: "added",
            content: "new",
            beforeLineNumber: null,
            afterLineNumber: 1,
            endsWithNewline: false,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Intermediate representation" }),
    ).toHaveAttribute("data-diff-source", "structured");
  });
});
