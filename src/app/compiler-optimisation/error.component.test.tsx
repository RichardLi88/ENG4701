import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import CompilerOptimisationError from "./error";

describe("CompilerOptimisationError", () => {
  test("offers recovery without exposing the original server error", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    const error = Object.assign(new Error("private backend detail"), {
      digest: "route-error-123",
    });

    const { container } = render(
      <CompilerOptimisationError error={error} reset={reset} />,
    );

    expect(container.querySelector("main")).toHaveAttribute(
      "data-workspace-theme",
    );

    expect(
      screen.getByRole("heading", {
        name: "The optimisation workspace could not be loaded",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("private backend detail")).toBeNull();
    expect(screen.getByText("route-error-123")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute(
      "href",
      "/",
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  test("omits the error reference when Next.js does not provide one", () => {
    render(
      <CompilerOptimisationError
        error={new Error("render failed")}
        reset={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Error reference/)).toBeNull();
  });
});
