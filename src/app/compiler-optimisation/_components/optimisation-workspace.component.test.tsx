import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import multiFunctionFixture from "~/test-data/compiler-optimisation/multi-function.json";
import manyPassesFixture from "~/test-data/compiler-optimisation/many-passes";

import { parseOptimisationResult } from "../_lib/optimisation-adapter";
import { OptimisationWorkspace } from "./optimisation-workspace";

function renderWorkspace() {
  const result = parseOptimisationResult(multiFunctionFixture);

  if (!result.ok) throw new Error(result.error.message);

  render(<OptimisationWorkspace model={result.data} resultKey="test-result" />);
}

function renderWorkspaceWithSource() {
  const result = parseOptimisationResult(multiFunctionFixture);

  if (!result.ok) throw new Error(result.error.message);

  render(
    <OptimisationWorkspace
      model={result.data}
      resultKey="with-source"
      source={{
        status: "available",
        data: { name: "demo.c", text: "int main(void) {\n  return 0;\n}" },
      }}
    />,
  );
}

function renderManyPassWorkspace() {
  const result = parseOptimisationResult(manyPassesFixture);

  if (!result.ok) throw new Error(result.error.message);

  render(<OptimisationWorkspace model={result.data} resultKey="many-passes" />);
}

describe("OptimisationWorkspace", () => {
  test("virtualises a large Pass timeline and keeps End-key navigation", async () => {
    const user = userEvent.setup();
    renderManyPassWorkspace();

    const timeline = screen.getByRole("region", { name: "Pass timeline" });
    const virtualViewport = timeline.querySelector('[data-virtualised="true"]');
    const renderedPassItems = timeline.querySelectorAll("ol > li");

    expect(virtualViewport).not.toBeNull();
    expect(renderedPassItems.length).toBeGreaterThan(0);
    expect(renderedPassItems.length).toBeLessThan(60);
    expect(renderedPassItems[0]).toHaveAttribute("aria-setsize", "60");

    const firstPass = within(timeline).getByRole("button", {
      name: /Pass 1, analysis-pass-01/,
    });
    firstPass.focus();
    await user.keyboard("{End}");

    expect(
      await screen.findByRole("heading", { name: "transform-pass-60" }),
    ).toBeInTheDocument();
    expect(
      within(timeline).getByRole("button", {
        name: /Pass 60, transform-pass-60/,
      }),
    ).toHaveFocus();
  });

  test("writes the current function, Pass, and filters to the URL", async () => {
    const user = userEvent.setup();
    window.history.replaceState(
      null,
      "",
      "/compiler-optimisation?campaign=demo",
    );
    renderWorkspace();

    await user.click(
      within(screen.getByRole("article")).getByRole("button", {
        name: "Unified",
      }),
    );
    await user.click(screen.getByRole("button", { name: /helper 2 Passes/ }));
    await user.click(screen.getByRole("button", { name: /^Unchanged/ }));
    await user.click(screen.getByRole("button", { name: "Next Pass" }));

    const params = new URLSearchParams(window.location.search);
    expect(params.get("campaign")).toBe("demo");
    expect(params.get("function")).toBe("fn:aGVscGVy");
    expect(params.get("pass")).toBe("pass:000004:ZnV0dXJlLXBhc3M");
    expect(params.get("change")).toBe("unchanged");
    expect(params.get("diff")).toBe("unified");
  });

  test("a Pass that changed nothing shows one IR pane instead of a comparison", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: /helper 2 Passes/ }));
    await user.click(screen.getByRole("button", { name: /^Unchanged/ }));

    const passDetail = within(screen.getByRole("article"));

    expect(
      passDetail.queryByRole("region", { name: /optimisation IR/ }),
    ).not.toBeInTheDocument();
    expect(
      passDetail.queryByRole("group", { name: "Diff view" }),
    ).not.toBeInTheDocument();
    expect(
      passDetail.getByText("IR at this point in the pipeline"),
    ).toBeInTheDocument();
  });

  test("searching the Pass list filters the timeline and updates the facet counts", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(
      screen.getByRole("searchbox", { name: "Search Passes" }),
      "instcombine",
    );

    expect(
      screen.getByRole("button", { name: /^Pass 2, instcombine/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pass 4, loop-delete/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Transform/ })).toHaveTextContent(
      "Transform1",
    );
  });

  test("keeps the uploaded source available across Pass selections", async () => {
    const user = userEvent.setup();
    renderWorkspaceWithSource();

    const sourcePanel = within(
      screen.getByRole("region", { name: "Original source" }),
    );
    expect(sourcePanel.getByText("demo.c")).toBeInTheDocument();
    expect(sourcePanel.getByText("int main(void) {")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /helper 2 Passes/ }));

    expect(
      within(screen.getByRole("region", { name: "Original source" })).getByText(
        "int main(void) {",
      ),
    ).toBeInTheDocument();
  });

  test("reports an unavailable source rather than an empty panel", () => {
    const result = parseOptimisationResult(multiFunctionFixture);
    if (!result.ok) throw new Error(result.error.message);

    render(<OptimisationWorkspace model={result.data} resultKey="no-source" />);

    expect(
      screen.getByText(
        "The uploaded source file is not available for this run.",
      ),
    ).toBeInTheDocument();
  });

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
