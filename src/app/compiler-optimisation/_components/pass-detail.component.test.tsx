import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import multiFunctionFixture from "~/test-data/compiler-optimisation/multi-function.json";
import partialDataFixture from "~/test-data/compiler-optimisation/partial-data.json";

import { parseOptimisationResult } from "../_lib/optimisation-adapter";
import type { OptimisationPassViewModel } from "../_lib/optimisation-types";
import { PassDetail } from "./pass-detail";

class MockIntersectionObserver implements IntersectionObserver {
  static current: MockIntersectionObserver | undefined;

  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];
  private observedTarget: Element | undefined;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.rootMargin = options.rootMargin ?? "0px";
    MockIntersectionObserver.current = this;
  }

  observe(target: Element) {
    this.observedTarget = target;
  }

  unobserve(target: Element) {
    if (this.observedTarget === target) this.observedTarget = undefined;
  }

  disconnect() {
    this.observedTarget = undefined;
  }

  takeRecords() {
    return [];
  }

  enterViewport() {
    const target = this.observedTarget;
    if (!target) throw new Error("Expected an observed CFG boundary");
    const bounds = target.getBoundingClientRect();
    this.callback(
      [
        {
          boundingClientRect: bounds,
          intersectionRatio: 1,
          intersectionRect: bounds,
          isIntersecting: true,
          rootBounds: null,
          target,
          time: 0,
        },
      ],
      this,
    );
  }
}

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

describe("PassDetail metadata", () => {
  test("shows unique metadata once without the repeated details panel", () => {
    render(<PassDetail pass={firstPassWithCfg()} />);

    const header = screen
      .getByRole("heading", { name: "instcombine" })
      .closest("header");
    if (header === null) throw new Error("Expected Pass detail header");

    expect(within(header).getByText("InstCombinePass")).toBeInTheDocument();
    expect(within(header).getByText("Global")).toBeInTheDocument();
    expect(within(header).getByText("2")).toBeInTheDocument();
    expect(within(header).getByText("Function")).toBeInTheDocument();
    expect(within(header).getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Pass details")).toBeNull();
    expect(screen.queryByText("Global order")).toBeNull();
  });

  test("shows runtime analysis context without the transformation card", () => {
    const basePass = firstPassWithCfg();
    const previousPass = { ...basePass, id: "previous", name: "simplify-cfg" };
    const nextPass = { ...basePass, id: "next", name: "sroa" };
    const pass: OptimisationPassViewModel = {
      ...basePass,
      analysisActivity: {
        status: "available",
        data: {
          computed: ["DominatorTreeAnalysis", "LoopAnalysis"],
          preservation: "not-all",
        },
      },
    };

    render(
      <PassDetail
        pass={pass}
        previousPass={previousPass}
        nextPass={nextPass}
      />,
    );

    expect(screen.queryByText("Transformation result")).toBeNull();
    expect(
      screen.getByText("May invalidate cached analyses"),
    ).toBeInTheDocument();
    expect(screen.getByText("DominatorTreeAnalysis")).toBeInTheDocument();
    expect(screen.getByText("LoopAnalysis")).toBeInTheDocument();
    expect(screen.getByText("simplify-cfg")).toBeInTheDocument();
    expect(screen.getByText("sroa")).toBeInTheDocument();
    expect(screen.queryByText("Dependencies and relations")).toBeNull();
  });
});

describe("PassDetail CFG", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    MockIntersectionObserver.current = undefined;
    vi.unstubAllGlobals();
  });

  async function revealCfg() {
    await act(async () => {
      MockIntersectionObserver.current?.enterViewport();
    });
  }

  test("defers CFG loading until its section approaches the viewport", async () => {
    render(<PassDetail pass={firstPassWithCfg()} />);

    expect(
      screen.getByText(
        "CFG loading is deferred until this section approaches the viewport.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Before directed/ })).toBeNull();
    expect(MockIntersectionObserver.current?.rootMargin).toBe("600px 0px");

    await revealCfg();

    expect(
      await screen.findByRole("img", {
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

  test("links graph zoom by default and resets the shared scale", async () => {
    const user = userEvent.setup();
    render(<PassDetail pass={firstPassWithCfg()} />);
    await revealCfg();

    const reset = await screen.findByRole("button", { name: "Reset zoom" });
    expect(reset).toHaveTextContent("100%");
    expect(
      screen.getByRole("button", { name: "Unlink views" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(reset).toHaveTextContent("115%");

    await user.click(reset);
    expect(reset).toHaveTextContent("100%");
  });

  test("opens the investigation workspace and exits it with Escape", async () => {
    const user = userEvent.setup();
    render(<PassDetail pass={firstPassWithCfg()} />);
    await revealCfg();

    await user.click(
      screen.getByRole("button", { name: "Open fullscreen workspace" }),
    );
    expect(
      screen.getByRole("button", { name: "Exit fullscreen workspace" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Open fullscreen workspace" }),
    ).toBeInTheDocument();
  });

  test("inspects one stable block across Before and After", async () => {
    const user = userEvent.setup();
    render(<PassDetail pass={firstPassWithCfg()} />);
    await revealCfg();

    const entryNodes = await screen.findAllByRole("button", {
      name: "entry, entry, unchanged",
    });
    await user.click(entryNodes[0]!);

    const inspector = screen.getByRole("complementary", {
      name: "Selected block",
    });
    expect(inspector).toHaveTextContent("Stable ID: main:entry");
    expect(within(inspector).getByText("Before IR")).toBeInTheDocument();
    expect(within(inspector).getByText("After IR")).toBeInTheDocument();
  });

  test("keeps IR visible when CFG data is unavailable", async () => {
    render(<PassDetail pass={firstPartialPass()} />);

    expect(
      screen.getByRole("region", { name: "Intermediate representation" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("CFG data was not provided for this Pass."),
    ).toBeNull();

    await revealCfg();

    expect(
      await screen.findByText("CFG data was not provided for this Pass."),
    ).toBeInTheDocument();
  });
});
