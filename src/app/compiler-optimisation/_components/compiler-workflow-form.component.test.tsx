import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mutationMocks = vi.hoisted(() => ({
  compile: vi.fn(),
  optimise: vi.fn(),
}));

vi.mock("~/trpc/react", () => ({
  api: {
    compiler: {
      compile: {
        useMutation: () => ({ mutateAsync: mutationMocks.compile }),
      },
      optimiseStructured: {
        useMutation: () => ({ mutateAsync: mutationMocks.optimise }),
      },
    },
  },
}));

vi.mock("@trpc/client", () => ({
  isTRPCClientError: (error: { data?: object }) => error.data !== undefined,
}));

import { CompilerWorkflowForm } from "./compiler-workflow-form";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error | { data: object }) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function pasteSource(
  user: ReturnType<typeof userEvent.setup>,
  source: string,
) {
  const sourceInput = screen.getByRole("textbox", { name: "Source code" });
  await user.click(sourceInput);
  await user.paste(source);
}

describe("CompilerWorkflowForm", () => {
  beforeEach(() => {
    mutationMocks.compile.mockReset();
    mutationMocks.optimise.mockReset();
  });

  test("rejects an unsupported filename before calling the service", async () => {
    const user = userEvent.setup();
    render(<CompilerWorkflowForm onRunStart={vi.fn()} onResult={vi.fn()} />);

    await user.clear(screen.getByRole("textbox", { name: "Filename" }));
    await user.type(
      screen.getByRole("textbox", { name: "Filename" }),
      "input.txt",
    );
    await pasteSource(user, "int main() { return 0; }");
    await user.click(
      screen.getByRole("button", { name: "Compile and optimise" }),
    );

    expect(
      screen.getByText("Use a filename ending in .c or .cpp."),
    ).toBeInTheDocument();
    expect(mutationMocks.compile).not.toHaveBeenCalled();
  });

  test("prevents duplicate submission while compilation is pending", async () => {
    const user = userEvent.setup();
    const compilation = deferred<{ ir: string }>();
    mutationMocks.compile.mockReturnValue(compilation.promise);
    render(<CompilerWorkflowForm onRunStart={vi.fn()} onResult={vi.fn()} />);

    await pasteSource(user, "int main() { return 0; }");
    await user.click(
      screen.getByRole("button", { name: "Compile and optimise" }),
    );

    expect(
      screen.getByRole("heading", { name: "Compiling source" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Running workflow…" }),
    ).toBeDisabled();
    expect(mutationMocks.compile).toHaveBeenCalledTimes(1);

    await act(async () => {
      compilation.reject({ data: { code: "SERVICE_UNAVAILABLE" } });
    });

    expect(
      screen.getByRole("button", { name: "Compile and optimise" }),
    ).toBeEnabled();
  });

  test("shows a service error, preserves source, and restores submission", async () => {
    const user = userEvent.setup();
    mutationMocks.compile.mockRejectedValue({
      data: { code: "SERVICE_UNAVAILABLE", zodError: null },
    });
    render(<CompilerWorkflowForm onRunStart={vi.fn()} onResult={vi.fn()} />);
    const source = "int main() { return 0; }";

    await pasteSource(user, source);
    await user.click(
      screen.getByRole("button", { name: "Compile and optimise" }),
    );

    expect(
      await screen.findByText(
        "The LLVM service is unavailable. Check the local service, then try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Source code" })).toHaveValue(
      source,
    );
    expect(
      screen.getByRole("button", { name: "Compile and optimise" }),
    ).toBeEnabled();
  });
});
