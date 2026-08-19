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

function createSourceFile(name: string, source: string) {
  const file = new File([source], name, { type: "text/plain" });
  Object.defineProperty(file, "text", {
    value: vi.fn().mockResolvedValue(source),
  });
  return file;
}

describe("CompilerWorkflowForm", () => {
  beforeEach(() => {
    mutationMocks.compile.mockReset();
    mutationMocks.optimise.mockReset();
  });

  test("rejects an unsupported file before calling the service", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<CompilerWorkflowForm onRunStart={vi.fn()} onResult={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("Upload C/C++ file"),
      createSourceFile("input.txt", "int main() { return 0; }"),
    );

    expect(
      screen.getByText("Use a filename ending in .c or .cpp."),
    ).toBeInTheDocument();
    expect(mutationMocks.compile).not.toHaveBeenCalled();
  });

  test("collapses to a secondary upload action when a result is visible", () => {
    render(
      <CompilerWorkflowForm onRunStart={vi.fn()} onResult={vi.fn()} compact />,
    );

    expect(screen.getByLabelText("Upload another file")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Upload C/C++ source" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(".c and .cpp files up to 50,000 characters"),
    ).not.toBeInTheDocument();
  });

  test("prevents duplicate submission while compilation is pending", async () => {
    const user = userEvent.setup();
    const compilation = deferred<{ ir: string }>();
    mutationMocks.compile.mockReturnValue(compilation.promise);
    render(<CompilerWorkflowForm onRunStart={vi.fn()} onResult={vi.fn()} />);

    await user.upload(
      screen.getByLabelText("Upload C/C++ file"),
      createSourceFile("input.c", "int main() { return 0; }"),
    );

    expect(
      screen.getByRole("heading", { name: "Compiling source" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Processing file…")).toBeDisabled();
    expect(mutationMocks.compile).toHaveBeenCalledTimes(1);

    await act(async () => {
      compilation.reject({ data: { code: "SERVICE_UNAVAILABLE" } });
    });

    expect(screen.getByLabelText("Upload C/C++ file")).toBeEnabled();
  });

  test("uploads the selected file automatically and restores the control after an error", async () => {
    const user = userEvent.setup();
    mutationMocks.compile.mockRejectedValue({
      data: { code: "SERVICE_UNAVAILABLE", zodError: null },
    });
    render(<CompilerWorkflowForm onRunStart={vi.fn()} onResult={vi.fn()} />);
    const source = "int main() { return 0; }";

    await user.upload(
      screen.getByLabelText("Upload C/C++ file"),
      createSourceFile("program.cpp", source),
    );

    expect(
      await screen.findByText(
        "The LLVM service is unavailable. Check the local service, then try again.",
      ),
    ).toBeInTheDocument();
    expect(mutationMocks.compile).toHaveBeenCalledWith({
      filename: "program.cpp",
      source,
    });
    expect(screen.getByLabelText("Upload C/C++ file")).toBeEnabled();
  });
});
