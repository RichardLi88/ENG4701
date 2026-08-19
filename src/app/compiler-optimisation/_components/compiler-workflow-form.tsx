"use client";

import { isTRPCClientError } from "@trpc/client";
import { useEffect, useRef, useState } from "react";

import type { AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";

import { compilerWorkflowContent } from "../content";
import { parseOptimisationResult } from "../_lib/optimisation-adapter";
import type { OptimisationViewModel } from "../_lib/optimisation-types";
import {
  classifyCompilerWorkflowFailure,
  isCompilerWorkflowPending,
  MAX_SOURCE_LENGTH,
  type CompilerWorkflowRemoteStage,
  type CompilerWorkflowState,
  validateCompilerInput,
} from "../_lib/compiler-workflow";
import { StatusPanel } from "./status-panel";

const initialWorkflowState: CompilerWorkflowState = { status: "idle" };

type CompilerWorkflowFormProps = Readonly<{
  onRunStart: () => void;
  onResult: (model: OptimisationViewModel) => void;
}>;

export function CompilerWorkflowForm({
  onRunStart,
  onResult,
}: CompilerWorkflowFormProps) {
  const [filename, setFilename] = useState("input.c");
  const [source, setSource] = useState("");
  const [workflowState, setWorkflowState] =
    useState<CompilerWorkflowState>(initialWorkflowState);
  const submissionInProgressRef = useRef(false);
  const mountedRef = useRef(true);
  const compileMutation = api.compiler.compile.useMutation();
  const optimiseMutation = api.compiler.optimiseStructured.useMutation();
  const isPending = isCompilerWorkflowPending(workflowState.status);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file === undefined || submissionInProgressRef.current) {
      return;
    }

    if (!/\.(c|cpp)$/i.test(file.name)) {
      setWorkflowState({ status: "failure", code: "unsupportedExtension" });
      return;
    }

    try {
      const fileSource = await file.text();

      if (mountedRef.current) {
        setFilename(file.name);
        setSource(fileSource);
        setWorkflowState(initialWorkflowState);
      }
    } catch {
      if (mountedRef.current) {
        setWorkflowState({ status: "failure", code: "fileReadFailed" });
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submissionInProgressRef.current) {
      return;
    }

    submissionInProgressRef.current = true;
    setWorkflowState({ status: "validating" });
    const validation = validateCompilerInput(filename, source);

    if (!validation.ok) {
      setWorkflowState({ status: "failure", code: validation.code });
      submissionInProgressRef.current = false;
      return;
    }

    let remoteStage: CompilerWorkflowRemoteStage = "compile";
    onRunStart();

    try {
      setWorkflowState({ status: "compiling" });
      const compilation = await compileMutation.mutateAsync({
        filename: validation.filename,
        source: validation.source,
      });

      remoteStage = "optimise";
      setWorkflowState({ status: "optimising" });
      const payload = await optimiseMutation.mutateAsync({
        filename: validation.filename,
        ir: compilation.ir,
      });

      if (mountedRef.current) {
        setWorkflowState({ status: "processing" });
        const result = parseOptimisationResult(payload);

        if (!result.ok) {
          setWorkflowState({ status: "failure", code: "schemaInvalid" });
          return;
        }

        onResult(result.data);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }

      if (mountedRef.current) {
        setWorkflowState({ status: "success" });
      }
    } catch (error) {
      if (mountedRef.current) {
        const remoteError = isTRPCClientError<AppRouter>(error)
          ? {
              code: error.data?.code,
              hasSchemaIssues:
                error.data?.zodError !== null &&
                error.data?.zodError !== undefined,
            }
          : { hasSchemaIssues: false };

        setWorkflowState({
          status: "failure",
          code: classifyCompilerWorkflowFailure(remoteStage, remoteError),
        });
      }
    } finally {
      submissionInProgressRef.current = false;
    }
  }

  const statusContent =
    workflowState.status === "failure"
      ? {
          title: "Workflow failed",
          description: compilerWorkflowContent.errors[workflowState.code],
        }
      : compilerWorkflowContent.status[workflowState.status];

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300 uppercase">
          {compilerWorkflowContent.eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {compilerWorkflowContent.heading}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {compilerWorkflowContent.description}
        </p>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="block min-w-0 text-sm font-medium text-slate-200">
            {compilerWorkflowContent.labels.filename}
            <input
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              disabled={isPending}
              spellCheck={false}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm text-slate-100 focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition focus-within:ring-2 focus-within:ring-cyan-300 focus-within:outline-none hover:border-slate-500 hover:bg-slate-700 has-disabled:cursor-not-allowed has-disabled:opacity-60">
            {compilerWorkflowContent.labels.file}
            <input
              type="file"
              accept=".c,.cpp,text/x-c,text/x-c++"
              disabled={isPending}
              onChange={handleFileSelect}
              className="sr-only"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-200">
          {compilerWorkflowContent.labels.source}
          <textarea
            value={source}
            onChange={(event) => setSource(event.target.value)}
            disabled={isPending}
            rows={10}
            maxLength={MAX_SOURCE_LENGTH + 1}
            spellCheck={false}
            className="mt-2 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 font-mono text-sm leading-6 text-slate-100 focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {source.length.toLocaleString()} /{" "}
            {MAX_SOURCE_LENGTH.toLocaleString()} characters
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending
              ? compilerWorkflowContent.actions.submitting
              : compilerWorkflowContent.actions.submit}
          </button>
        </div>
      </form>

      <div className="mt-5">
        <StatusPanel
          eyebrow={workflowState.status}
          title={statusContent.title}
          description={statusContent.description}
          tone={workflowState.status === "failure" ? "error" : "info"}
          compact
        />
      </div>
    </section>
  );
}
